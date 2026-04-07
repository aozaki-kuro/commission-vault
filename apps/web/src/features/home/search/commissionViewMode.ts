import { COMMISSION_VIEW_MODE_CHANGE_EVENT } from '@features/home/events'
import { readCommissionViewMode } from '../commission/viewModeState'

export type { CommissionViewMode } from '../commission/CommissionViewModeSearch'
type CommissionViewMode = import('../commission/CommissionViewModeSearch').CommissionViewMode

type Listener = (mode: CommissionViewMode) => void

let listeners: Listener[] = []
let teardown: (() => void) | null = null

function notify() {
  const mode = readViewMode()
  for (const fn of listeners) fn(mode)
}

function attachWindowListeners() {
  window.addEventListener('popstate', notify)
  window.addEventListener(COMMISSION_VIEW_MODE_CHANGE_EVENT, notify)
  teardown = () => {
    window.removeEventListener('popstate', notify)
    window.removeEventListener(COMMISSION_VIEW_MODE_CHANGE_EVENT, notify)
    teardown = null
  }
}

/** Current view mode derived from `window.location.search`. */
export function readViewMode(): CommissionViewMode {
  if (typeof window === 'undefined')
    return 'character'
  return readCommissionViewMode(window)
}

/**
 * Subscribe to view mode changes (popstate + custom event).
 * Window listeners are lazily attached on first subscriber and
 * removed when the last subscriber unsubscribes.
 */
export function subscribeViewMode(fn: Listener): () => void {
  listeners.push(fn)
  if (listeners.length === 1 && typeof window !== 'undefined') {
    attachWindowListeners()
  }

  return () => {
    listeners = listeners.filter(l => l !== fn)
    if (listeners.length === 0)
      teardown?.()
  }
}
