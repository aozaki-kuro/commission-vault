const channelName = 'commission-updates'
const storageKey = 'commission-updated-at'
// Unique per-tab ID so each tab can ignore its own broadcasts.
const tabSessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

function sendStoragePing() {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(storageKey, `${Date.now()}`)
  }
  catch {
    // ignore storage errors
  }
}

export function notifyDataUpdate() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(channelName)
      channel.postMessage({ at: Date.now(), sessionId: tabSessionId, type: 'updated' })
      channel.close()
      return
    }
  }
  catch {
    // ignore and fall back to storage ping
  }

  sendStoragePing()
}

export function subscribeToDataUpdates(onUpdate: () => void) {
  let channel: BroadcastChannel | null = null

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName)
      channel.onmessage = (event) => {
        // Ignore our own broadcasts — local state is updated in-place instead.
        if (event.data?.sessionId !== tabSessionId) {
          onUpdate()
        }
      }
    }
  }
  catch {
    // ignore and keep storage fallback
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) {
      onUpdate()
    }
  }

  window.addEventListener('storage', onStorage)

  return () => {
    if (channel) {
      channel.close()
    }

    window.removeEventListener('storage', onStorage)
  }
}
