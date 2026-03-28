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

  const label = status === 'pending'
    ? 'Dispatching…'
    : status === 'success'
      ? 'Dispatched ✓'
      : status === 'error'
        ? 'Retry'
        : 'Rebuild'

  const toneStyles = status === 'error'
    ? 'border-red-300 text-red-600 hover:border-red-400 dark:border-red-700 dark:text-red-300 dark:hover:border-red-600'
    : status === 'success'
      ? 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300'
      : 'border-amber-400 text-amber-600 hover:border-amber-500 hover:text-amber-700 dark:border-amber-500 dark:text-amber-300 dark:hover:border-amber-400 dark:hover:text-amber-200'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'pending'}
      className={`
        fixed bottom-6 right-4 z-50
        rounded-lg border bg-white/90 px-3 py-1.5
        text-xs font-medium shadow-sm backdrop-blur-sm
        transition
        active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        md:right-auto md:left-[calc(50%+22rem)]
        dark:bg-gray-900/80
        ${toneStyles}
      `}
    >
      {label}
    </button>
  )
}
