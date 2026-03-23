import {
  hasConnectedCharacterPanelTargetId,
  hasDeferredHomeCharacterTarget,
  normalizeHomeCharacterTargetId,
  readHomeCharacterBatchManifest,
  resolveHomeCharacterTargetBatch,
} from '#features/home/commission/batch/homeCharacterBatchManifest'
import { templateContentContainsElementId } from '#features/home/commission/batch/templateContentLookup'
import { readCommissionViewMode } from '#features/home/commission/viewModeState'

export const ARCHIVED_CHARACTERS_SHOW_REQUEST_EVENT = 'home:archived-show-request'
export const ARCHIVED_CHARACTERS_LOAD_REQUEST_EVENT = 'home:archived-load-request'
export const ARCHIVED_CHARACTERS_LOADED_EVENT = 'home:archived-loaded'
export const ARCHIVED_CHARACTERS_COLLAPSE_REQUEST_EVENT = 'home:archived-collapse-request'
export const ARCHIVED_CHARACTERS_COLLAPSED_EVENT = 'home:archived-collapsed'
export const ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT = 'home:archived-state-change'

const CHARACTER_PANEL_SELECTOR = '[data-commission-view-panel="character"]'
const FIRST_STALE_SECTION_SELECTOR
  = '[data-character-section="true"][data-character-status="archived"]'
const STALE_TEMPLATE_SELECTOR = 'template[data-archived-sections-template="true"]'
const ARCHIVED_DEFERRED_TEMPLATE_SELECTOR = 'template[data-archived-deferred-sections-template="true"]'
const STALE_VISIBILITY_STORAGE_KEY = 'home:archived-visibility'
const STALE_VIEWPORT_FOCUS_RATIO = 0.5

export type ArchivedCharactersVisibility = 'visible' | 'hidden'

export interface RequestArchivedCharactersLoadOptions {
  preserveScroll?: boolean
  strategy?: 'next' | 'all' | 'target'
  targetId?: string
  targetBatchCount?: number
}

export interface ArchivedCharactersState {
  visibility: ArchivedCharactersVisibility
  loaded: boolean
}

interface SavedArchivedCharactersVisibility {
  pathname: string
  visibility: ArchivedCharactersVisibility
}

const HIDDEN_STATE: ArchivedCharactersState = {
  visibility: 'hidden',
  loaded: false,
}

function resolveVisibility(panel: HTMLElement | null | undefined): ArchivedCharactersVisibility {
  if (panel?.dataset.archivedVisibility === 'visible')
    return 'visible'
  if (panel?.dataset.archivedVisibility === 'hidden')
    return 'hidden'
  return panel?.dataset.archivedLoaded === 'true' ? 'visible' : 'hidden'
}

function resolveLoaded(panel: HTMLElement | null | undefined) {
  return panel?.dataset.archivedLoaded === 'true'
}

