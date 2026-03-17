import type { FormState } from './formState'
import { getAdminApiUrl } from './adminApi'

export interface AdminApiResponse {
  status: 'success' | 'error'
  message: string
}

interface BatchSavePayload {
  rows: unknown[]
}

function toErrorState(error: unknown, fallback: string): FormState {
  return {
    status: 'error',
    message: error instanceof Error ? error.message : fallback,
  }
}

function parseJsonFormField<T>(formData: FormData, fieldName: string, fallback: T): T {
  try {
    const raw = formData.get(fieldName)?.toString() ?? ''
    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  }
  catch {
    return fallback
  }
}

async function parseResponse(response: Response): Promise<FormState> {
  try {
    const payload = (await response.json()) as Partial<AdminApiResponse> | null
    if (!payload || (payload.status !== 'success' && payload.status !== 'error')) {
      return {
        status: 'error',
        message: response.ok
          ? 'Unexpected response payload.'
          : `Request failed (${response.status}).`,
      }
    }

    return {
      status: payload.status,
      message: payload.message ?? (payload.status === 'success' ? 'Saved.' : 'Request failed.'),
    }
  }
  catch {
    return {
      status: 'error',
      message: response.ok ? 'Failed to parse response.' : `Request failed (${response.status}).`,
    }
  }
}

async function postAdminJson(pathname: string, payload: unknown) {
  const response = await fetch(getAdminApiUrl(pathname), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return parseResponse(response)
}

async function saveAliasesBatchAction(
  pathname: string,
  fallback: string,
  formData: FormData,
): Promise<FormState> {
  try {
    return postAdminJson(pathname, {
      rows: parseJsonFormField<BatchSavePayload['rows']>(formData, 'rowsJson', []),
    })
  }
  catch (error) {
    return toErrorState(error, fallback)
  }
}

export async function saveCreatorAliasesBatchAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _prevState

  return saveAliasesBatchAction('/api/admin/aliases/batch', 'Failed to save aliases.', formData)
}

export async function saveCharacterAliasesBatchAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _prevState

  return saveAliasesBatchAction(
    '/api/admin/character-aliases/batch',
    'Failed to save character aliases.',
    formData,
  )
}

export async function saveKeywordAliasesBatchAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _prevState

  return saveAliasesBatchAction(
    '/api/admin/keyword-aliases/batch',
    'Failed to save keyword aliases.',
    formData,
  )
}

export async function saveHomeFeaturedKeywordsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _prevState

  try {
    return postAdminJson('/api/admin/suggestion', {
      keywords: parseJsonFormField(formData, 'keywordsJson', []),
    })
  }
  catch (error) {
    return toErrorState(error, 'Failed to save featured keywords.')
  }
}
