import { useCallback, useEffect, useReducer, useSyncExternalStore } from 'react'
import { triggerRebuildDeploy } from '../lib/adminApi'
import {
  clearPendingRebuild,
  isPendingRebuild,
  subscribeToPendingRebuild,
} from '../lib/pendingRebuildSignal'

// Button lifecycle: shown whenever hasPending is true or until linger expires
// after a successful dispatch. All transitions live in one reducer to avoid
// direct set-in-effect patterns that the lint rules flag.
type FloatingAction
  = { type: 'pending_appeared' }
    | { type: 'dispatch_start' }
    | { type: 'dispatch_success' }
    | { type: 'dispatch_error' }
    | { type: 'linger_expired' }

interface FloatingButtonState {
  // Whether the button is mounted and visible
  visible: boolean
  // Dispatch status label
  status: 'idle' | 'pending' | 'success' | 'error'
}

function floatingReducer(state: FloatingButtonState, action: FloatingAction): FloatingButtonState {
  switch (action.type) {
    case 'pending_appeared':
      return { visible: true, status: 'idle' }
    case 'dispatch_start':
      return { ...state, status: 'pending' }
    case 'dispatch_success':
      return { ...state, status: 'success' }
    case 'dispatch_error':
      return { ...state, status: 'error' }
    case 'linger_expired':
      return { visible: false, status: 'idle' }
  }
}

function usePendingRebuild(): boolean {
  return useSyncExternalStore(
    subscribeToPendingRebuild,
    isPendingRebuild,
    () => false,
  )
}

export function FloatingRebuildButton() {
  const hasPending = usePendingRebuild()
  const [{ visible, status }, dispatch] = useReducer(floatingReducer, {
    visible: hasPending,
    status: 'idle',
  })

  // Show button and reset status when new pending changes arrive
  useEffect(() => {
    if (hasPending) {
      dispatch({ type: 'pending_appeared' })
    }
  }, [hasPending])

  // Auto-hide 1.6s after successful dispatch with no pending changes left
  useEffect(() => {
    if (status !== 'success' || hasPending) {
      return
    }
    const timer = setTimeout(dispatch, 1600, { type: 'linger_expired' })
    return () => clearTimeout(timer)
  }, [status, hasPending])

  const handleClick = useCallback(async () => {
    dispatch({ type: 'dispatch_start' })
    try {
      await triggerRebuildDeploy()
      clearPendingRebuild()
      dispatch({ type: 'dispatch_success' })
    }
    catch {
      dispatch({ type: 'dispatch_error' })
    }
  }, [])

  if (!visible)
    return null

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'pending'}
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-2 rounded-full px-5 py-3
        text-sm font-semibold shadow-lg
        transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-60
        ${status === 'error'
      ? 'border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-400 dark:border-red-700 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/30 dark:focus-visible:ring-offset-gray-900'
      : status === 'success'
        ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 focus-visible:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 dark:focus-visible:ring-offset-gray-900'
        : 'border border-amber-400 bg-amber-500 text-white hover:bg-amber-400 focus-visible:ring-amber-400 dark:border-amber-300 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300 dark:focus-visible:ring-offset-gray-900'
    }
      `}
    >
      {status === 'pending' && 'Dispatching…'}
      {status === 'success' && 'Dispatched ✓'}
      {status === 'error' && 'Retry Rebuild'}
      {status === 'idle' && 'Rebuild & Deploy'}
    </button>
  )
}
