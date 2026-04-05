import type { HomeSuggestionAdminData } from '@commission-index/domain'
import { useEffect, useEffectEvent, useReducer, useState } from 'react'
import { adminSurfaceStyles } from '../app/ui'
import { AdminSuggestionDashboard } from '../components/AdminSuggestionDashboard'
import { fetchAdminJsonWithRetry, readCachedAdminJson } from '../lib/adminApi'

const suggestionCacheKey = '/api/admin/suggestion'

interface SuggestionState {
  errorMessage: string | null
  isLoading: boolean
  payload: HomeSuggestionAdminData | null
}

type SuggestionAction
  = { type: 'loading' }
    | { payload: HomeSuggestionAdminData, type: 'loaded' }
    | { message: string, type: 'failed' }

function createInitialSuggestionState(): SuggestionState {
  const payload = readCachedAdminJson<HomeSuggestionAdminData>(suggestionCacheKey)

  return {
    errorMessage: null,
    isLoading: payload === null,
    payload,
  }
}

function suggestionReducer(state: SuggestionState, action: SuggestionAction): SuggestionState {
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

export function AdminSuggestionPage() {
  const [state, dispatch] = useReducer(suggestionReducer, undefined, createInitialSuggestionState)
  const [reloadToken, setReloadToken] = useState(0)
  const hasPayload = useEffectEvent(() => state.payload !== null)

  useEffect(() => {
    const controller = new AbortController()
    let isDisposed = false

    if (!hasPayload()) {
      dispatch({ type: 'loading' })
    }

    void fetchAdminJsonWithRetry<HomeSuggestionAdminData>(suggestionCacheKey, {
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
          message: error instanceof Error ? error.message : 'Failed to load suggestion data.',
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
      <AdminSuggestionDashboard
        key={state.payload.featuredKeywords.join('\u0000')}
        featuredKeywords={state.payload.featuredKeywords}
        keywordOptions={state.payload.keywordOptions}
      />
    )
  }

  return (
    <section className={`${adminSurfaceStyles} motion-safe:animate-[tabFade_240ms_cubic-bezier(0.25,1,0.5,1)_both]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2
            className="
              text-sm font-semibold text-gray-900
              dark:text-gray-100
            "
          >
            Suggestion data
          </h2>
          <p
            className="
              text-xs text-gray-600
              dark:text-gray-300
            "
          >
            {state.isLoading
              ? 'Loading standalone suggestion data through the admin worker.'
              : state.errorMessage ?? 'Suggestion data is unavailable.'}
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
