import type { SuggestionTokenOperator } from '@lib/search/index'
import type { SuggestionViewModel } from './commissionSearchDropdownRenderer'
import type { CommissionSearchEntrySource, SearchIndex } from './commissionSearchIndex'
import type { PanelLoadedState } from './commissionSearchPanelState'
import type { CommissionViewMode } from './commissionViewMode'

export type { SuggestionViewModel }

export interface SearchState {
  // Input
  query: string
  inputQuery: string | null

  // Index
  isIndexReady: boolean
  shouldWarmFuse: boolean
  externalEntries: CommissionSearchEntrySource[] | null
  resolvedIndex: SearchIndex

  // Matching
  matchedIds: Set<number>
  deferredQuery: string

  // Suggestions
  isSuggestionPanelDismissed: boolean
  activeCommandValue: string
  suggestionViewModels: SuggestionViewModel[]
  suggestionOperator: SuggestionTokenOperator
  suggestionIsExclusion: boolean
  shouldShowSuggestionPanel: boolean
  shouldAnimateSuggestionPanel: boolean
  shouldShowHiddenArchivedNotice: boolean

  // Display
  visibleStatusMessage: string
  hiddenArchivedNoticeMessage: string
  visibleEntriesCount: number
  visibleMatchedCount: number
  hiddenArchivedMatchedCount: number

  // Popular keywords
  popularKeywordPage: number
  hasDismissedFeaturedKeywords: boolean
  popularKeywordPool: string[]
  popularKeywords: string[]

  // Copy
  copyState: 'idle' | 'success'

  // Help
  isHelpOpen: boolean

  // External state
  mode: CommissionViewMode
  panelState: PanelLoadedState
}

// ==================== 内部状态 ====================

let state: SearchState | null = null
let listeners: (() => void)[] = []
let batchDepth = 0

// ==================== 公开 API ====================

export function initStore(initial: SearchState): void {
  state = initial
}

export function getState(): SearchState {
  if (!state)
    throw new Error('Search store not initialized — call initStore() first')
  return state
}

export function setState(next: Partial<SearchState>): void {
  if (!state)
    throw new Error('Search store not initialized — call initStore() first')
  Object.assign(state, next)
  if (batchDepth === 0)
    notify()
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter(l => l !== fn)
  }
}

export function batchUpdate(updater: () => void): void {
  batchDepth++
  try {
    updater()
  }
  finally {
    batchDepth--
    if (batchDepth === 0)
      notify()
  }
}

// ==================== 内部 ====================

function notify(): void {
  for (const fn of listeners) fn()
}
