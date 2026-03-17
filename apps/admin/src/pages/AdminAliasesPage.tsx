import type { AdminAliasesData } from '@commission-index/domain'
import { useEffect, useReducer, useState } from 'react'
import { adminSurfaceStyles } from '../app/ui'
import { AdminAliasesDashboard } from '../components/AdminAliasesDashboard'
import { fetchAdminJsonWithRetry } from '../lib/adminApi'

interface AliasesState {
  errorMessage: string | null
  isLoading: boolean
  payload: AdminAliasesData | null
}

type AliasesAction
  = { type: 'loading' }
    | { payload: AdminAliasesData, type: 'loaded' }
    | { message: string, type: 'failed' }

const initialAliasesState: AliasesState = {
  errorMessage: null,
  isLoading: true,
  payload: null,
}

function aliasesReducer(state: AliasesState, action: AliasesAction): AliasesState {
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

export function AdminAliasesPage() {
  const [state, dispatch] = useReducer(aliasesReducer, initialAliasesState)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isDisposed = false

    dispatch({ type: 'loading' })

    void fetchAdminJsonWithRetry<AdminAliasesData>('/api/admin/aliases/bootstrap', {
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
          message: error instanceof Error ? error.message : 'Failed to load alias data.',
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
      <AdminAliasesDashboard
        characters={state.payload.characterAliases}
        creators={state.payload.creatorAliases}
        keywords={state.payload.keywordAliases}
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
            Alias data
          </h2>
          <p className="
            text-xs text-gray-600
            dark:text-gray-300
          "
          >
            {state.isLoading
              ? 'Loading standalone alias data through the admin worker.'
              : state.errorMessage ?? 'Alias data is unavailable.'}
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
