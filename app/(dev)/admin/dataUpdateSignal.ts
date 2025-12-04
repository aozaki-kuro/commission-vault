'use client'

const channelName = 'commission-updates'
const storageKey = 'commission-updated-at'

const sendStoragePing = () => {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, `${Date.now()}`)
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export const notifyDataUpdate = () => {
  // BroadcastChannel preferred; fall back to storage events
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(channelName)
      channel.postMessage({ type: 'updated', at: Date.now() })
      channel.close()
      return
    }
  } catch {
    // ignore and fall back
  }

  sendStoragePing()
}

export const updateChannel = { name: channelName, storageKey }
