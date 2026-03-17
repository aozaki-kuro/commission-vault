interface D1DatabaseLike {}

interface R2BucketLike {}

export interface AdminWorkerEnv {
  DB?: D1DatabaseLike
  IMAGES?: R2BucketLike
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  ADMIN_REALM?: string
}

export function buildJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
