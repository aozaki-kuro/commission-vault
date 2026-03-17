interface AssetFetcher {
  fetch: (request: Request) => Promise<Response>
}

interface D1DatabaseLike {}

interface R2BucketLike {}

export interface Env {
  ASSETS: AssetFetcher
  DB?: D1DatabaseLike
  IMAGES?: R2BucketLike
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  ADMIN_REALM?: string
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function unauthorized(realm: string) {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function isAuthorized(request: Request, env: Env) {
  const expectedUser = env.ADMIN_USERNAME ?? ''
  const expectedPassword = env.ADMIN_PASSWORD ?? ''

  if (!expectedUser || !expectedPassword) {
    return false
  }

  const header = request.headers.get('authorization')
  if (!header || !header.startsWith('Basic ')) {
    return false
  }

  const base64Value = header.slice('Basic '.length)
  let decoded = ''
  try {
    decoded = atob(base64Value)
  }
  catch {
    return false
  }

  const separatorIndex = decoded.indexOf(':')
  if (separatorIndex < 0) {
    return false
  }

  const username = decoded.slice(0, separatorIndex)
  const password = decoded.slice(separatorIndex + 1)

  return username === expectedUser && password === expectedPassword
}

async function handleApi(request: Request) {
  const { pathname } = new URL(request.url)

  if (request.method === 'GET' && pathname === '/api/admin/health') {
    return json({
      status: 'ok',
      message: 'admin worker scaffold is running',
    })
  }

  return json({
    status: 'error',
    message: 'Not Found',
  }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const realm = env.ADMIN_REALM ?? 'admin.crystallize.cc'

    if (!isAuthorized(request, env)) {
      return unauthorized(realm)
    }

    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/admin/')) {
      return handleApi(request)
    }

    return env.ASSETS.fetch(request)
  },
}
