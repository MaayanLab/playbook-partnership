import { API } from '@/spec/api'
import { z } from 'zod'
import db from '@/app/db'
import krg from '@/app/krg'
import OpenAI from 'openai'
import { getServerSessionWithId } from '@/app/extensions/next-auth/helpers'
import { NotFoundError, ResponseCodedError, UnauthorizedError, UnsupportedMethodError } from '@/spec/error'
import cache from '@/utils/global_cache'
import dedent from 'ts-dedent'
import * as dict from '@/utils/dict'
import * as array from '@/utils/array'
import { ProcessMetaNode } from '@/spec/metanode'
import { GPTAssistantMessageParse, AssembleState, AssistantParsedMessages } from './utils'
import { FPL, Process } from '@/core/FPPRG'
import fpprg from '@/app/fpprg'

const openai = cache('openai', async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(`OPENAI_API_KEY not defined`)
    throw new UnsupportedMethodError()
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
})
const assistant = cache('openai-assistant', async () => {
  if (!process.env.OPENAI_ASSISTANT_ID) {
    const assistant = await (await openai).beta.assistants.create({
      name: `playbook-gpt`,
      instructions: dedent`
        You are a bot that helps the user construct workflows. You do not answer questions directly, instead you help choose from the applicable workflow steps in an effort to construct a workflow that answer the user's question.
        Queries will be JSON serialized, and of the form (note that steps in the current workflow are linked to the next step by id):
        User:
        {
          "message": "I'd like to get the expression of ACE2.",
          "choices": [{ "id": 1, "type": "prompt", "name": "Input[Gene]", ...]
        }
        Assistant:
        {
          "message": "In that case, let's start with the gene, ACE2.",
          "suggestions": [{ "id": 1, "value": "ACE2" }, ...]
        }
        User:
        {
          "step": { "id": 1 },
          "choices": [{ "id": 2, "type": "resolver", "name": "GetTissueExpressionOfGene", "inputs": { "gene": 1 }, ... }, ...]
        }
        Assistant:
        {
          "message": "You can get tissue expression of ACE2 in healthy human tissue from GTEx or from GEO using ARCHS4.",
          "suggestions": [{ "id": 2 }, ...]
        }
        Your response should be JSON serialized, choosing from these or choices in past messages, suggestions should be ordered by most likely.
        When the choice type is prompt, value must be specified based on the user search term.
      `,
      model: "gpt-4o",
    })
    console.log(assistant.id)
    return assistant
  } else {
    return await (await openai).beta.assistants.retrieve(process.env.OPENAI_ASSISTANT_ID)
  }
})

function count(start: number) {
  const ctx = { id: start }
  return {
    next: () => ctx.id++
  }
}

export const GPTAssistantCreate = API.post('/api/v1/chat')
  .query(z.object({}))
  .body(z.object({}))
  .call(async (inputs, req, res) => {
    const session = await getServerSessionWithId(req, res)
    if (!session || !session.user) throw new UnauthorizedError()
    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }
    const openai_thread = await (await openai).beta.threads.create()
    const pwb_thread = await db.objects.thread.create({ data: { openai_thread: openai_thread.id, user: session.user.id } })
    return pwb_thread.id
  })
  .build()

