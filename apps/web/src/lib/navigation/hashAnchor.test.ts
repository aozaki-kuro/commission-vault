// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearHashIfTargetMissing, scrollToHashTargetFromHrefWithoutHash, setLocationHash } from './hashAnchor'

describe('hashAnchor utils', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.history.replaceState(null, '', '/')
  })

  it('scrolls to hash targets without mutating location hash', () => {
    const target = document.createElement('div')
    target.id = 'timeline-year-2026'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    const didScroll = scrollToHashTargetFromHrefWithoutHash('#timeline-year-2026')

    expect(didScroll).toBe(true)
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('')
  })

  it('returns false when hash target cannot be resolved', () => {
    expect(scrollToHashTargetFromHrefWithoutHash('#missing')).toBe(false)
    expect(scrollToHashTargetFromHrefWithoutHash(null)).toBe(false)
  })

  it('returns false instead of throwing for malformed hash encoding', () => {
    expect(() => scrollToHashTargetFromHrefWithoutHash('#%E0%A4%A')).not.toThrow()
    expect(scrollToHashTargetFromHrefWithoutHash('#%E0%A4%A')).toBe(false)
  })

  it('prefers visible target when duplicate ids exist across view panels', () => {
    const hiddenPanel = document.createElement('div')
    hiddenPanel.dataset.commissionViewPanel = 'character'
    hiddenPanel.dataset.commissionViewActive = 'false'
    const hiddenTarget = document.createElement('div')
    hiddenTarget.id = 'l-cia-20260226'
    hiddenTarget.scrollIntoView = vi.fn()
    hiddenPanel.appendChild(hiddenTarget)

    const visiblePanel = document.createElement('div')
    visiblePanel.dataset.commissionViewPanel = 'timeline'
    visiblePanel.dataset.commissionViewActive = 'true'
    const visibleTarget = document.createElement('div')
    visibleTarget.id = 'l-cia-20260226'
    visibleTarget.scrollIntoView = vi.fn()
    visiblePanel.appendChild(visibleTarget)

    document.body.appendChild(hiddenPanel)
    document.body.appendChild(visiblePanel)

    const didScroll = scrollToHashTargetFromHrefWithoutHash('/?view=timeline#l-cia-20260226')

    expect(didScroll).toBe(true)
    expect(visibleTarget.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(hiddenTarget.scrollIntoView).not.toHaveBeenCalled()
  })

  it('clears hash when target is missing from DOM', () => {
    window.history.replaceState(null, '', '/?view=timeline#missing')
    clearHashIfTargetMissing()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/?view=timeline',
    )
  })

  it('keeps hash when target exists in DOM, regardless of scroll position', () => {
    const target = document.createElement('div')
    target.id = 'timeline-year-2026'
    document.body.appendChild(target)
    window.history.replaceState(null, '', '/?view=timeline#timeline-year-2026')

    clearHashIfTargetMissing()

    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/?view=timeline#timeline-year-2026',
    )
  })

  it('sets hash via replaceState without scrolling', () => {
    window.history.replaceState(null, '', '/?view=timeline')
    setLocationHash('#timeline-year-2026')
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/?view=timeline#timeline-year-2026',
    )
  })
})
