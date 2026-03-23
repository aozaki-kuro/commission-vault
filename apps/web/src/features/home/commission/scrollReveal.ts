/**
 * Scroll-triggered reveal animation for commission entries.
 *
 * Only animates entries that enter the viewport by scrolling — entries already
 * visible on initial load (or scroll-restored) are left alone to avoid flicker.
 * A MutationObserver watches for dynamically batch-loaded entries.
 */

const REVEAL_ATTR = 'data-commission-entry'
const REVEALED_ATTR = 'data-revealed'
const REVEAL_CLASS = 'animate-reveal-up'
const STAGGER_DELAY_MS = 80
const MAX_STAGGER_MS = 400

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  catch {
    return false
  }
}

/** True if any part of the element is within or above the viewport. */
function isInOrAboveViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return rect.top < window.innerHeight
}

export function mountScrollReveal(): () => void {
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    return () => {}
  }

  const prepareEntry = (el: HTMLElement) => {
    if (el.hasAttribute(REVEALED_ATTR))
      return
    el.style.opacity = '0'
  }

  const revealBatch = (entries: HTMLElement[]) => {
    entries.forEach((el, i) => {
      const delay = Math.min(i * STAGGER_DELAY_MS, MAX_STAGGER_MS)
      el.style.animationDelay = `${delay}ms`
      el.classList.add(REVEAL_CLASS)
      el.setAttribute(REVEALED_ATTR, '')

      el.addEventListener('animationend', () => {
        el.style.removeProperty('opacity')
        el.style.removeProperty('animation-delay')
      }, { once: true })
    })
  }

  let pendingReveals: HTMLElement[] = []
  let rafId: number | null = null

  const flushReveals = () => {
    rafId = null
    if (pendingReveals.length > 0) {
      revealBatch(pendingReveals)
      pendingReveals = []
    }
  }

  const io = new IntersectionObserver(
    (ioEntries) => {
      for (const entry of ioEntries) {
        if (!entry.isIntersecting)
          continue
        const el = entry.target as HTMLElement
        io.unobserve(el)
        pendingReveals.push(el)
      }

      if (pendingReveals.length > 0 && rafId === null) {
        rafId = requestAnimationFrame(flushReveals)
      }
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0 },
  )

  // Mark entries already visible as revealed (no animation) and only
  // observe entries below the fold.
  const observeAll = (root: ParentNode = document) => {
    const elements = root.querySelectorAll<HTMLElement>(`[${REVEAL_ATTR}]`)
    for (const el of elements) {
      if (el.hasAttribute(REVEALED_ATTR))
        continue
      if (isInOrAboveViewport(el)) {
        el.setAttribute(REVEALED_ATTR, '')
        continue
      }
      prepareEntry(el)
      io.observe(el)
    }
  }

  observeAll()

  const mo = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement))
          continue
        if (node.hasAttribute(REVEAL_ATTR)) {
          if (isInOrAboveViewport(node)) {
            node.setAttribute(REVEALED_ATTR, '')
          }
          else {
            prepareEntry(node)
            io.observe(node)
          }
        }
        observeAll(node)
      }
    }
  })

  mo.observe(document.body, { childList: true, subtree: true })

  return () => {
    io.disconnect()
    mo.disconnect()
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  }
}
