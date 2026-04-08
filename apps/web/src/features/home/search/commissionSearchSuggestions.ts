interface FocusInputOptions {
  preventScroll?: boolean
}

interface SuggestionPanelController {
  focusInputAfterSelection: (nextQuery: string, options?: FocusInputOptions) => void
  shouldSuppressInputFocusOpen: () => boolean
  bindOutsideListeners: (searchRoot: HTMLElement, dismissFn: () => void) => void
  unbindOutsideListeners: () => void
}

export function createSuggestionPanelController(
  inputEl: HTMLInputElement,
): SuggestionPanelController {
  let suppressNextFocusOpen = false
  let pointerHandler: ((e: PointerEvent) => void) | null = null
  let keyHandler: ((e: KeyboardEvent) => void) | null = null

  function focusInputAfterSelection(nextQuery: string, options?: FocusInputOptions) {
    suppressNextFocusOpen = true

    requestAnimationFrame(() => {
      inputEl.focus(options)
      const cursor = nextQuery.length
      inputEl.setSelectionRange(cursor, cursor)

      requestAnimationFrame(() => {
        suppressNextFocusOpen = false
      })
    })
  }

  function shouldSuppressInputFocusOpen(): boolean {
    if (!suppressNextFocusOpen)
      return false
    suppressNextFocusOpen = false
    return true
  }

  function bindOutsideListeners(searchRoot: HTMLElement, dismissFn: () => void) {
    unbindOutsideListeners()

    pointerHandler = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node))
        return
      if (searchRoot.contains(target))
        return
      dismissFn()
    }

    keyHandler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape')
        return
      dismissFn()
    }

    window.addEventListener('pointerdown', pointerHandler, true)
    window.addEventListener('keydown', keyHandler)
  }

  function unbindOutsideListeners() {
    if (pointerHandler) {
      window.removeEventListener('pointerdown', pointerHandler, true)
      pointerHandler = null
    }
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler)
      keyHandler = null
    }
  }

  return {
    focusInputAfterSelection,
    shouldSuppressInputFocusOpen,
    bindOutsideListeners,
    unbindOutsideListeners,
  }
}
