import {
  ACTIVE_CHARACTERS_LOAD_REQUEST_EVENT,
  ACTIVE_CHARACTERS_LOADED_EVENT,
} from '@features/home/commission/loader/activeCharactersEvent'
import { SIDEBAR_SEARCH_STATE_EVENT } from '@lib/navigation/sidebarSearchState'
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mountActiveCharactersLoader } from './activeCharactersLoader'

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function renderFixture() {
  document.body.innerHTML = `
    <div data-commission-view-panel="character" data-active-sections-loaded="false">
      <section id="section-alpha"></section>
      <div data-active-sections-container="true"></div>
      <div data-active-sections-sentinel="true"></div>
      <template data-active-sections-template="true">
        <section id="section-beta"></section>
      </template>
    </div>
  `
}

describe('mountActiveCharactersLoader', () => {
  it('loads deferred active sections on global request and dispatches sync events', async () => {
    renderFixture()

    const onLoaded = vi.fn()
    const onSidebarSync = vi.fn()
    window.addEventListener(ACTIVE_CHARACTERS_LOADED_EVENT, onLoaded)
    window.addEventListener(SIDEBAR_SEARCH_STATE_EVENT, onSidebarSync)

    const cleanup = mountActiveCharactersLoader()
    window.dispatchEvent(new Event(ACTIVE_CHARACTERS_LOAD_REQUEST_EVENT))
    await flushAsyncWork()

    expect(document.getElementById('section-beta')).toBeTruthy()
    expect(
      document
        .querySelector<HTMLElement>('[data-commission-view-panel="character"]')
        ?.getAttribute('data-active-sections-loaded'),
    ).toBe('true')
    expect(onLoaded).toHaveBeenCalledTimes(1)
    expect(onSidebarSync).toHaveBeenCalledTimes(1)

    cleanup()
    window.removeEventListener(ACTIVE_CHARACTERS_LOADED_EVENT, onLoaded)
    window.removeEventListener(SIDEBAR_SEARCH_STATE_EVENT, onSidebarSync)
  })

  it('loads deferred active sections for an initial hash target and scrolls after mount', async () => {
    renderFixture()
    document.querySelector('template[data-active-sections-template="true"]')!.innerHTML = `
      <section id="section-beta"></section>
      <article id="section-beta-20240101"></article>
    `
    window.history.replaceState(null, '', '#section-beta-20240101')

    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    const scrollToHashWithoutWrite = vi.fn().mockReturnValue(true)

    const cleanup = mountActiveCharactersLoader({
      deps: { scrollToHashWithoutWrite },
    })
    await flushAsyncWork()

    expect(document.getElementById('section-beta')).toBeTruthy()
    expect(scrollToHashWithoutWrite).toHaveBeenCalledWith('#section-beta-20240101')

    cleanup()
    requestAnimationFrameSpy.mockRestore()
    window.history.replaceState(null, '', '/')
  })

  it('still scrolls to deferred target even when hash is cleared before queueLoad resolves', async () => {
    renderFixture()
    document.querySelector('template[data-active-sections-template="true"]')!.innerHTML = `
      <section id="section-beta"></section>
    `
    window.history.replaceState(null, '', '#section-beta')

    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    const scrollToHashWithoutWrite = vi.fn().mockReturnValue(true)

    const cleanup = mountActiveCharactersLoader({
      deps: { scrollToHashWithoutWrite },
    })

    // Simulate clearHashIfTargetOffscreen clearing the URL hash before the batch loads
    window.history.replaceState(null, '', '/')

    await flushAsyncWork()

    expect(scrollToHashWithoutWrite).toHaveBeenCalledWith('#section-beta')

    cleanup()
    requestAnimationFrameSpy.mockRestore()
  })

  it('scrolls with RAF when element is already in the initial HTML', async () => {
    renderFixture()
    // section-alpha is already in the static HTML (not in the template)
    window.history.replaceState(null, '', '#section-alpha')

    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    const scrollToHashWithoutWrite = vi.fn().mockReturnValue(true)

    const cleanup = mountActiveCharactersLoader({
      deps: { scrollToHashWithoutWrite },
    })
    await flushAsyncWork()

    expect(scrollToHashWithoutWrite).toHaveBeenCalledWith('#section-alpha')

    cleanup()
    requestAnimationFrameSpy.mockRestore()
    window.history.replaceState(null, '', '/')
  })

  it('loads deferred active sections when the sentinel enters the preload range', async () => {
    renderFixture()

    const observe = vi.fn()
    const disconnect = vi.fn()
    class MockIntersectionObserver {
      private readonly callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe = observe.mockImplementation(() => {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      })

      disconnect = disconnect

      unobserve() {}

      takeRecords() {
        return []
      }

      readonly root = null

      readonly rootMargin = ''

      readonly thresholds = []
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    const cleanup = mountActiveCharactersLoader()
    await flushAsyncWork()

    expect(document.getElementById('section-beta')).toBeTruthy()
    expect(observe).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalled()

    cleanup()
    vi.unstubAllGlobals()
  })
})
