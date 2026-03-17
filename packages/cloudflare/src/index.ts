interface D1DatabaseLike {}

interface R2BucketLike {}

export interface AdminWorkerEnv {
  DB?: D1DatabaseLike
  IMAGES?: R2BucketLike
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  ADMIN_REALM?: string
  LEGACY_ADMIN_API_BASE_URL?: string
}

export function buildJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
