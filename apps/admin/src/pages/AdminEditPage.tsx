import type { AdminBootstrapData } from '@commission-index/domain'
import { useEffect, useReducer, useState } from 'react'
import { adminSurfaceStyles } from '../app/ui'
import { AdminEditDashboard } from '../components/AdminEditDashboard'
import { fetchAdminJsonWithRetry } from '../lib/adminApi'
import { subscribeToDataUpdates } from '../lib/dataUpdateSignal'

const scrollStorageKey = 'admin-dashboard-scroll'
const scrollExpiryMs = 10 * 60 * 1000
const scrollPersistThrottleMs = 200

interface EditState {
  errorMessage: string | null
  isLoading: boolean
  payload: AdminBootstrapData | null
}

interface StoredScrollState {
  timestamp: number
  top: number
}

type EditAction
  = { type: 'loading' }
    | { payload: AdminBootstrapData, type: 'loaded' }
    | { message: string, type: 'failed' }

const initialEditState: EditState = {
  errorMessage: null,
  isLoading: true,
  payload: null,
}

function getCurrentScrollTop() {
  return Math.max(window.scrollY, window.pageYOffset, 0)
}

function isReloadNavigation() {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return false
  }

  const navigationEntry = performance.getEntriesByType('navigation')[0]
  return navigationEntry instanceof PerformanceNavigationTiming
    ? navigationEntry.type === 'reload'
    : false
}

function readStoredScrollTop(): number | null {
  if (typeof window === 'undefined' || !isReloadNavigation()) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(scrollStorageKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<StoredScrollState>
    const timestamp = Number(parsed.timestamp)
    const top = Number(parsed.top)
    if (!Number.isFinite(timestamp) || !Number.isFinite(top)) {
      return null
    }

    if (Date.now() - timestamp > scrollExpiryMs) {
      return null
    }

    return Math.max(0, top)
  }
  catch {
    return null
  }
}

function writeStoredScrollTop() {
  if (typeof window === 'undefined') {
    return
  }

  const state: StoredScrollState = {
    timestamp: Date.now(),
    top: getCurrentScrollTop(),
  }
  window.sessionStorage.setItem(scrollStorageKey, JSON.stringify(state))
}

function editReducer(state: EditState, action: EditAction): EditState {
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

export function AdminEditPage() {
  const [state, dispatch] = useReducer(editReducer, initialEditState)
  const [reloadToken, setReloadToken] = useState(0)
  const [pendingScrollTop] = useState<number | null>(() => readStoredScrollTop())
  const [hasRestoredScroll, setHasRestoredScroll] = useState(false)

  useEffect(() => subscribeToDataUpdates(() => {
    setReloadToken(token => token + 1)
  }), [])

  useEffect(() => {
    const controller = new AbortController()
    let isDisposed = false

    dispatch({ type: 'loading' })

    void fetchAdminJsonWithRetry<AdminBootstrapData>('/api/admin/bootstrap', {
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let timeoutId: number | null = null

    const persistNow = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      writeStoredScrollTop()
    }

    const schedulePersist = () => {
      if (timeoutId !== null) {
        return
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null
        writeStoredScrollTop()
      }, scrollPersistThrottleMs)
    }

    persistNow()
    window.addEventListener('scroll', schedulePersist, { passive: true })
    window.addEventListener('pagehide', persistNow)
    window.addEventListener('beforeunload', persistNow)

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }

      window.removeEventListener('scroll', schedulePersist)
      window.removeEventListener('pagehide', persistNow)
      window.removeEventListener('beforeunload', persistNow)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (pendingScrollTop === null || hasRestoredScroll || !state.payload) {
      return
    }

    let frameId: number | null = null
    let attempts = 0

    const restore = () => {
      attempts += 1
      window.scrollTo({
        behavior: 'auto',
        top: pendingScrollTop,
      })

      const maxScrollTop = Math.max(
        0,
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          document.documentElement.offsetHeight,
          document.body.offsetHeight,
        ) - window.innerHeight,
      )
      const targetTop = Math.min(pendingScrollTop, maxScrollTop)
      if (Math.abs(getCurrentScrollTop() - targetTop) <= 4 || attempts >= 120) {
        setHasRestoredScroll(true)
        return
      }

      frameId = window.requestAnimationFrame(restore)
    }

    frameId = window.requestAnimationFrame(restore)
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [hasRestoredScroll, pendingScrollTop, state.payload])

  if (state.payload) {
    return (
      <AdminEditDashboard
        characters={state.payload.characters}
        commissionSearchRows={state.payload.commissionSearchRows}
        creatorAliases={state.payload.creatorAliases}
        dataVersion={reloadToken}
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
            Edit data
          </h2>
          <p className="
            text-xs text-gray-600
            dark:text-gray-300
          "
          >
            {state.isLoading
              ? 'Loading standalone edit data through the admin worker.'
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
