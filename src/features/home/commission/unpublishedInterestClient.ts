const STORAGE_KEY_PREFIX = 'commission-index:unpublished-interest:'
const BUTTON_SELECTOR = '[data-commission-interest-key]'
const LABEL_SELECTOR = '[data-commission-interest-label]'

interface TrackProperties {
  sub_event: string
}

interface MountUnpublishedInterestButtonsOptions {
  win?: Window
  doc?: Document
  trackEvent?: (properties: TrackProperties) => void
}

const getStorageKey = (commissionKey: string) => `${STORAGE_KEY_PREFIX}${commissionKey}`

function readRecordedState(commissionKey: string, storage: Storage | undefined) {
  try {
    return storage?.getItem(getStorageKey(commissionKey)) === '1'
  }
  catch {
    return false
  }
}

function writeRecordedState(commissionKey: string, storage: Storage | undefined) {
  try {
    storage?.setItem(getStorageKey(commissionKey), '1')
  }
  catch {}
}

function setButtonState(button: HTMLButtonElement, recorded: boolean) {
  const label = button.querySelector<HTMLSpanElement>(LABEL_SELECTOR)
  if (label) {
    if (!button.dataset.commissionInterestDefaultLabel) {
      button.dataset.commissionInterestDefaultLabel = label.textContent ?? ''
    }

    label.textContent = recorded
      ? (button.dataset.commissionInterestRecordedLabel
        ?? button.dataset.commissionInterestDefaultLabel)
      : button.dataset.commissionInterestDefaultLabel
  }

  if (!button.dataset.commissionInterestDefaultTitle) {
    button.dataset.commissionInterestDefaultTitle = button.title
  }

  button.disabled = recorded
  button.setAttribute('aria-pressed', String(recorded))

  if (recorded) {
    button.removeAttribute('data-link-style')
    button.title
      = button.dataset.commissionInterestRecordedTitle
        ?? button.dataset.commissionInterestDefaultTitle
        ?? ''
    return
  }

  button.dataset.linkStyle = 'true'
  button.title = button.dataset.commissionInterestDefaultTitle ?? ''
}

function resolveInterestButton(target: EventTarget | null) {
  if (target instanceof HTMLButtonElement && target.matches(BUTTON_SELECTOR))
    return target
  if (target instanceof Element) {
    return target.closest<HTMLButtonElement>(BUTTON_SELECTOR)
  }
  return null
}

export function mountUnpublishedInterestButtons({
  win = window,
  doc = document,
  trackEvent,
}: MountUnpublishedInterestButtonsOptions = {}) {
  const buttons = [...doc.querySelectorAll<HTMLButtonElement>(BUTTON_SELECTOR)]
  const storage = win.localStorage
  const hydratedButtons = new WeakSet<HTMLButtonElement>()

  const hydrateButton = (button: HTMLButtonElement) => {
    const commissionKey = button.dataset.commissionInterestKey
    if (!commissionKey || hydratedButtons.has(button))
      return

    setButtonState(button, readRecordedState(commissionKey, storage))
    hydratedButtons.add(button)
  }

  const handleClick = (event: Event) => {
    const button = resolveInterestButton(event.target)
    if (!button)
      return

    hydrateButton(button)

    const commissionKey = button.dataset.commissionInterestKey
    if (!commissionKey || button.disabled)
      return

    setButtonState(button, true)
    writeRecordedState(commissionKey, storage)
    trackEvent?.({ sub_event: commissionKey })
  }

  for (const button of buttons) {
    hydrateButton(button)
  }
  doc.addEventListener('click', handleClick)

  return () => {
    doc.removeEventListener('click', handleClick)
  }
}
