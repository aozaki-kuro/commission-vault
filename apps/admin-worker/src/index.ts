import type { Env as AdminApiEnv } from './adminApi'
import { handleAdminApiRequest } from './adminApi'

interface AssetFetcher {
  fetch: (request: Request) => Promise<Response>
}

interface D1DatabaseLike {}

interface R2BucketLike {}

export interface Env extends AdminApiEnv {
  ASSETS: AssetFetcher
  DB?: D1DatabaseLike
  IMAGES?: R2BucketLike
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  ADMIN_REALM?: string
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

function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

function isLocalHostname(value: string | null) {
  if (!value) {
    return false
  }

  const hostname = value.toLowerCase().split(':')[0] ?? ''

  return hostname === '127.0.0.1'
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
}

function isLocalDevelopmentRequest(request: Request) {
  const { hostname, protocol } = new URL(request.url)

  return protocol === 'http:'
    || isLocalHostname(hostname)
    || isLocalHostname(request.headers.get('host'))
    || isLocalHostname(request.headers.get('x-forwarded-host'))
}

function getAllowedCorsOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) {
    return null
  }

  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)

    if (originUrl.origin === requestUrl.origin) {
      return originUrl.origin
    }

    if (isLocalHostname(originUrl.hostname)) {
      return originUrl.origin
    }
  }
  catch {
    return null
  }

  return null
}

function withCorsHeaders(request: Request, response: Response) {
  const allowedOrigin = getAllowedCorsOrigin(request)
  if (!allowedOrigin) {
    return response
  }

  const headers = new Headers(response.headers)
  const requestedHeaders = request.headers.get('access-control-request-headers')

  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', requestedHeaders ?? 'Authorization, Content-Type')
  headers.append('Vary', 'Origin')

  return new Response(response.body, {
    status: response.status,
    headers,
  })
}

function isAuthorized(request: Request, env: Env) {
  const expectedUser = env.ADMIN_USERNAME ?? ''
  const expectedPassword = env.ADMIN_PASSWORD ?? ''

  if (!expectedUser || !expectedPassword) {
    return isLocalDevelopmentRequest(request)
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const realm = env.ADMIN_REALM ?? 'admin.crystallize.cc'
    const { pathname } = new URL(request.url)

    if (request.method === 'OPTIONS' && pathname.startsWith('/api/admin/')) {
      return withCorsHeaders(request, noContent())
    }

    if (!isAuthorized(request, env)) {
      return withCorsHeaders(request, unauthorized(realm))
    }

    if (pathname.startsWith('/api/admin/')) {
      return withCorsHeaders(request, await handleAdminApiRequest(request, env))
    }

    return env.ASSETS.fetch(request)
  },
}