export const GPTAssistantMessage = API.post('/api/v1/chat/[thread_id]/messages')
  .query(z.object({ thread_id: z.string() }))
  .body(z.union([
    z.object({
      message: z.string(),
    }),
    z.object({
      step: z.object({ id: z.number() }),
    }),
  ]))
  .call(async (inputs, req, res) => {
    const session = await getServerSessionWithId(req, res)
    if (!session || !session.user) throw new UnauthorizedError()
    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }
    const pwb_thread = await db.objects.thread.findUnique({ where: { id: inputs.query.thread_id } })
    if (!pwb_thread) throw new NotFoundError(inputs.query.thread_id)
    const currentMessages = GPTAssistantMessageParse(
      await db.objects.thread_message.findMany({
        where: { thread: pwb_thread.id },
        orderBy: { created: 'asc' },
      })
    )
    const userMessageQueue = [inputs.body]
    const newMessages: AssistantParsedMessages = []
    while (userMessageQueue.length > 0) {
      const currentUserMessage = userMessageQueue.shift()
      if (!currentUserMessage) return
      const { all_nodes, workflow, max_id } = AssembleState([...currentMessages, ...newMessages])
      if ('step' in currentUserMessage) workflow.push(all_nodes[currentUserMessage.step.id])
      const lastProcess = workflow[workflow.length-1]
      const last = lastProcess ? krg.getProcessNode(lastProcess.name).output.spec : ''
      const id = count(max_id+1)
      const selections: Record<string, { process: typeof workflow[0], processNode: ProcessMetaNode }> = {}
      workflow.forEach(item => {
        if (item === undefined) return
        // add this to the selections
        selections[item.id] = { process: item, processNode: krg.getProcessNode(item.name) }
        // if a selection previously registered is a parent of this selection, remove it from selections
        dict.values(item.inputs).forEach(k => {
          if (k.id in selections) delete selections[k.id]
        })
      })
      const choices = krg.getNextProcess(last)
        .filter(item => item.meta.hidden !== true)
        .filter(item => array.all(
          dict.values(item.inputs).map((value) => {
            if (Array.isArray(value)) {
              return dict.values(selections).filter(selection => selection.processNode.output.spec === value[0].spec).length > 1
            } else {
              return dict.values(selections).filter(selection => selection.processNode.output.spec === value.spec).length >= 1
            }
          })
        ))
        .map(item => {
          const inputs: Record<string, { id: number }> = {}
          dict.items(item.inputs).forEach(({ key: arg, value: input }) => {
            if (Array.isArray(input)) {
              dict.values(selections)
                .filter(selection => selection.processNode.output.spec === input[0].spec)
                .forEach((selection, i) => {
                  inputs[`${arg}:${i}`] = { id: selection.process.id }
                })
            } else {
              const head = { process: workflow[workflow.length-1] }
              const relevantSelections = dict.filter(selections, ({ value: selection }) => selection.processNode.output.spec === input.spec)
              const selection = head.process.id in relevantSelections ? head : array.ensureOne(dict.values(relevantSelections))
              inputs[arg] = { id: selection.process.id }
            }
          })
          return {
            id: id.next(), name: item.spec, inputs,
            type: 'prompt' in item ? 'prompt' : 'resolver', label: item.meta.label,
            description: item.meta.description, ...item.story({}),
          }
        })
      const userMessage = await (await openai).beta.threads.messages.create(pwb_thread.openai_thread, {
        role: 'user',
        content: JSON.stringify({
          ...currentUserMessage,
          choices,
        }),
      })
      newMessages.push({
        id: '',
        ...currentUserMessage,
        role: 'user',
        choices,
      })

      let run = await (await openai).beta.threads.runs.create(pwb_thread.openai_thread, { assistant_id: (await assistant).id })
      while (run.status !== 'completed') {
        await new Promise<void>((resolve, reject) => {setTimeout(() => {resolve()}, 500)})
        run = await (await openai).beta.threads.runs.retrieve(pwb_thread.openai_thread, run.id)
        if (run.status === 'completed') {
          // send all new messages since the user's message to the user
          newMessages.push(...GPTAssistantMessageParse(
            (await (await openai).beta.threads.messages.list(pwb_thread.openai_thread, { after: userMessage.id, order: 'asc' })).data
              .flatMap(msg => {
                const content = msg.content.flatMap(content => content.type === 'text' ? [content.text.value] : []).join('\n')
                return { id: '', role: msg.role, content }
              })
          ))
          const lastMessage = newMessages[newMessages.length-1]
          if (lastMessage.role === 'assistant' && lastMessage.suggestions.length === 1) {
            userMessageQueue.push({ step: lastMessage.suggestions[0] })
          }
        } else if (run.status === 'in_progress' || run.status === 'queued') {
          continue
        } else {
          throw new ResponseCodedError(500, 'An OpenAI error occurred, try again later')
        }
      }
    }

    // upload new messages & update FPL
    const processArrayLookup: Record<string|number, string> = {}
    let max_id = 0
    const all_nodes: Record<number, { id: number, name: string, value?: string, inputs: Record<string, { id: number }> }> = {}
    const workflow: { id: number, name: string, value?: string, inputs: Record<string, { id: number }> }[] = []
    let head: FPL | undefined = undefined
    for (const { role, ...message } of [...currentMessages, ...newMessages]) {
      if ('step' in message) {
        const component = all_nodes[message.step.id]
        component.value = message.step.value
        workflow.push(component)
        const metanode = krg.getProcessNode(component.name)

        const proc: {
          type: string,
          inputs?: Record<string, { id: string }>,
          data?: { type: string, value: string }
        } = { type: metanode.spec }
        if (component.value) proc.data = { type: metanode.output.spec, value: component.value }
        if (!dict.isEmpty(component.inputs)) {
          proc.inputs = {}
          for (const k in component.inputs) {
            if (!(component.inputs[k].id in processArrayLookup)) throw new ResponseCodedError(400, `${component.inputs[k].id} not found in preceeding graph`)
            proc.inputs[k] = {id: processArrayLookup[component.inputs[k].id]}
          }
        }
        const resolvedProc = await fpprg.resolveProcess(proc)
        processArrayLookup[component.id] = resolvedProc.id
        head = new FPL(resolvedProc, head)
      }
      if ('choices' in message && message.choices) {
        message.choices.forEach(choice => {
          all_nodes[+choice.id] = choice
          max_id = Math.max(max_id, +choice.id)
        })
      }
      if (!message.id) {
        if (head) head = await fpprg.upsertFPL(head)
        const pwb_thread_message = await db.objects.thread_message.create({
          data: {
            thread: pwb_thread.id,
            fpl: head?.id ?? null,
            role,
            content: JSON.stringify(message),
          }
        })
        Object.assign(message, { id: pwb_thread_message.id, fpl: pwb_thread_message.fpl })
      }
    }
    return { messages: newMessages, fpl: head?.id ?? null }
  })
  .build()

