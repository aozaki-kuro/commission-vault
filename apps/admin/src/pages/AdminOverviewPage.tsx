import type { AdminCommissionSearchRow } from '@commission-index/domain'
import type { MouseEvent } from 'react'
import type { StatusTone } from '../app/ui'
import type { AdminOverviewPayload } from '../lib/adminApi'
import { useCallback, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import {
  adminActionLinkStyles,
  adminInsetCardStyles,
  adminSurfaceStyles,
  getStatusBadgeStyles,
} from '../app/ui'
import {
  fetchAdminOverviewPayload,
  getAdminApiBaseUrl,
  readCachedAdminJson,
  triggerRebuildDeploy,
} from '../lib/adminApi'

const LATEST_ENTRY_LIMIT = 10
const overviewCacheKey = '/api/admin/overview'

interface OverviewMetrics {
  activeCharacters: number
  characterAliasCount: number
  creatorAliasCount: number
  featuredKeywordCount: number
  keywordAliasCount: number
  archivedCharacters: number
  totalAliasRows: number
  totalCharacters: number
  totalCommissions: number
}

interface OverviewState {
  errorMessage: string | null
  isLoading: boolean
  payload: AdminOverviewPayload | null
}

type OverviewAction
  = { type: 'loading' }
    | { payload: AdminOverviewPayload, type: 'loaded' }
    | { message: string, type: 'failed' }

function createInitialOverviewState(): OverviewState {
  const payload = readCachedAdminJson<AdminOverviewPayload>(overviewCacheKey)

  return {
    errorMessage: null,
    isLoading: payload === null,
    payload,
  }
}

function overviewReducer(state: OverviewState, action: OverviewAction): OverviewState {
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

function buildOverviewMetrics(payload: AdminOverviewPayload): OverviewMetrics {
  const totalCharacters = payload.bootstrap.characters.length
  const activeCharacters = payload.bootstrap.characters.filter(row => row.status === 'active').length
  const characterAliasCount = payload.aliases.characterAliases.length
  const creatorAliasCount = payload.aliases.creatorAliases.length
  const keywordAliasCount = payload.aliases.keywordAliases.length

  return {
    activeCharacters,
    characterAliasCount,
    creatorAliasCount,
    featuredKeywordCount: payload.suggestion.featuredKeywords.length,
    keywordAliasCount,
    archivedCharacters: totalCharacters - activeCharacters,
    totalAliasRows: characterAliasCount + creatorAliasCount + keywordAliasCount,
    totalCharacters,
    totalCommissions: payload.bootstrap.characters.reduce(
      (count, row) => count + row.commissionCount,
      0,
    ),
  }
}

function getLatestCommissions(rows: AdminCommissionSearchRow[]) {
  return rows
    .toSorted((left, right) => right.fileName.localeCompare(left.fileName))
    .slice(0, LATEST_ENTRY_LIMIT)
}

function getMetricValue(value: number | null) {
  return value === null ? '...' : String(value)
}

function getStatusTone(payload: AdminOverviewPayload | null, errorMessage: string | null): StatusTone {
  if (errorMessage) {
    return 'blocked'
  }

  if (payload?.health.status === 'ok') {
    return 'done'
  }

  return 'pending'
}

function getStatusLabel(payload: AdminOverviewPayload | null, errorMessage: string | null, isLoading: boolean) {
  if (errorMessage) {
    return 'Worker error'
  }

  if (payload?.health.status === 'ok') {
    return 'Healthy'
  }

  return isLoading ? 'Loading' : 'Pending'
}

function getStatusDescription(
  payload: AdminOverviewPayload | null,
  errorMessage: string | null,
  isLoading: boolean,
) {
  if (errorMessage) {
    return errorMessage
  }

  if (payload) {
    return payload.health.message ?? 'Standalone admin worker is responding.'
  }

  return isLoading ? 'Loading live worker status...' : 'Worker status unavailable.'
}

type RebuildState = 'idle' | 'pending' | 'success' | 'error'

interface AdminOverviewPageProps {
  onNavigate: (path: string) => void
}

function shouldHandleInternalNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
}

export function AdminOverviewPage({ onNavigate }: AdminOverviewPageProps) {
  const [state, dispatch] = useReducer(overviewReducer, undefined, createInitialOverviewState)
  const [reloadToken, setReloadToken] = useState(0)
  const apiBaseUrl = getAdminApiBaseUrl() || 'same-origin'
  const [rebuildState, setRebuildState] = useState<RebuildState>('idle')
  const [rebuildMessage, setRebuildMessage] = useState('')
  const rebuildAbortRef = useRef<AbortController | null>(null)
  const hasPayload = useEffectEvent(() => state.payload !== null)

  const handleRebuild = useCallback(async () => {
    rebuildAbortRef.current?.abort()
    const controller = new AbortController()
    rebuildAbortRef.current = controller

    setRebuildState('pending')
    setRebuildMessage('')

    try {
      const result = await triggerRebuildDeploy(controller.signal)
      setRebuildState('success')
      setRebuildMessage(result.message)
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setRebuildState('error')
      setRebuildMessage(error instanceof Error ? error.message : 'Unknown error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let isDisposed = false

    if (!hasPayload()) {
      dispatch({ type: 'loading' })
    }

    void fetchAdminOverviewPayload({
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
          message: error instanceof Error ? error.message : 'Failed to load admin overview.',
          type: 'failed',
        })
      })

    return () => {
      isDisposed = true
      controller.abort()
    }
  }, [reloadToken])

  const metrics = state.payload ? buildOverviewMetrics(state.payload) : null
  const latestCommissions = state.payload ? getLatestCommissions(state.payload.bootstrap.commissionSearchRows) : []
  const statusTone = getStatusTone(state.payload, state.errorMessage)
  const statusLabel = getStatusLabel(state.payload, state.errorMessage, state.isLoading)
  const statusDescription = getStatusDescription(state.payload, state.errorMessage, state.isLoading)

  return (
    <>
      <section className="
        grid gap-4
        sm:grid-cols-2
      "
      >
        <article className="
          rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm ring-1
          ring-gray-900/5 backdrop-blur-sm
          dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10
        "
        >
          <p className="
            text-xs font-semibold tracking-wide text-gray-500 uppercase
            dark:text-gray-300
          "
          >
            Characters
          </p>
          <p className="
            mt-2 text-3xl font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            {getMetricValue(metrics?.totalCharacters ?? null)}
          </p>
          <p className="
            mt-2 text-xs text-gray-600
            dark:text-gray-300
          "
          >
            Active
            {' '}
            {getMetricValue(metrics?.activeCharacters ?? null)}
            {' '}
            / Archived
            {' '}
            {getMetricValue(metrics?.archivedCharacters ?? null)}
          </p>
        </article>

        <article className="
          rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm ring-1
          ring-gray-900/5 backdrop-blur-sm
          dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10
        "
        >
          <p className="
            text-xs font-semibold tracking-wide text-gray-500 uppercase
            dark:text-gray-300
          "
          >
            Commissions
          </p>
          <p className="
            mt-2 text-3xl font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            {getMetricValue(metrics?.totalCommissions ?? null)}
          </p>
          <p className="
            mt-2 text-xs text-gray-600
            dark:text-gray-300
          "
          >
            Indexed entries available for admin search.
          </p>
        </article>

        <article className="
          rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm ring-1
          ring-gray-900/5 backdrop-blur-sm
          dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10
        "
        >
          <p className="
            text-xs font-semibold tracking-wide text-gray-500 uppercase
            dark:text-gray-300
          "
          >
            Alias Rows
          </p>
          <p className="
            mt-2 text-3xl font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            {getMetricValue(metrics?.totalAliasRows ?? null)}
          </p>
          <p className="
            mt-2 text-xs text-gray-600
            dark:text-gray-300
          "
          >
            Character
            {' '}
            {getMetricValue(metrics?.characterAliasCount ?? null)}
            {' '}
            / Creator
            {' '}
            {getMetricValue(metrics?.creatorAliasCount ?? null)}
            {' '}
            / Keyword
            {' '}
            {getMetricValue(metrics?.keywordAliasCount ?? null)}
          </p>
        </article>

        <article className="
          rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm ring-1
          ring-gray-900/5 backdrop-blur-sm
          dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10
        "
        >
          <p className="
            text-xs font-semibold tracking-wide text-gray-500 uppercase
            dark:text-gray-300
          "
          >
            Featured Keywords
          </p>
          <p className="
            mt-2 text-3xl font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            {getMetricValue(metrics?.featuredKeywordCount ?? null)}
          </p>
          <p className="
            mt-2 text-xs text-gray-600
            dark:text-gray-300
          "
          >
            Curated home suggestions.
          </p>
        </article>
      </section>

      <section className={adminSurfaceStyles}>
        <h2 className="
          text-sm font-semibold text-gray-900
          dark:text-gray-100
        "
        >
          Quick actions
        </h2>
        <p className="
          mt-1 text-xs text-gray-600
          dark:text-gray-300
        "
        >
          Split workflows for faster maintenance.
        </p>
        <div className="
          mt-4 grid gap-3
          sm:grid-cols-2
        "
        >
          <a
            href="/create"
            className={adminActionLinkStyles}
            onClick={(event) => {
              if (!shouldHandleInternalNavigation(event)) {
                return
              }

              event.preventDefault()
              onNavigate('/create')
            }}
          >
            Create entries
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="/edit"
            className={adminActionLinkStyles}
            onClick={(event) => {
              if (!shouldHandleInternalNavigation(event)) {
                return
              }

              event.preventDefault()
              onNavigate('/edit')
            }}
          >
            Edit existing
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="/aliases"
            className={adminActionLinkStyles}
            onClick={(event) => {
              if (!shouldHandleInternalNavigation(event)) {
                return
              }

              event.preventDefault()
              onNavigate('/aliases')
            }}
          >
            Manage aliases
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="/suggestion"
            className={adminActionLinkStyles}
            onClick={(event) => {
              if (!shouldHandleInternalNavigation(event)) {
                return
              }

              event.preventDefault()
              onNavigate('/suggestion')
            }}
          >
            Curate suggestions
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="
          mt-4 border-t border-gray-200/80 pt-4
          dark:border-gray-700/80
        "
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="
                text-xs font-medium text-gray-700
                dark:text-gray-200
              "
              >
                Rebuild &amp; Deploy Web
              </p>
              <p className="
                mt-0.5 text-xs text-gray-500
                dark:text-gray-400
              "
              >
                {rebuildState === 'idle' && 'Trigger a full data export + web deploy via GitHub Actions.'}
                {rebuildState === 'pending' && 'Dispatching to GitHub Actions…'}
                {rebuildState === 'success' && rebuildMessage}
                {rebuildState === 'error' && rebuildMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRebuild}
              disabled={rebuildState === 'pending'}
              className={`
                w-28 shrink-0 rounded-lg border px-4 py-2 text-center text-xs
                font-semibold shadow-sm transition
                focus-visible:ring-2 focus-visible:ring-offset-2
                focus-visible:ring-offset-white focus-visible:outline-none
                active:scale-[0.97]
                disabled:cursor-not-allowed disabled:opacity-50
                ${rebuildState === 'error'
      ? `
        border-red-300 bg-red-50 text-red-700
        hover:border-red-400 hover:bg-red-100
        focus-visible:ring-red-400
        dark:border-red-700 dark:bg-red-500/15 dark:text-red-200
        dark:hover:border-red-600 dark:hover:bg-red-500/25
        dark:focus-visible:ring-red-500 dark:focus-visible:ring-offset-gray-900
      `
      : rebuildState === 'success'
        ? `
          border-emerald-300 bg-emerald-50 text-emerald-700
          hover:border-emerald-400 hover:bg-emerald-100
          focus-visible:ring-emerald-400
          dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200
          dark:hover:border-emerald-600 dark:hover:bg-emerald-500/25
          dark:focus-visible:ring-emerald-500
          dark:focus-visible:ring-offset-gray-900
        `
        : `
          border-amber-500 bg-amber-500 text-white
          hover:border-amber-400 hover:bg-amber-400
          focus-visible:ring-amber-400
          dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950
          dark:hover:border-amber-300 dark:hover:bg-amber-300
          dark:focus-visible:ring-amber-300
          dark:focus-visible:ring-offset-gray-900
        `}
              `}
            >
              {rebuildState === 'pending'
                ? 'Dispatching…'
                : rebuildState === 'success'
                  ? 'Dispatched ✓'
                  : rebuildState === 'error'
                    ? 'Retry'
                    : 'Rebuild'}
            </button>
          </div>
        </div>
      </section>

      <section className={adminSurfaceStyles}>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="
              text-sm font-semibold text-gray-900
              dark:text-gray-100
            "
            >
              System status
            </h2>
            <p className="
              text-xs text-gray-600
              dark:text-gray-300
            "
            >
              The standalone admin now reads and writes through the remote admin worker.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium
              ${getStatusBadgeStyles(statusTone)}
            `}
            >
              {statusLabel}
            </span>
            <button
              type="button"
              className="
                rounded-lg border border-gray-300/80 px-3 py-1.5 text-xs
                font-medium text-gray-700 transition
                hover:border-gray-400 hover:text-gray-900
                active:scale-[0.97]
                dark:border-gray-700 dark:text-gray-200
                dark:hover:border-gray-600 dark:hover:text-gray-100
              "
              onClick={() => setReloadToken(token => token + 1)}
              disabled={state.isLoading}
            >
              {state.isLoading ? 'Loading…' : 'Reload'}
            </button>
          </div>
        </div>

        <div className="
          mt-4 grid gap-3
          md:grid-cols-2
        "
        >
          <article className={adminInsetCardStyles}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="
                text-sm font-medium text-gray-900
                dark:text-gray-100
              "
              >
                Admin worker
              </h3>
              <span className={`
                inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium
                ${getStatusBadgeStyles(statusTone)}
              `}
              >
                {statusLabel}
              </span>
            </div>
            <p className="
              mt-3 text-xs text-gray-600
              dark:text-gray-300
            "
            >
              {statusDescription}
            </p>
          </article>

          <article className={adminInsetCardStyles}>
            <h3 className="
              text-sm font-medium text-gray-900
              dark:text-gray-100
            "
            >
              API origin
            </h3>
            <p className="
              mt-3 font-mono text-xs break-all text-gray-600
              dark:text-gray-300
            "
            >
              {apiBaseUrl}
            </p>
            <p className="
              mt-3 text-xs text-gray-600
              dark:text-gray-300
            "
            >
              All admin reads and writes now go through the worker-backed D1/R2 API.
            </p>
          </article>
        </div>
      </section>

      <section className={adminSurfaceStyles}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="
            text-sm font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            Latest entries
          </h2>
          <a
            className="
              text-xs text-gray-600
              hover:text-gray-900
              dark:text-gray-300
              dark:hover:text-gray-100
            "
            href="/edit"
            onClick={(event) => {
              if (!shouldHandleInternalNavigation(event)) {
                return
              }

              event.preventDefault()
              onNavigate('/edit')
            }}
          >
            Open edit view
          </a>
        </div>

        {latestCommissions.length === 0
          ? (
              <p className="
                mt-4 text-sm text-gray-600
                dark:text-gray-300
              "
              >
                {state.errorMessage ? 'Latest entries are unavailable until overview data loads.' : 'No commissions found.'}
              </p>
            )
          : (
              <ol className="mt-4 space-y-2">
                {latestCommissions.map(item => (
                  <li
                    key={item.id}
                    className="
                      flex items-center justify-between gap-3 rounded-lg border
                      border-gray-200/80 bg-white/80 px-3 py-2 text-xs
                      dark:border-gray-700 dark:bg-gray-950/40
                    "
                  >
                    <span className="
                      min-w-0 truncate font-mono text-gray-800
                      dark:text-gray-100
                    "
                    >
                      {item.fileName}
                    </span>
                    <span className="
                      shrink-0 text-gray-500
                      dark:text-gray-300
                    "
                    >
                      {item.characterName}
                    </span>
                  </li>
                ))}
              </ol>
            )}
      </section>
    </>
  )
}
