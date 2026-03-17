import { handleAdminReadRequest } from './adminData'
import { handleAdminWriteRequest, LEGACY_PASSTHROUGH } from './adminWriteApi'

const TRAILING_SLASH_PATTERN = /\/+$/

const CHARACTER_ITEM_PATH_PATTERN = /^\/api\/admin\/characters\/\d+$/
const CHARACTER_ITEM_ID_PATTERN = /^\/api\/admin\/characters\/(\d+)$/
const CHARACTER_COMMISSIONS_PATH_PATTERN = /^\/api\/admin\/characters\/\d+\/commissions$/
const CHARACTER_COMMISSIONS_ID_PATTERN = /^\/api\/admin\/characters\/(\d+)\/commissions$/
const COMMISSION_ITEM_PATH_PATTERN = /^\/api\/admin\/commissions\/\d+$/
const COMMISSION_ITEM_ID_PATTERN = /^\/api\/admin\/commissions\/(\d+)$/
const COMMISSION_SOURCE_IMAGE_PATH_PATTERN = /^\/api\/admin\/commissions\/\d+\/source-image$/

interface LegacyBridgeRoute {
  matches: (pathname: string) => boolean
  methods: Set<string>
}

export type CharacterStatus = 'active' | 'stale'

export interface Env {
  LEGACY_ADMIN_API_BASE_URL?: string
  DB?: unknown
  IMAGES?: unknown
}

export interface ApiState {
  status: 'success' | 'error'
  message: string
}

interface CommissionFields {
  characterId: number
  fileName: string
  links: string[]
  design?: string
  description?: string
  keyword?: string
  hidden: boolean
}

export interface CreateCharacterInput {
  name: string
  status: CharacterStatus
}

export interface UpdateCharacterInput extends CreateCharacterInput {
  id: number
}

export interface CharacterOrderPayload {
  active: number[]
  stale: number[]
}

export interface CreateCommissionInput extends CommissionFields {
  sourceImage: File
}

export interface UpdateCommissionInput extends CommissionFields {
  id: number
}

export interface AdminCrudBackend {
  getCharacterCommissions: (characterId: number) => Promise<Response>
  createCharacter: (input: CreateCharacterInput) => Promise<Response>
  updateCharacter: (input: UpdateCharacterInput) => Promise<Response>
  updateCharacterOrder: (payload: CharacterOrderPayload) => Promise<Response>
  deleteCharacter: (id: number) => Promise<Response>
  createCommission: (input: CreateCommissionInput) => Promise<Response>
  updateCommission: (input: UpdateCommissionInput) => Promise<Response>
  deleteCommission: (id: number) => Promise<Response>
}

function buildMethodSet(methods: string[]) {
  return new Set(methods)
}

const LEGACY_PASSTHROUGH_ROUTES: LegacyBridgeRoute[] = [
  {
    matches: pathname => pathname === '/api/admin/bootstrap',
    methods: buildMethodSet(['GET']),
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
    matches: pathname => pathname === '/api/admin/suggestion',
    methods: buildMethodSet(['GET']),
  },
  {
    matches: pathname => COMMISSION_SOURCE_IMAGE_PATH_PATTERN.test(pathname),
    methods: buildMethodSet(['POST']),
  },
]

class LegacyAdminRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'LegacyAdminRequestError'
  }
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

function notFound() {
  return json({
    status: 'error',
    message: 'Not Found',
  }, 404)
}

function failure(message: string, status = 400) {
  return json({
    status: 'error',
    message,
  } satisfies ApiState, status)
}

function withNoStoreHeaders(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')

  return new Response(response.body, {
    status: response.status,
    headers,
  })
}

