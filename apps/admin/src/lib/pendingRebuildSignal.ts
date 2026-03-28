const STORAGE_KEY = 'pending-rebuild'

type Listener = (pending: boolean) => void
const listeners = new Set<Listener>()

let pending = typeof sessionStorage !== 'undefined'
  ? sessionStorage.getItem(STORAGE_KEY) === '1'
  : false

function notify() {
  for (const fn of listeners) {
    fn(pending)
  }
}

export function isPendingRebuild(): boolean {
  return pending
}

export function markPendingRebuild(): void {
  if (pending)
    return
  pending = true
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  }
  catch {}
  notify()
}

export function clearPendingRebuild(): void {
  if (!pending)
    return
  pending = false
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  }
  catch {}
  notify()
}

export function subscribeToPendingRebuild(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
