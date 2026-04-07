// @vitest-environment jsdom
import { COMMISSION_VIEW_MODE_CHANGE_EVENT } from '@features/home/events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readViewMode, subscribeViewMode } from './commissionViewMode'

describe('commissionViewMode', () => {
  afterEach(() => {
    // Reset URL to default state
    window.history.replaceState(null, '', '/')
  })

  it('readViewMode() returns "character" by default', () => {
    expect(readViewMode()).toBe('character')
  })

  it('readViewMode() returns "timeline" when ?view=timeline', () => {
    window.history.replaceState(null, '', '/?view=timeline')
    expect(readViewMode()).toBe('timeline')
  })

  it('notifies listeners when view mode change event fires', () => {
    const listener = vi.fn()
    const unsub = subscribeViewMode(listener)

    window.history.replaceState(null, '', '/?view=timeline')
    window.dispatchEvent(new Event(COMMISSION_VIEW_MODE_CHANGE_EVENT))

    expect(listener).toHaveBeenCalledWith('timeline')
    unsub()
  })

  it('notifies listeners on popstate', () => {
    const listener = vi.fn()
    const unsub = subscribeViewMode(listener)

    window.history.replaceState(null, '', '/?view=timeline')
    window.dispatchEvent(new Event('popstate'))

    expect(listener).toHaveBeenCalledWith('timeline')
    unsub()
  })

  it('unsubscribe removes the listener', () => {
    const listener = vi.fn()
    const unsub = subscribeViewMode(listener)
    unsub()

    window.dispatchEvent(new Event(COMMISSION_VIEW_MODE_CHANGE_EVENT))
    expect(listener).not.toHaveBeenCalled()
  })

  it('removes window listeners when last subscriber unsubscribes', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const listener = vi.fn()
    const unsub = subscribeViewMode(listener)
    unsub()

    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith(COMMISSION_VIEW_MODE_CHANGE_EVENT, expect.any(Function))
    removeSpy.mockRestore()
  })
})
