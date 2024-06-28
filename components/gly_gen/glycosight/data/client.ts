
import type { UploadExampleFileResponse } from "."

export async function clientLoadExample(): Promise<UploadExampleFileResponse > {
  // alert("MZID sample upload under development");
  const res = await fetch(`/api/v1/components/gly_gen/glycosight/data`, { method: 'POST' })
  console.log("Return status was ", res.status);
  console.log("Return value was %s", res.body);
  return await res.json()
}
