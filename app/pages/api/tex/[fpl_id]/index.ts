import krg from '@/app/krg'
import fpprg from '@/app/fpprg'
import db from '@/app/db'
import FPL2tex from '@/core/fpl2tex'
import { z } from 'zod'
import * as dict from '@/utils/dict'
import handler from '@/utils/next-rest'
import { NotFoundError, UnsupportedMethodError } from '@/spec/error'
import { getServerSessionWithId } from '@/app/extensions/next-auth/helpers'

const QueryType = z.object({
  fpl_id: z.string(),
  metadata: z.string().optional().transform(param =>
    param ? z.object({
      title: z.string().optional(),
      description: z.string().optional(),
    }).parse(JSON.parse(param)) : undefined
  ),
})

export default handler(async (req, res) => {
  if (req.method !== 'HEAD' && req.method !== 'GET') throw new UnsupportedMethodError(req.method)
  const { fpl_id, metadata } = QueryType.parse(req.query)
  const fpl = await fpprg.getFPL(fpl_id)
  if (fpl === undefined) throw new NotFoundError()
  if (req.method === 'HEAD') {
    res.status(200).end()
    return
  }
  const session = await getServerSessionWithId(req, res)
  const user = (session && session.user) ? (await db.objects.user.findUnique({ where: { id: session.user.id } })) : undefined
  // @ts-ignore
  const userOrcidAccount = user ? await db.objects.account.findUnique({ where: { userId: user.id, provider: 'orcid' } }) : undefined
  const tex = await FPL2tex({
    krg,
    fpl,
    metadata,
    author: user && user.name !== undefined ? {
      name: user.name,
      ...dict.filter({
        email: user.email,
        affiliation: user.affiliation,
        orcid: userOrcidAccount ? userOrcidAccount.providerAccountId : undefined,
      }),
    } : undefined,
  })
  res.status(200).send(tex)
})
