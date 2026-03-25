// @vitest-environment jsdom
import { ACTIVE_CHARACTERS_LOADED_EVENT } from '@features/home/commission/loader/activeCharactersEvent'
import { HOME_SCROLL_RESTORE_ABORT_EVENT } from '@features/home/events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountHomeUpdateLinks } from './updateLinks'

function renderFixture() {
  document.body.innerHTML = `
    <div data-home-update-links="true">
      <a href="#section-beta-20240101" data-home-update-link="true">Beta</a>
    </div>
  `
}

describe('mountHomeUpdateLinks', () => {
  beforeEach(() => {
    renderFixture()
    window.history.replaceState(null, '', '/')
  })

  it('loads deferred active targets before scrolling', () => {
    const scrollToHashWithoutWrite = vi.fn()
    const requestActiveLoad = vi.fn((win: Window) => {
      const target = document.createElement('article')
      target.id = 'section-beta-20240101'
      document.body.appendChild(target)
      win.dispatchEvent(new Event(ACTIVE_CHARACTERS_LOADED_EVENT))
    })
    const hasDeferredActiveTarget = vi.fn(() => true)
    const onRestoreAbort = vi.fn()
    window.addEventListener(HOME_SCROLL_RESTORE_ABORT_EVENT, onRestoreAbort)

    const cleanup = mountHomeUpdateLinks({
      deps: {
        hasDeferredActiveTarget,
        requestActiveLoad,
        scrollToHashWithoutWrite,
      },
    })

    const link = document.querySelector<HTMLAnchorElement>('[data-home-update-link="true"]')
    const didDispatch = link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(didDispatch).toBe(false)
    expect(hasDeferredActiveTarget).toHaveBeenCalledWith(document, '#section-beta-20240101')
    expect(onRestoreAbort).toHaveBeenCalledTimes(1)
    expect(requestActiveLoad).toHaveBeenCalledWith(window, {
      strategy: 'target',
      targetId: '#section-beta-20240101',
    })
    expect(scrollToHashWithoutWrite).toHaveBeenCalledWith('#section-beta-20240101')

    cleanup()
    window.removeEventListener(HOME_SCROLL_RESTORE_ABORT_EVENT, onRestoreAbort)
  })

  it('keeps default link behavior when target is already loaded', () => {
    const scrollToHashWithoutWrite = vi.fn()
    const requestActiveLoad = vi.fn()
    const hasDeferredActiveTarget = vi.fn(() => false)

    const cleanup = mountHomeUpdateLinks({
      deps: {
        hasDeferredActiveTarget,
        requestActiveLoad,
        scrollToHashWithoutWrite,
      },
    })

    const link = document.querySelector<HTMLAnchorElement>('[data-home-update-link="true"]')
    const didDispatch = link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(didDispatch).toBe(true)
    expect(requestActiveLoad).not.toHaveBeenCalled()
    expect(scrollToHashWithoutWrite).not.toHaveBeenCalled()

    cleanup()
  })

  it('treats timeline-only duplicate ids as deferred active targets', () => {
    document.body.innerHTML = `
      <div data-home-update-links="true">
        <a href="#section-beta-20240101" data-home-update-link="true">Beta</a>
      </div>
      <div data-commission-view-panel="timeline" data-commission-view-active="false">
        <article id="section-beta-20240101"></article>
      </div>
      <div data-commission-view-panel="character" data-commission-view-active="true">
        <div data-active-sections-container="true"></div>
      </div>
      <script type="application/json" data-home-character-batch-manifest="true">
        {"locale":"en","active":{"initialSectionIds":[],"totalBatches":1,"targetBatchById":{"section-beta-20240101":0}},"archived":{"initialSectionIds":[],"totalBatches":0,"targetBatchById":{}}}
      </script>
    `
    const scrollToHashWithoutWrite = vi.fn()
    const requestActiveLoad = vi.fn((win: Window) => {
      const container = document.querySelector<HTMLElement>('[data-active-sections-container="true"]')
      const target = document.createElement('article')
      target.id = 'section-beta-20240101'
      container?.appendChild(target)
      win.dispatchEvent(new Event(ACTIVE_CHARACTERS_LOADED_EVENT))
    })

    const cleanup = mountHomeUpdateLinks({
      deps: {
        requestActiveLoad,
        scrollToHashWithoutWrite,
      },
    })

    const link = document.querySelector<HTMLAnchorElement>('[data-home-update-link="true"]')
    const didDispatch = link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(didDispatch).toBe(false)
    expect(requestActiveLoad).toHaveBeenCalledWith(window, {
      strategy: 'target',
      targetId: '#section-beta-20240101',
    })
    expect(scrollToHashWithoutWrite).toHaveBeenCalledWith('#section-beta-20240101')

    cleanup()
  })
})
