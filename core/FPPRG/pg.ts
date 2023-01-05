/**
 * This is a postgres database implementation of FPKRG.
 */

import * as pg from 'pg'
import createSubscriber, { Subscriber } from 'pg-listen'
import * as db from '@/db/fpprg'
import * as dict from '@/utils/dict'
import { Database, Process, FPL, Resolved, Data, DatabaseListenCallback, DatabaseKeyedTables, IdOrProcess, IdOrData } from '@/core/FPPRG/spec'

/**
 * The database maintains records for each table type
 */
export class PgDatabase implements Database {
  private processTable: Record<string, Process> = {}
  private fplTable: Record<string, FPL> = {}
  private resolvedTable: Record<string, Resolved> = {}
  private dataTable: Record<string, Data> = {}
  private listeners: Record<number, DatabaseListenCallback> = {}
  private id = 0
  private pool: pg.Pool
  private subscriber: Subscriber

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString })
    this.subscriber = createSubscriber({ connectionString })
    this.subscriber.notifications.on('on_insert', async (rawPayload) => {
      const payload = db.notify_insertion_trigger_payload.parse(rawPayload)
      const { table, operation, body } = payload
      if (operation === 'INSERT') {
        if (table === 'data') {
          const rawRecord = db.data.parse(body)
          if (!(rawRecord.id in this.dataTable)) {
            this.dataTable[rawRecord.id] = new Data(rawRecord.type, rawRecord.value, true)
          }
          this.notify(table, this.dataTable[rawRecord.id] as Data)
        } else if (table === 'process') {
          const rawRecord = db.process.parse(body)
          this.notify(table, (await this.getProcess(rawRecord.id)) as Process)
        } else if (table === 'resolved') {
          const rawRecord = db.resolved.parse(body)
          this.notify(table, (await this.getResolved(rawRecord.id)) as Resolved)
        } else if (table === 'fpl') {
          const rawRecord = db.fpl.parse(body)
          this.notify(table, (await this.getFPL(rawRecord.id)) as FPL)
        }
      }
    })
  }

  /**
   * Listen to changes on the DB
   */
  listen = (cb: DatabaseListenCallback) => {
    const id = this.id++
    this.listeners[id] = cb
    return () => {delete this.listeners[id]}
  }
  /**
   * Inform listeners of changes to the DB
   */
  private notify = <T extends keyof DatabaseKeyedTables>(table: T, record: DatabaseKeyedTables[T]) => {
    for (const listener of Object.values(this.listeners)) {
      listener(table, record)
    }
  }

  resolveProcess = async (process: IdOrProcess): Promise<Process> => {
    if ('id' in process) {
      return await this.getProcess(process.id) as Process
    } else {
      return await this.upsertProcess(new Process(
        process.type,
        'data' in process ? process.data !== undefined ? await this.resolveData(process.data) : undefined : undefined,
        dict.init(await Promise.all(dict.items(process.inputs).map(async ({ key, value }) => ({ key, value: await this.resolveProcess(value) }))))
      ))
    }
  }
  getProcess = async (id: string) => {
    if (!(id in this.processTable)) {
      const results = await this.pool.query('select * from process_complete where id = $1', [id])
      if (results.rowCount > 0) {
        const result = await db.process_complete.parse(results.rows[0])
        this.processTable[result.id] = new Process(
          result.type,
          result.data !== undefined ? await this.getData(result.data) : undefined,
          dict.init(await Promise.all(dict.items(result.inputs).map(async ({ key, value }) => ({ key, value: (await this.getProcess(value)) as Process })))),
          this,
          true,
        )
      }
    }
    return this.processTable[id] as Process | undefined
  }
  upsertProcess = async (process: Process) => {
    if (!process.persisted) {
      if (!(process.id in this.processTable)) {
        process.db = this
        if (process.data !== undefined) {
          process.data = await this.upsertData(process.data)
        }
        process.persisted = true
        this.processTable[process.id] = process

        const client = await this.pool.connect()
        try {
          await client.query('BEGIN')
          for (const key in process.inputs) {
            const value = process.inputs[key]
            await client.query(`
              insert into process_input ("id", "key", "value")
              values ($1, $2, $3)
              on conflict ("id", "key") do nothing;
            `, [process.id, key, value])
          }
          await client.query(`
            insert into process ("id", "type", "data")
            values ($1, $2, $3)
            on conflict ("id") do nothing;
          `, [process.id, process.type, process.data !== undefined ? process.data.id : undefined])
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }
      }
    }
    return this.processTable[process.id] as Process
  }

  resolveData = async (data: IdOrData) => {
    if ('id' in data) {
      return await this.getData(data.id) as Data
    } else {
      return await this.upsertData(new Data(data.type, data.value))
    }
  }
  getData = async (id: string) => {
    if (!(id in this.dataTable)) {
      const results = await this.pool.query('select * from data where id = $1', [id])
      if (results.rowCount > 0) {
        const result = await db.data.parse(results.rows[0])
        this.dataTable[result.id] = new Data(
          result.type,
          result.value,
          true,
        )
      }
    }
    return this.dataTable[id] as Data | undefined
  }
  upsertData = async (data: Data) => {
    if (!data.persisted) {
      if (!(data.id in this.dataTable)) {
        data.persisted = true
        this.dataTable[data.id] = data
        await this.pool.query(`
          insert into data ("id", "type", "value")
          values ($1, $2, $3)
          on conflict ("id") do nothing;
        `, [data.id, data.type, data.value])
      }
    }
    return this.dataTable[data.id] as Data
  }

  getResolved = async (id: string) => {
    if (!(id in this.resolvedTable)) {
      const results = await this.pool.query('select * from resolved where id = $1', [id])
      if (results.rowCount > 0) {
        const result = await db.resolved.parse(results.rows[0])
        this.resolvedTable[result.id] = new Resolved(
          (await this.getProcess(result.id)) as Process,
          result.data !== undefined ? (await this.getData(result.data)) as Data : undefined,
          true,
        )
      }
    }
    return this.resolvedTable[id] as Resolved | undefined
  }
  /**
   * Like getResolved but if it's not in the db yet, wait for it
   */
  awaitResolved = async (id: string) => {
    if (!(id in this.resolvedTable)) {
      await new Promise<void>((resolve, reject) => {
        const unsub = this.listen((table, record) => {
          if (table === 'resolved' && record.id === id) {
            resolve()
            unsub()
          }
        })
      })
    }
    return this.resolvedTable[id] as Resolved
  }
  upsertResolved = async (resolved: Resolved) => {
    if (!resolved.persisted) {
      if (!(resolved.id in this.resolvedTable)) {
        if (resolved.data) {
          await this.upsertData(resolved.data)
        }
        resolved.persisted = true
        this.resolvedTable[resolved.id] = resolved
        await this.pool.query(`
          insert into resolved ("id", "data")
          values ($1, $2)
          on conflict ("id") do nothing;
        `, [resolved.id, resolved.data !== undefined ? resolved.data.id : undefined])
      }
    }
    return this.resolvedTable[resolved.id] as Resolved
  }

  getFPL = async (id: string) => {
    if (!(id in this.fplTable)) {
      const results = await this.pool.query('select * from fpl where id = $1', [id])
      if (results.rowCount > 0) {
        const result = await db.fpl.parse(results.rows[0])
        this.fplTable[result.id] = new FPL(
          (await this.getProcess(result.id)) as Process,
          result.parent !== undefined ? (await this.getFPL(result.parent)) as FPL : undefined,
          true,
        )
      }
    }
    return this.fplTable[id] as FPL | undefined
  }
  upsertFPL = async (fpl: FPL) => {
    if (!fpl.persisted) {
      if (!(fpl.id in this.fplTable)) {
        fpl.process = await this.upsertProcess(fpl.process)
        if (fpl.parent !== undefined) {
          fpl.parent = await this.upsertFPL(fpl.parent)
        }
        fpl.persisted = true
        this.fplTable[fpl.id] = fpl
        await this.pool.query(`
          insert into fpl ("id", "process", "parent")
          values ($1, $2, $3)
          on conflict ("id") do nothing;
        `, [fpl.id, fpl.process.id, fpl.parent !== undefined ? fpl.parent.id : undefined])
      }
    }
    return this.fplTable[fpl.id] as FPL
  }

  dump = async () => {
    return {
      dataTable: this.dataTable,
      processTable: this.processTable,
      resolvedTable: this.resolvedTable,
      fplTable: this.fplTable,
    }
  }
}