function resolveLegacyAdminUrl(env: Env, pathname: string, search = '') {
  const baseUrl = env.LEGACY_ADMIN_API_BASE_URL?.trim()
  if (!baseUrl) {
    throw new LegacyAdminRequestError('Legacy admin API bridge is not configured.', 503)
  }

  return new URL(`${pathname}${search}`, `${baseUrl.replace(TRAILING_SLASH_PATTERN, '')}/`)
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

async function forwardLegacyRequest(
  env: Env,
  pathname: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
) {
  try {
    const targetUrl = resolveLegacyAdminUrl(env, pathname)
    const response = await fetchImpl(targetUrl, {
      ...init,
      redirect: 'manual',
    })

    return withNoStoreHeaders(response)
  }
  catch (error) {
    if (error instanceof LegacyAdminRequestError) {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Failed to reach legacy admin API.'
    throw new LegacyAdminRequestError(message, 502)
  }
}

async function proxyLegacyAdminRequest(request: Request, env: Env, fetchImpl: typeof fetch = fetch) {
  try {
    const requestUrl = new URL(request.url)
    const targetUrl = resolveLegacyAdminUrl(env, requestUrl.pathname, requestUrl.search)
    const bodyBuffer = request.method === 'GET' || request.method === 'HEAD'
      ? null
      : await request.arrayBuffer()

    const response = await fetchImpl(targetUrl, {
      method: request.method,
      headers: getProxyRequestHeaders(request),
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: 'manual',
    })

    return withNoStoreHeaders(response)
  }
  catch (error) {
    if (error instanceof LegacyAdminRequestError) {
      return json({
        status: 'error',
        message: error.message,
      }, error.status)
    }

    const message = error instanceof Error ? error.message : 'Failed to reach legacy admin API.'
    return json({
      status: 'error',
      message,
    }, 502)
  }
}

function parseLinks(rawValue: string) {
  return rawValue
    .split('\n')
    .map(link => link.trim())
    .filter(Boolean)
}

function parseOptionalField(rawValue: string) {
  return rawValue.trim() || undefined
}

function parseCharacterStatus(value: unknown): CharacterStatus {
  return String(value) === 'stale' ? 'stale' : 'active'
}

function parseCommissionFields(input: {
  characterId: number
  fileName: string
  links: string
  design: string
  description: string
  keyword: string
  hidden: boolean
}): CommissionFields {
  return {
    characterId: input.characterId,
    fileName: input.fileName.trim(),
    links: parseLinks(input.links),
    design: parseOptionalField(input.design),
    description: parseOptionalField(input.description),
    keyword: parseOptionalField(input.keyword),
    hidden: input.hidden,
  }
}

function parseCommissionFieldsFromForm(formData: FormData) {
  return parseCommissionFields({
    characterId: Number(formData.get('characterId')),
    fileName: formData.get('fileName')?.toString() ?? '',
    links: formData.get('links')?.toString() ?? '',
    design: formData.get('design')?.toString() ?? '',
    description: formData.get('description')?.toString() ?? '',
    keyword: formData.get('keyword')?.toString() ?? '',
    hidden: formData.get('hidden') === 'on',
  })
}

function parseCommissionFieldsFromJson(payload: Record<string, unknown>) {
  return parseCommissionFields({
    characterId: Number(payload.characterId),
    fileName: String(payload.fileName ?? ''),
    links: String(payload.links ?? ''),
    design: String(payload.design ?? ''),
    description: String(payload.description ?? ''),
    keyword: String(payload.keyword ?? ''),
    hidden: Boolean(payload.hidden),
  })
}

function validateCommissionFields(fields: Pick<CommissionFields, 'characterId' | 'fileName'>) {
  if (!Number.isFinite(fields.characterId) || fields.characterId <= 0) {
    return 'Character selection is required.'
  }

  if (!fields.fileName) {
    return 'File name is required.'
  }

  return null
}

function parseIdFromPath(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern)
  if (!match) {
    return null
  }

  const id = Number(match[1])
  return Number.isFinite(id) && id > 0 ? id : null
}

function getUploadedSourceImage(formData: FormData) {
  const entry = formData.get('sourceImage')
  if (!(entry instanceof File)) {
    return null
  }

  if (!entry.name.trim() || entry.size <= 0) {
    return null
  }

  return entry
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  const payload = await request.json() as unknown
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
}

function buildCommissionFormData(input: CreateCommissionInput) {
  const formData = new FormData()
  formData.set('characterId', String(input.characterId))
  formData.set('fileName', input.fileName)
  formData.set('links', input.links.join('\n'))
  formData.set('design', input.design ?? '')
  formData.set('description', input.description ?? '')
  formData.set('keyword', input.keyword ?? '')

  if (input.hidden) {
    formData.set('hidden', 'on')
  }

  formData.set('sourceImage', input.sourceImage, input.sourceImage.name)
  return formData
}

async function handleCrudBackendRequest(operation: () => Promise<Response>) {
  try {
    return await operation()
  }
  catch (error) {
    if (error instanceof LegacyAdminRequestError) {
      return json({
        status: 'error',
        message: error.message,
      }, error.status)
    }

    const message = error instanceof Error ? error.message : 'Failed to reach legacy admin API.'
    return json({
      status: 'error',
      message,
    }, 502)
  }
}

export function createLegacyCrudBackend(env: Env, fetchImpl: typeof fetch = fetch): AdminCrudBackend {
  return {
    getCharacterCommissions(characterId) {
      return forwardLegacyRequest(
        env,
        `/api/admin/characters/${characterId}/commissions`,
        { method: 'GET' },
        fetchImpl,
      )
    },
    createCharacter(input) {
      return forwardLegacyRequest(
        env,
        '/api/admin/characters',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
        fetchImpl,
      )
    },
    updateCharacter(input) {
      return forwardLegacyRequest(
        env,
        `/api/admin/characters/${input.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: input.name,
            status: input.status,
          }),
        },
        fetchImpl,
      )
    },
    updateCharacterOrder(payload) {
      return forwardLegacyRequest(
        env,
        '/api/admin/characters/order',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        fetchImpl,
      )
    },
    deleteCharacter(id) {
      return forwardLegacyRequest(
        env,
        `/api/admin/characters/${id}`,
        { method: 'DELETE' },
        fetchImpl,
      )
    },
    createCommission(input) {
      return forwardLegacyRequest(
        env,
        '/api/admin/commissions',
        {
          method: 'POST',
          body: buildCommissionFormData(input),
        },
        fetchImpl,
      )
    },
    updateCommission(input) {
      return forwardLegacyRequest(
        env,
        `/api/admin/commissions/${input.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            characterId: input.characterId,
            fileName: input.fileName,
            links: input.links.join('\n'),
            design: input.design ?? '',
            description: input.description ?? '',
            keyword: input.keyword ?? '',
            hidden: input.hidden,
          }),
        },
        fetchImpl,
      )
    },
    deleteCommission(id) {
      return forwardLegacyRequest(
        env,
        `/api/admin/commissions/${id}`,
        { method: 'DELETE' },
        fetchImpl,
      )
    },
  }
}

