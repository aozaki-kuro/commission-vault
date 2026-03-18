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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (request.method === 'OPTIONS' && pathname.startsWith('/api/admin/')) {
      return withCorsHeaders(request, noContent())
    }

    if (pathname.startsWith('/api/admin/')) {
      return withCorsHeaders(request, await handleAdminApiRequest(request, env))
    }

    return env.ASSETS.fetch(request)
  },
}
