import type { D1DatabaseLike } from './adminPersistence'
import {
  saveCharacterAliasesBatch,
  saveCreatorAliasesBatch,
  saveHomeFeaturedSearchKeywords,
  saveKeywordAliasesBatch,
} from './adminPersistence'

export const LEGACY_PASSTHROUGH = 'legacy_passthrough' as const

interface ApiState {
  status: 'success' | 'error'
  message: string
}

interface Env {
  DB?: unknown
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

function success(message: string) {
  return json({
    status: 'success',
    message,
  } satisfies ApiState)
}

function failure(message: string, status = 400) {
  return json({
    status: 'error',
    message,
  } satisfies ApiState, status)
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  const payload = await request.json() as unknown
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
}

function parseStructuredArray<T>(value: unknown, fallbackFieldValue?: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  const rawValue = fallbackFieldValue ?? value ?? '[]'
  const parsed = JSON.parse(String(rawValue)) as unknown
  return Array.isArray(parsed) ? parsed as T[] : []
}

function resolveD1Database(value: unknown): D1DatabaseLike | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as { prepare?: unknown }
  if (typeof candidate.prepare !== 'function') {
    return null
  }

  return value as D1DatabaseLike
}

async function handleCreatorAliasesBatchWrite(request: Request, env: Env) {
  if (request.method !== 'POST') {
    return null
  }

  const { pathname } = new URL(request.url)
  if (pathname !== '/api/admin/aliases/batch') {
    return null
  }

  const db = resolveD1Database(env.DB)
  if (!db) {
    return LEGACY_PASSTHROUGH
  }

  try {
    const body = await parseJsonBody(request)
    const parsedRows = parseStructuredArray<{
      creatorName?: string
      alias?: string
      aliases?: string[] | string
    }>(body.rows, body.rowsJson)

    const rows = parsedRows.map(row => ({
      creatorName: row.creatorName ?? '',
      aliases: row.aliases ?? row.alias ?? '',
    }))

    await saveCreatorAliasesBatch(db, rows)
    return success('Creator aliases saved.')
  }
  catch (error) {
    return failure(error instanceof Error ? error.message : 'Failed to save creator aliases.')
  }
}

async function handleCharacterAliasesBatchWrite(request: Request, env: Env) {
  if (request.method !== 'POST') {
    return null
  }

  const { pathname } = new URL(request.url)
  if (pathname !== '/api/admin/character-aliases/batch') {
    return null
  }

  const db = resolveD1Database(env.DB)
  if (!db) {
    return LEGACY_PASSTHROUGH
  }

  try {
    const body = await parseJsonBody(request)
    const parsedRows = parseStructuredArray<{
      characterName?: string
      alias?: string
      aliases?: string[] | string
    }>(body.rows, body.rowsJson)

    const rows = parsedRows.map(row => ({
      characterName: row.characterName ?? '',
      aliases: row.aliases ?? row.alias ?? '',
    }))

    await saveCharacterAliasesBatch(db, rows)
    return success('Character aliases saved.')
  }
  catch (error) {
    return failure(error instanceof Error ? error.message : 'Failed to save character aliases.')
  }
}

async function handleKeywordAliasesBatchWrite(request: Request, env: Env) {
  if (request.method !== 'POST') {
    return null
  }

  const { pathname } = new URL(request.url)
  if (pathname !== '/api/admin/keyword-aliases/batch') {
    return null
  }

  const db = resolveD1Database(env.DB)
  if (!db) {
    return LEGACY_PASSTHROUGH
  }

  try {
    const body = await parseJsonBody(request)
    const parsedRows = parseStructuredArray<{
      baseKeyword?: string
      alias?: string
      aliases?: string[] | string
    }>(body.rows, body.rowsJson)

    const rows = parsedRows.map(row => ({
      baseKeyword: row.baseKeyword ?? '',
      aliases: row.aliases ?? row.alias ?? '',
    }))

    await saveKeywordAliasesBatch(db, rows)
    return success('Keyword aliases saved.')
  }
  catch (error) {
    return failure(error instanceof Error ? error.message : 'Failed to save keyword aliases.')
  }
}

async function handleSuggestionWrite(request: Request, env: Env) {
  if (request.method !== 'POST') {
    return null
  }

  const { pathname } = new URL(request.url)
  if (pathname !== '/api/admin/suggestion') {
    return null
  }

  const db = resolveD1Database(env.DB)
  if (!db) {
    return LEGACY_PASSTHROUGH
  }

  try {
    const body = await parseJsonBody(request)
    const keywords = parseStructuredArray<unknown>(body.keywords, body.keywordsJson).map(String)

    await saveHomeFeaturedSearchKeywords(db, keywords)
    return success('Home featured keywords saved.')
  }
  catch (error) {
    return failure(error instanceof Error ? error.message : 'Failed to save home featured keywords.')
  }
}

export async function handleAdminWriteRequest(request: Request, env: Env) {
  const creatorAliasesBatchResponse = await handleCreatorAliasesBatchWrite(request, env)
  if (creatorAliasesBatchResponse) {
    return creatorAliasesBatchResponse
  }

  const characterAliasesBatchResponse = await handleCharacterAliasesBatchWrite(request, env)
  if (characterAliasesBatchResponse) {
    return characterAliasesBatchResponse
  }

  const keywordAliasesBatchResponse = await handleKeywordAliasesBatchWrite(request, env)
  if (keywordAliasesBatchResponse) {
    return keywordAliasesBatchResponse
  }

  const suggestionWriteResponse = await handleSuggestionWrite(request, env)
  if (suggestionWriteResponse) {
    return suggestionWriteResponse
  }

  const { pathname } = new URL(request.url)

  if (request.method === 'POST' && pathname === '/api/admin/assets/refresh') {
    return success('Runtime assets are generated on demand. Refresh is no longer required.')
  }

  return null
}