export const GPTAssistantMessageFeedback = API.post('/api/v1/chat/[thread_id]/messages/[message_id]/feedback')
  .query(z.object({ thread_id: z.string(), message_id: z.string() }))
  .body(z.string())
  .call(async (inputs, req, res) => {
    const session = await getServerSessionWithId(req, res)
    if (!session || !session.user) throw new UnauthorizedError()
    await db.objects.thread_message.update({
      where: { id: inputs.query.message_id, thread: inputs.query.thread_id },
      data: { feedback: inputs.body },
    })
    return null
  })
  .build()

export const GPTAssistantMessagesList = API.get('/api/v1/chat/[thread_id]/messages')
  .query(z.object({ thread_id: z.string() }))
  .call(async (inputs, req, res) => {
    const session = await getServerSessionWithId(req, res)
    if (!session || !session.user) throw new UnauthorizedError()
    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }
    const pwb_thread = await db.objects.thread.findUnique({ where: { id: inputs.query.thread_id } })
    if (!pwb_thread) throw new NotFoundError(inputs.query.thread_id)
    const pwb_thread_messages = await db.objects.thread_message.findMany({ where: { thread: inputs.query.thread_id }, orderBy: { created: 'asc' } })
    return { messages: GPTAssistantMessageParse(pwb_thread_messages), fpl: pwb_thread_messages[pwb_thread_messages.length-1]?.fpl ?? null }
  })
  .build()

export const GPTAssistantDelete = API.post('/api/v1/chat/[thread_id]/delete')
  .query(z.object({ thread_id: z.string() }))
  .body(z.object({}))
  .call(async (inputs, req, res) => {
    const session = await getServerSessionWithId(req, res)
    if (!session || !session.user) throw new UnauthorizedError()
    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }
    const pwb_thread = await db.objects.thread.findUnique({ where: { id: inputs.query.thread_id } })
    if (!pwb_thread) throw new NotFoundError(inputs.query.thread_id)
    pwb_thread.openai_thread
    await (await openai).beta.threads.del(pwb_thread.openai_thread)
    await db.objects.thread.delete({ where: { id: inputs.query.thread_id } })
    return null
  })
  .build()
