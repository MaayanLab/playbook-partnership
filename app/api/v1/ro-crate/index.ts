import { z } from 'zod'
import { API } from '@/spec/api'
import fpl2roc from '@/core/fpl2ro-crate'
import fpprg from '@/app/fpprg'
import krg from '@/app/krg'
import { NotFoundError } from '@/spec/error'

export const ROCrateForPlaybook = API.get('/api/v1/ro-crate/[fpl_id]')
  .query(z.object({
    fpl_id: z.string(),
  }))
  .call(async (inputs, req, res) => {
    const fpl = await fpprg.getFPL(inputs.query.fpl_id)
    if (fpl === undefined) throw new NotFoundError()
    return await fpl2roc({ krg, fpl })
  })
  .build()