export function readArchivedCharactersLoadedBatchCount(doc?: Document) {
  const resolvedDocument = doc ?? (typeof document !== 'undefined' ? document : null)
  if (!resolvedDocument)
    return 0

  const panel = resolvedDocument.querySelector<HTMLElement>(CHARACTER_PANEL_SELECTOR)
  const value = Number(panel?.dataset.archivedBatchesLoadedCount ?? '0')
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export function readArchivedCharactersStateFromPanel(panel: HTMLElement | null | undefined): ArchivedCharactersState {
  return {
    visibility: resolveVisibility(panel),
    loaded: resolveLoaded(panel),
  }
}

export function readArchivedCharactersState(doc?: Document): ArchivedCharactersState {
  const resolvedDocument = doc ?? (typeof document !== 'undefined' ? document : null)
  if (!resolvedDocument)
    return HIDDEN_STATE

  return readArchivedCharactersStateFromPanel(
    resolvedDocument.querySelector<HTMLElement>(CHARACTER_PANEL_SELECTOR),
  )
}

export function isArchivedCharactersVisible(doc?: Document) {
  return readArchivedCharactersState(doc).visibility === 'visible'
}

export function writeArchivedCharactersState(panel: HTMLElement, state: ArchivedCharactersState): ArchivedCharactersState {
  panel.dataset.archivedVisibility = state.visibility
  panel.dataset.archivedLoaded = state.loaded ? 'true' : 'false'
  return readArchivedCharactersStateFromPanel(panel)
}

export function writeArchivedCharactersLoadedBatchCount(panel: HTMLElement, count: number) {
  panel.dataset.archivedBatchesLoadedCount = String(Math.max(0, Math.floor(count)))
}

export function dispatchArchivedCharactersStateChange(win: Window, state: ArchivedCharactersState) {
  win.dispatchEvent(
    new CustomEvent<ArchivedCharactersState>(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, {
      detail: state,
    }),
  )
}

export function requestArchivedCharactersVisibility(win: Window, visibility: ArchivedCharactersVisibility) {
  win.dispatchEvent(
    new Event(
      visibility === 'visible'
        ? ARCHIVED_CHARACTERS_SHOW_REQUEST_EVENT
        : ARCHIVED_CHARACTERS_COLLAPSE_REQUEST_EVENT,
    ),
  )
}

export function requestArchivedCharactersLoad(win: Window, options: RequestArchivedCharactersLoadOptions = {}) {
  win.dispatchEvent(
    new CustomEvent<RequestArchivedCharactersLoadOptions>(ARCHIVED_CHARACTERS_LOAD_REQUEST_EVENT, {
      detail: options,
    }),
  )
}

export function shouldPreserveScrollOnArchivedLoadRequest(event: Event) {
  if (!(event instanceof CustomEvent))
    return true
  return event.detail?.preserveScroll !== false
}

export function readSavedArchivedCharactersVisibility(win: Window): ArchivedCharactersVisibility | null {
  try {
    const rawState = win.sessionStorage.getItem(STALE_VISIBILITY_STORAGE_KEY)
    if (!rawState)
      return null

    const parsedState = JSON.parse(rawState) as Partial<SavedArchivedCharactersVisibility>
    if (
      parsedState.pathname !== win.location.pathname
      || (parsedState.visibility !== 'visible' && parsedState.visibility !== 'hidden')
    ) {
      return null
    }

    return parsedState.visibility
  }
  catch {
    return null
  }
}

export function persistArchivedCharactersVisibility(win: Window, visibility: ArchivedCharactersVisibility) {
  try {
    win.sessionStorage.setItem(
      STALE_VISIBILITY_STORAGE_KEY,
      JSON.stringify({
        pathname: win.location.pathname,
        visibility,
      } satisfies SavedArchivedCharactersVisibility),
    )
  }
  catch {
    // Ignore storage write failures so archived toggling keeps working.
  }
}

export function resolveReloadArchivedCharactersVisibility({
  doc,
  win,
}: {
  doc?: Document
  win?: Window
}): ArchivedCharactersVisibility {
  const resolvedWindow = win ?? (typeof window !== 'undefined' ? window : null)
  const resolvedDocument = doc ?? (typeof document !== 'undefined' ? document : null)
  if (!resolvedWindow || !resolvedDocument)
    return 'hidden'

  if (readCommissionViewMode(resolvedWindow) !== 'character') {
    return 'hidden'
  }

  if (!isArchivedCharactersVisible(resolvedDocument)) {
    return 'hidden'
  }

  const firstArchivedSection = resolvedDocument.querySelector<HTMLElement>(
    FIRST_STALE_SECTION_SELECTOR,
  )
  if (!firstArchivedSection) {
    return 'visible'
  }

  const archivedStartY = firstArchivedSection.getBoundingClientRect().top + resolvedWindow.scrollY
  const viewportFocusY
    = resolvedWindow.scrollY + resolvedWindow.innerHeight * STALE_VIEWPORT_FOCUS_RATIO

  return viewportFocusY >= archivedStartY ? 'visible' : 'hidden'
}

export function persistReloadArchivedCharactersVisibility({
  doc,
  win,
}: {
  doc?: Document
  win: Window
}) {
  persistArchivedCharactersVisibility(win, resolveReloadArchivedCharactersVisibility({ doc, win }))
}

function getDeferredArchivedTemplate(doc: Document) {
  const liveTemplate = doc.querySelector<HTMLTemplateElement>(ARCHIVED_DEFERRED_TEMPLATE_SELECTOR)
  if (liveTemplate)
    return liveTemplate

  const rootTemplate = doc.querySelector<HTMLTemplateElement>(STALE_TEMPLATE_SELECTOR)
  return (
    rootTemplate?.content.querySelector<HTMLTemplateElement>(ARCHIVED_DEFERRED_TEMPLATE_SELECTOR)
    ?? null
  )
}

export function hasArchivedCharacterTarget(doc: Document, rawSectionId: string | null | undefined) {
  if (hasDeferredHomeCharacterTarget({ doc, rawTargetId: rawSectionId, status: 'archived' })) {
    return true
  }

  const sectionId = normalizeHomeCharacterTargetId(rawSectionId)
  if (!sectionId)
    return false
  if (hasConnectedCharacterPanelTargetId(doc, sectionId))
    return true
  if (readHomeCharacterBatchManifest(doc))
    return false

  const template = doc.querySelector<HTMLTemplateElement>(STALE_TEMPLATE_SELECTOR)
  if (!template)
    return false

  return templateContentContainsElementId(template.content, sectionId)
}

export function hasDeferredArchivedCharacterTarget(doc: Document, rawSectionId: string | null | undefined) {
  if (hasDeferredHomeCharacterTarget({ doc, rawTargetId: rawSectionId, status: 'archived' })) {
    return true
  }

  const sectionId = normalizeHomeCharacterTargetId(rawSectionId)
  if (!sectionId)
    return false
  if (hasConnectedCharacterPanelTargetId(doc, sectionId))
    return false
  if (readHomeCharacterBatchManifest(doc))
    return false

  const template = getDeferredArchivedTemplate(doc)
  if (!template)
    return false

  return templateContentContainsElementId(template.content, sectionId)
}

export function resolveDeferredArchivedCharacterBatch(doc: Document, rawSectionId: string | null | undefined) {
  const resolvedBatch = resolveHomeCharacterTargetBatch({
    doc,
    rawTargetId: rawSectionId,
    status: 'archived',
  })
  if (resolvedBatch !== null)
    return resolvedBatch

  const sectionId = normalizeHomeCharacterTargetId(rawSectionId)
  if (!sectionId || hasConnectedCharacterPanelTargetId(doc, sectionId))
    return null
  if (readHomeCharacterBatchManifest(doc))
    return null

  const rootTemplate = doc.querySelector<HTMLTemplateElement>(STALE_TEMPLATE_SELECTOR)
  if (rootTemplate && templateContentContainsElementId(rootTemplate.content, sectionId)) {
    return 0
  }

  const template = getDeferredArchivedTemplate(doc)
  return template && templateContentContainsElementId(template.content, sectionId) ? 1 : null
}
