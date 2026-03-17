interface AssetFetcher {
  fetch: (request: Request) => Promise<Response>
}

interface D1DatabaseLike {}

interface R2BucketLike {}

export interface Env {
  ASSETS: AssetFetcher
  DB?: D1DatabaseLike
  IMAGES?: R2BucketLike
  LEGACY_ADMIN_API_BASE_URL?: string
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  ADMIN_REALM?: string
}

const TRAILING_SLASH_PATTERN = /\/+$/
const CHARACTER_ITEM_PATH_PATTERN = /^\/api\/admin\/characters\/\d+$/
const CHARACTER_COMMISSIONS_PATH_PATTERN = /^\/api\/admin\/characters\/\d+\/commissions$/
const COMMISSION_ITEM_PATH_PATTERN = /^\/api\/admin\/commissions\/\d+$/
const COMMISSION_SOURCE_IMAGE_PATH_PATTERN = /^\/api\/admin\/commissions\/\d+\/source-image$/

interface LegacyBridgeRoute {
  matches: (pathname: string) => boolean
  methods: Set<string>
}

function buildMethodSet(methods: string[]) {
  return new Set(methods)
}

const LEGACY_BRIDGED_ROUTES: LegacyBridgeRoute[] = [
  {
    matches: pathname => pathname === '/api/admin/bootstrap',
    methods: buildMethodSet(['GET']),
  },
  {
    matches: pathname => pathname === '/api/admin/characters',
    methods: buildMethodSet(['POST']),
  },
  {
    matches: pathname => pathname === '/api/admin/characters/order',
    methods: buildMethodSet(['PUT']),
  },
  {
    matches: pathname => CHARACTER_ITEM_PATH_PATTERN.test(pathname),
    methods: buildMethodSet(['PATCH', 'DELETE']),
  },
  {
    matches: pathname => CHARACTER_COMMISSIONS_PATH_PATTERN.test(pathname),
    methods: buildMethodSet(['GET']),
  },
  {
    matches: pathname => pathname === '/api/admin/commissions',
    methods: buildMethodSet(['POST']),
  },
  {
    matches: pathname => COMMISSION_ITEM_PATH_PATTERN.test(pathname),
    methods: buildMethodSet(['PATCH', 'DELETE']),
  },
  {
    matches: pathname => COMMISSION_SOURCE_IMAGE_PATH_PATTERN.test(pathname),
    methods: buildMethodSet(['POST']),
  },
  {
    matches: pathname => pathname.startsWith('/api/admin/source-image/'),
    methods: buildMethodSet(['GET']),
  },
  {
    matches: pathname => pathname === '/api/admin/aliases/bootstrap',
    methods: buildMethodSet(['GET']),
  },
  {
    matches: pathname => pathname === '/api/admin/aliases/batch',
    methods: buildMethodSet(['POST']),
  },
  {
    matches: pathname => pathname === '/api/admin/character-aliases/batch',
    methods: buildMethodSet(['POST']),
  },
  {
    matches: pathname => pathname === '/api/admin/keyword-aliases/batch',
    methods: buildMethodSet(['POST']),
  },
  {
    matches: pathname => pathname === '/api/admin/suggestion',
    methods: buildMethodSet(['GET', 'POST']),
  },
  {
    matches: pathname => pathname === '/api/admin/assets/refresh',
    methods: buildMethodSet(['POST']),
  },
]

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

function getLegacyAdminUrl(request: Request, env: Env) {
  const baseUrl = env.LEGACY_ADMIN_API_BASE_URL?.trim()
  if (!baseUrl) {
    return null
  }

  const requestUrl = new URL(request.url)
  return new URL(`${requestUrl.pathname}${requestUrl.search}`, `${baseUrl.replace(TRAILING_SLASH_PATTERN, '')}/`)
}

function getProxyRequestHeaders(request: Request) {
  const headers = new Headers()
  const accept = request.headers.get('accept')
  const contentType = request.headers.get('content-type')

  if (accept) {
    headers.set('accept', accept)
  }

  if (contentType) {
    headers.set('content-type', contentType)
  }

  return headers
}

async function proxyLegacyAdminRequest(request: Request, env: Env) {
  const targetUrl = getLegacyAdminUrl(request, env)
  if (!targetUrl) {
    return json({
      status: 'error',
      message: 'Legacy admin API bridge is not configured.',
    }, 503)
  }

  try {
    const bodyBuffer = request.method === 'GET' || request.method === 'HEAD'
      ? null
      : await request.arrayBuffer()
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: getProxyRequestHeaders(request),
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: 'manual',
    })
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(response.body, {
      status: response.status,
      headers,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach legacy admin API.'
    return json({
      status: 'error',
      message,
    }, 502)
  }
}

async function handleApi(request: Request, env: Env) {
  const { pathname } = new URL(request.url)

  if (request.method === 'GET' && pathname === '/api/admin/health') {
    return json({
      status: 'ok',
      message: 'admin worker scaffold is running',
    })
  }

  const shouldBridgeLegacyRequest = LEGACY_BRIDGED_ROUTES.some(route =>
    route.methods.has(request.method) && route.matches(pathname),
  )

  if (shouldBridgeLegacyRequest) {
    return proxyLegacyAdminRequest(request, env)
  }

  return json({
    status: 'error',
    message: 'Not Found',
  }, 404)
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
      return withCorsHeaders(request, await handleApi(request, env))
    }

    return env.ASSETS.fetch(request)
  },
}