async function handleCrudRequest(request: Request, backend: AdminCrudBackend) {
  const { pathname } = new URL(request.url)

  if (request.method === 'GET' && CHARACTER_COMMISSIONS_PATH_PATTERN.test(pathname)) {
    const id = parseIdFromPath(pathname, CHARACTER_COMMISSIONS_ID_PATTERN)
    if (!id) {
      return failure('Invalid character identifier.')
    }

    return handleCrudBackendRequest(() => backend.getCharacterCommissions(id))
  }

  if (request.method === 'POST' && pathname === '/api/admin/characters') {
    const body = await parseJsonBody(request)
    const name = String(body.name ?? '').trim()
    if (!name) {
      return failure('Character name is required.')
    }

    return handleCrudBackendRequest(() => backend.createCharacter({
      name,
      status: parseCharacterStatus(body.status),
    }))
  }

  if (request.method === 'PATCH' && CHARACTER_ITEM_PATH_PATTERN.test(pathname)) {
    const id = parseIdFromPath(pathname, CHARACTER_ITEM_ID_PATTERN)
    if (!id) {
      return failure('Invalid character identifier.')
    }

    const body = await parseJsonBody(request)
    const name = String(body.name ?? '').trim()
    if (!name) {
      return failure('Character name is required.')
    }

    return handleCrudBackendRequest(() => backend.updateCharacter({
      id,
      name,
      status: parseCharacterStatus(body.status),
    }))
  }

  if (request.method === 'PUT' && pathname === '/api/admin/characters/order') {
    const body = await parseJsonBody(request)
    return handleCrudBackendRequest(() => backend.updateCharacterOrder({
      active: Array.isArray(body.active) ? body.active.map(Number) : [],
      stale: Array.isArray(body.stale) ? body.stale.map(Number) : [],
    }))
  }

  if (request.method === 'DELETE' && CHARACTER_ITEM_PATH_PATTERN.test(pathname)) {
    const id = parseIdFromPath(pathname, CHARACTER_ITEM_ID_PATTERN)
    if (!id) {
      return failure('Invalid character identifier.')
    }

    return handleCrudBackendRequest(() => backend.deleteCharacter(id))
  }

  if (request.method === 'POST' && pathname === '/api/admin/commissions') {
    const formData = await request.formData()
    const fields = parseCommissionFieldsFromForm(formData)
    const validation = validateCommissionFields(fields)
    if (validation) {
      return failure(validation)
    }

    const sourceImage = getUploadedSourceImage(formData)
    if (!sourceImage) {
      return failure('Source image is required for new commission entries.')
    }

    return handleCrudBackendRequest(() => backend.createCommission({
      ...fields,
      sourceImage,
    }))
  }

  if (request.method === 'PATCH' && COMMISSION_ITEM_PATH_PATTERN.test(pathname)) {
    const id = parseIdFromPath(pathname, COMMISSION_ITEM_ID_PATTERN)
    if (!id) {
      return failure('Invalid commission identifier.')
    }

    const body = await parseJsonBody(request)
    const fields = parseCommissionFieldsFromJson(body)
    const validation = validateCommissionFields(fields)
    if (validation) {
      return failure(validation)
    }

    return handleCrudBackendRequest(() => backend.updateCommission({
      id,
      ...fields,
    }))
  }

  if (request.method === 'DELETE' && COMMISSION_ITEM_PATH_PATTERN.test(pathname)) {
    const id = parseIdFromPath(pathname, COMMISSION_ITEM_ID_PATTERN)
    if (!id) {
      return failure('Invalid commission identifier.')
    }

    return handleCrudBackendRequest(() => backend.deleteCommission(id))
  }

  return null
}

