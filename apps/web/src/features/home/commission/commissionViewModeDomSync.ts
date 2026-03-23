import { readCommissionViewMode } from '#features/home/commission/viewModeState'
import { COMMISSION_VIEW_MODE_CHANGE_EVENT } from '#features/home/events'

const PANEL_SELECTOR = '[data-commission-view-panel]'
const FADE_OUT_MS = 150
const FADE_IN_MS = 200
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  catch {
    return false
  }
}

interface MountCommissionViewModeDomSyncOptions {
  win?: Window
  doc?: Document
}

export function mountCommissionViewModeDomSync({
  win = window,
  doc = document,
}: MountCommissionViewModeDomSyncOptions = {}) {
  let transitioning = false

  const applyInstant = (panels: NodeListOf<HTMLElement>, mode: string) => {
    for (const panel of panels) {
      const panelMode = panel.dataset.commissionViewPanel
      if (panelMode !== 'character' && panelMode !== 'timeline')
        continue
      const isActive = panelMode === mode
      panel.dataset.commissionViewActive = isActive ? 'true' : 'false'
      panel.classList.toggle('hidden', !isActive)
      panel.style.removeProperty('opacity')
      panel.style.removeProperty('transition')
    }
  }

  const syncPanelsByMode = () => {
    const mode = readCommissionViewMode(win)
    const panels = doc.querySelectorAll<HTMLElement>(PANEL_SELECTOR)

    let outgoing: HTMLElement | null = null
    let incoming: HTMLElement | null = null

    for (const panel of panels) {
      const panelMode = panel.dataset.commissionViewPanel
      if (panelMode !== 'character' && panelMode !== 'timeline')
        continue
      if (panelMode === mode)
        incoming = panel
      else if (panel.dataset.commissionViewActive === 'true')
        outgoing = panel
    }

    if (!outgoing || !incoming || outgoing === incoming || transitioning || prefersReducedMotion()) {
      applyInstant(panels, mode)
      transitioning = false
      return
    }

    transitioning = true

    outgoing.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`
    outgoing.style.opacity = '0'

    let outDone = false
    const onOutDone = () => {
      if (outDone)
        return
      outDone = true

      outgoing.classList.add('hidden')
      outgoing.dataset.commissionViewActive = 'false'
      outgoing.style.removeProperty('transition')
      outgoing.style.removeProperty('opacity')

      incoming.style.opacity = '0'
      incoming.classList.remove('hidden')
      incoming.dataset.commissionViewActive = 'true'

      requestAnimationFrame(() => {
        incoming.style.transition = `opacity ${FADE_IN_MS}ms ${EASE_OUT}`
        requestAnimationFrame(() => {
          incoming.style.opacity = '1'

          let inDone = false
          const cleanup = () => {
            if (inDone)
              return
            inDone = true
            incoming.style.removeProperty('transition')
            incoming.style.removeProperty('opacity')
            transitioning = false
          }

          incoming.addEventListener('transitionend', cleanup, { once: true })
          setTimeout(cleanup, FADE_IN_MS + 50)
        })
      })
    }

    outgoing.addEventListener('transitionend', onOutDone, { once: true })
    setTimeout(onOutDone, FADE_OUT_MS + 50)
  }

  win.addEventListener('popstate', syncPanelsByMode)
  win.addEventListener(COMMISSION_VIEW_MODE_CHANGE_EVENT, syncPanelsByMode)
  syncPanelsByMode()

  return () => {
    win.removeEventListener('popstate', syncPanelsByMode)
    win.removeEventListener(COMMISSION_VIEW_MODE_CHANGE_EVENT, syncPanelsByMode)
  }
}
