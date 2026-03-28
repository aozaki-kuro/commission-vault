import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { triggerRebuildDeploy } from '../lib/adminApi'
import {
  clearPendingRebuild,
  isPendingRebuild,
  subscribeToPendingRebuild,
} from '../lib/pendingRebuildSignal'

type FloatingState = 'idle' | 'pending' | 'success' | 'error'

function usePendingRebuild(): boolean {
  return useSyncExternalStore(
    subscribeToPendingRebuild,
    isPendingRebuild,
    () => false,
  )
}

export function FloatingRebuildButton() {
  const hasPending = usePendingRebuild()
  const [state, setState] = useState<FloatingState>('idle')
  const [visible, setVisible] = useState(false)

  // Animate in/out: show when pending or recently dispatched
  useEffect(() => {
    if (hasPending) {
      setVisible(true)
      setState('idle')
    }
    return undefined
  }, [hasPending])

  // Auto-hide after successful dispatch + no pending changes
  useEffect(() => {
    if (state === 'success' && !hasPending) {
      const timer = setTimeout(setVisible, 1600, false)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [state, hasPending])

  const handleClick = useCallback(async () => {
    setState('pending')
    try {
      await triggerRebuildDeploy()
      clearPendingRebuild()
      setState('success')
    }
    catch {
      setState('error')
    }
  }, [])

  if (!visible)
    return null

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'pending'}
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-2 rounded-full px-5 py-3
        text-sm font-semibold shadow-lg
        transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-60
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        ${state === 'error'
      ? 'border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-400 dark:border-red-700 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/30 dark:focus-visible:ring-offset-gray-900'
      : state === 'success'
        ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 focus-visible:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 dark:focus-visible:ring-offset-gray-900'
        : 'border border-amber-400 bg-amber-500 text-white hover:bg-amber-400 focus-visible:ring-amber-400 dark:border-amber-300 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300 dark:focus-visible:ring-offset-gray-900'
    }
      `}
    >
      {state === 'pending' && 'Dispatching…'}
      {state === 'success' && 'Dispatched ✓'}
      {state === 'error' && 'Retry Rebuild'}
      {state === 'idle' && 'Rebuild & Deploy'}
    </button>
  )
}