export async function handleAdminApiRequest(
  request: Request,
  env: Env,
  backend: AdminCrudBackend = createLegacyCrudBackend(env),
  fetchImpl: typeof fetch = fetch,
) {
  const { pathname } = new URL(request.url)

  if (request.method === 'GET' && pathname === '/api/admin/health') {
    return json({
      status: 'ok',
      message: 'admin worker scaffold is running',
    })
  }

  const nativeReadResponse = await handleAdminReadRequest(request, env)
  if (nativeReadResponse) {
    return nativeReadResponse
  }

  const nativeCrudResponse = await handleCrudRequest(request, backend)
  if (nativeCrudResponse) {
    return nativeCrudResponse
  }

  const nativeWriteResponse = await handleAdminWriteRequest(request, env)
  if (nativeWriteResponse === LEGACY_PASSTHROUGH) {
    return proxyLegacyAdminRequest(request, env, fetchImpl)
  }

  if (nativeWriteResponse) {
    return nativeWriteResponse
  }

  const shouldPassthroughLegacyRequest = LEGACY_PASSTHROUGH_ROUTES.some(route =>
    route.methods.has(request.method) && route.matches(pathname),
  )

  if (shouldPassthroughLegacyRequest) {
    return proxyLegacyAdminRequest(request, env, fetchImpl)
  }

  return notFound()
}
