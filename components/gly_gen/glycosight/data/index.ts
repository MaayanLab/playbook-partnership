import path from 'path'
import { uploadFile } from '@/components/core/file/api/upload'
import type { SessionWithId } from '@/app/pages/api/auth/[...nextauth]'

export const exampleFile = path.resolve(
  process.env.APP_ROOT as string,
  'components',
  'gly_gen',
  'glycosight',
  'data',
  '01CPTAC_OVprospective_G_JHUZ_20160317_QE_r01.mzid.gz',
)

export type UploadExampleFileResponse = Awaited<ReturnType<typeof uploadExampleFile>>

export async function uploadExampleFile(session?: SessionWithId) {
  console.log("=== I've been called! ===")
  return await uploadFile({
    url: `${process.env.PUBLIC_URL}/api/v1/components/data/gly_gen/glycosight/data`,
    filename: '01CPTAC_OVprospective_G_JHUZ_20160317_QE_r01.mzid.gz',
  }, session)
}
