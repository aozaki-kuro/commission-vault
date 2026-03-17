import type Fuse from 'fuse.js'

export type SuggestionSource = 'Character' | 'Creator' | 'Keyword' | 'Date'

export interface Suggestion {
  term: string
  count: number
  sources: SuggestionSource[]
}

export type FilteredSuggestion = Suggestion & {
  matchedCount: number
}

export type SuggestionTokenOperator = 'exclude' | 'or' | 'and' | null

export interface SearchEntryLike {
  id: number
  searchText: string
}

export type SuggestionRows = Map<string, { source: SuggestionSource, term: string }>

export interface SuggestionEntryLike {
  id: number
  suggestionRows: SuggestionRows
}

export interface SearchIndexLike<T extends SearchEntryLike> {
  cacheKey?: object
  entries: T[]
  allIds: Set<number>
  strictTermIndex?: Map<string, Set<number>>
  fuse: Fuse<T> | null
}
