import type { AdminBootstrapData } from '@commission-index/domain'
import { useEffect, useEffectEvent, useReducer, useState } from 'react'
import { adminSurfaceStyles } from '../app/ui'
import { AdminCreateDashboard } from '../components/AdminCreateDashboard'
import { fetchAdminJsonWithRetry, readCachedAdminJson } from '../lib/adminApi'
import { subscribeToDataUpdates } from '../lib/dataUpdateSignal'

const bootstrapCacheKey = '/api/admin/bootstrap'

interface CreateState {
  errorMessage: string | null
  isLoading: boolean
  payload: AdminBootstrapData | null
}

type CreateAction
  = { type: 'loading' }
    | { payload: AdminBootstrapData, type: 'loaded' }
    | { message: string, type: 'failed' }

function createInitialCreateState(): CreateState {
  const payload = readCachedAdminJson<AdminBootstrapData>(bootstrapCacheKey)

  return {
    errorMessage: null,
    isLoading: payload === null,
    payload,
  }
}

function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case 'loading':
      return {
        ...state,
        errorMessage: null,
        isLoading: true,
      }
    case 'loaded':
      return {
        errorMessage: null,
        isLoading: false,
        payload: action.payload,
      }
    case 'failed':
      return {
        ...state,
        errorMessage: action.message,
        isLoading: false,
      }
  }
}

export function AdminCreatePage() {
  const [state, dispatch] = useReducer(createReducer, undefined, createInitialCreateState)
  const [reloadToken, setReloadToken] = useState(0)
  const hasPayload = useEffectEvent(() => state.payload !== null)

  useEffect(() => subscribeToDataUpdates(() => {
    setReloadToken(token => token + 1)
  }), [])

  useEffect(() => {
    const controller = new AbortController()
    let isDisposed = false

    if (!hasPayload()) {
      dispatch({ type: 'loading' })
    }

    void fetchAdminJsonWithRetry<AdminBootstrapData>(bootstrapCacheKey, {
      signal: controller.signal,
    })
      .then((payload) => {
        if (isDisposed) {
          return
        }

        dispatch({
          payload,
          type: 'loaded',
        })
      })
      .catch((error) => {
        if (isDisposed) {
          return
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        dispatch({
          message: error instanceof Error ? error.message : 'Failed to load admin data.',
          type: 'failed',
        })
      })

    return () => {
      isDisposed = true
      controller.abort()
    }
  }, [reloadToken])

  if (state.payload) {
    return (
      <AdminCreateDashboard
        characters={state.payload.characters.map(character => ({
          id: character.id,
          name: character.name,
          sortOrder: character.sortOrder,
          status: character.status,
        }))}
        commissionSearchRows={state.payload.commissionSearchRows}
      />
    )
  }

  return (
    <section className={adminSurfaceStyles}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="
            text-sm font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            Create data
          </h2>
          <p className="
            text-xs text-gray-600
            dark:text-gray-300
          "
          >
            {state.isLoading
              ? 'Loading standalone create data through the admin worker.'
              : state.errorMessage ?? 'Admin data is unavailable.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReloadToken(token => token + 1)}
          disabled={state.isLoading}
          className="
            rounded-lg border border-gray-300/80 px-3 py-1.5 text-xs font-medium
            text-gray-700 transition
            hover:border-gray-400 hover:text-gray-900
            disabled:pointer-events-none disabled:opacity-50
            dark:border-gray-700 dark:text-gray-200
            dark:hover:border-gray-600 dark:hover:text-gray-100
          "
        >
          {state.isLoading ? 'Loading…' : 'Retry'}
        </button>
      </div>
    </section>
  )
}
