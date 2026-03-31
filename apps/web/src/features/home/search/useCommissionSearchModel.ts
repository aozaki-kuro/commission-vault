import type { CommissionSearchEntrySource, SearchIndex, SearchSuggestionAliasGroup } from '@features/home/search/commissionSearchIndex'
import type { SuggestionViewModel } from '@features/home/search/CommissionSearchSuggestionDropdown'
import { requestActiveCharactersLoad } from '@features/home/commission/loader/activeCharactersEvent'
import {
  requestArchivedCharactersLoad,
  requestArchivedCharactersVisibility,
} from '@features/home/commission/loader/archivedCharactersEvent'
import { requestTimelineViewLoad } from '@features/home/commission/loader/timelineViewEvent'
import { LOAD_ARCHIVED_COMMAND_VALUE } from '@features/home/search/commissionSearchConstants'
import {
  buildRelatedSuggestionTermsMap,
  buildSearchIndex,

  createEmptySearchIndex,
  getDisplayMetrics,

} from '@features/home/search/commissionSearchIndex'
import { useCommissionSearchDomSync } from '@features/home/search/useCommissionSearchDomSync'
import { useSearchPanelLoadedState } from '@features/home/search/useSearchPanelLoadedState'
import { ANALYTICS_EVENTS } from '@lib/analytics/events'
import { trackRybbitEvent } from '@lib/analytics/track'
import {
  filterSuggestions,
  getMatchedEntryIds,
  hydrateSearchIndexFuse,
  normalizeQuery,
  parseSuggestionInputState,
  resolveSuggestionContextMatchedIds,
} from '@lib/search/index'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

interface SearchControls {
  sourceCharacter: string
  sourceCreator: string
  sourceKeyword: string
  sourceDate: string
  formatMatchCount: (count: number) => string
  formatSearchResultsStatus: (matchedCount: number, totalCount: number) => string
  formatSearchClearedStatus: (totalCount: number) => string
  formatHiddenArchivedResultsNotice: (hiddenCount: number) => string
}

interface UseCommissionSearchModelOptions {
  activeCommandValue: string
  controls: SearchControls
  deferIndexInit: boolean
  disableDomFiltering: boolean
  externalEntries?: CommissionSearchEntrySource[]
  initialQuery?: string
  isSuggestionPanelDismissed: boolean
  mode: 'character' | 'timeline'
  onMatchedIdsChange?: (matchedIds: Set<number>) => void
  onQueryChange?: (query: string) => void
  suggestionAliasGroups: SearchSuggestionAliasGroup[]
  suppressInitialSuggestionPanelAnimation: boolean
}

const MIN_TRACK_QUERY_LENGTH = 2
const EMPTY_RELATED_SUGGESTION_TERMS_MAP = new Map<string, string[]>()
const SEARCH_QUERY_LOCATION_CHANGE_EVENT = 'home:search-query-location-change'

function getUrlQuerySnapshot() {
  if (typeof window === 'undefined')
    return ''
  return new URLSearchParams(window.location.search).get('q') ?? ''
}

export function dispatchSearchQueryLocationChange() {
  if (typeof window === 'undefined')
    return
  window.dispatchEvent(new Event(SEARCH_QUERY_LOCATION_CHANGE_EVENT))
}

export function subscribeToUrlQuerySnapshot(onStoreChange: () => void) {
  if (typeof window === 'undefined')
    return () => {}

  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(SEARCH_QUERY_LOCATION_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(SEARCH_QUERY_LOCATION_CHANGE_EVENT, onStoreChange)
  }
}

export function getDomSnapshotKeyForMode({
  activeBatchCount,
  activeLoaded,
  mode,
  archivedBatchCount,
  archivedLoaded,
  archivedVisible,
  timelineLoaded,
}: {
  activeBatchCount: number
  activeLoaded: boolean
  mode: 'character' | 'timeline'
  archivedBatchCount: number
  archivedLoaded: boolean
  archivedVisible: boolean
  timelineLoaded: boolean
}) {
  return mode === 'character'
    ? `character:active-${activeLoaded ? 'loaded' : 'pending'}-${activeBatchCount}:archived-${
      archivedLoaded ? 'loaded' : archivedVisible ? 'visible' : 'hidden'
    }-${archivedBatchCount}`
    : `timeline:${timelineLoaded ? 'timeline-loaded' : 'timeline-pending'}`
}

export function resolveEffectiveDomSnapshotKey({
  domSnapshotKey,
  skipDomContext,
}: {
  domSnapshotKey: string
  skipDomContext: boolean
}) {
  return skipDomContext ? 'skip-dom-context' : domSnapshotKey
}

function syncDeferredAllLoadRequest({
  didRequestRef,
  request,
  shouldRequest,
}: {
  didRequestRef: { current: boolean }
  request: () => void
  shouldRequest: boolean
}) {
  if (!shouldRequest) {
    didRequestRef.current = false
    return
  }

  if (didRequestRef.current)
    return
  didRequestRef.current = true
  request()
}

export function useCommissionSearchModel({
  activeCommandValue,
  controls,
  deferIndexInit,
  disableDomFiltering,
  externalEntries,
  initialQuery,
  isSuggestionPanelDismissed,
  mode,
  onMatchedIdsChange,
  onQueryChange,
  suggestionAliasGroups,
  suppressInitialSuggestionPanelAnimation,
}: UseCommissionSearchModelOptions) {
  const suggestionSourceLabels = useMemo(
    () =>
      ({
        Character: controls.sourceCharacter,
        Creator: controls.sourceCreator,
        Keyword: controls.sourceKeyword,
        Date: controls.sourceDate,
      }) as const,
    [controls.sourceCharacter, controls.sourceCreator, controls.sourceDate, controls.sourceKeyword],
  )
  const initialUrlQuery = useSyncExternalStore(
    subscribeToUrlQuerySnapshot,
    getUrlQuerySnapshot,
    () => '',
  )
  const [inputQuery, setInputQuery] = useState<string | null>(initialQuery ?? null)
  const query = inputQuery ?? initialUrlQuery
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = normalizeQuery(query)
  const hasQuery = !!normalizedQuery
  const normalizedDeferredQuery = normalizeQuery(deferredQuery)
  const hasDeferredQuery = !!normalizedDeferredQuery
  const { suggestionQuery, suggestionContextQuery, suggestionOperator, suggestionIsExclusion }
    = useMemo(() => {
      const parsed = parseSuggestionInputState(deferredQuery)

      return {
        suggestionQuery: normalizeQuery(parsed.suggestionQuery),
        suggestionContextQuery: parsed.suggestionContextQuery,
        suggestionOperator: parsed.suggestionOperator,
        suggestionIsExclusion: parsed.suggestionIsExclusion,
      }
    }, [deferredQuery])

  const [isIndexReady, setIsIndexReady] = useState(
    () => !deferIndexInit || !!initialQuery || !!initialUrlQuery,
  )
  const [shouldWarmFuse, setShouldWarmFuse] = useState(
    () => !deferIndexInit || !!initialQuery || !!initialUrlQuery,
  )
  const {
    activeBatchCount,
    activeLoaded,
    archivedBatchCount,
    archivedLoaded,
    archivedVisible,
    timelineLoaded,
  } = useSearchPanelLoadedState()
  const shouldBuildIndex = isIndexReady || !deferIndexInit || !!query || !!initialUrlQuery
  const shouldSkipDomContext = disableDomFiltering && Boolean(externalEntries)
  const domSnapshotKey = getDomSnapshotKeyForMode({
    activeBatchCount,
    activeLoaded,
    mode,
    archivedBatchCount,
    archivedLoaded,
    archivedVisible,
    timelineLoaded,
  })
  const effectiveDomSnapshotKey = resolveEffectiveDomSnapshotKey({
    domSnapshotKey,
    skipDomContext: shouldSkipDomContext,
  })
  const didRequestActiveAllRef = useRef(false)
  const didRequestArchivedAllRef = useRef(false)
  const didRequestTimelineAllRef = useRef(false)

  useEffect(() => {
    syncDeferredAllLoadRequest({
      didRequestRef: didRequestActiveAllRef,
      request: () => {
        requestActiveCharactersLoad(window, { strategy: 'all' })
      },
      shouldRequest:
        !disableDomFiltering && mode === 'character' && hasDeferredQuery && !activeLoaded,
    })
  }, [activeLoaded, disableDomFiltering, hasDeferredQuery, mode])

  useEffect(() => {
    syncDeferredAllLoadRequest({
      didRequestRef: didRequestArchivedAllRef,
      request: () => {
        // While searching, archived expansion should eagerly load all deferred archived batches
        // so filtering can be applied across the full archived set without requiring extra scroll.
        requestArchivedCharactersLoad(window, { preserveScroll: true, strategy: 'all' })
      },
      shouldRequest:
        !disableDomFiltering
        && mode === 'character'
        && hasDeferredQuery
        && archivedVisible
        && !archivedLoaded,
    })
  }, [disableDomFiltering, hasDeferredQuery, mode, archivedLoaded, archivedVisible])

  useEffect(() => {
    syncDeferredAllLoadRequest({
      didRequestRef: didRequestTimelineAllRef,
      request: () => {
        requestTimelineViewLoad(window, { strategy: 'all' })
      },
      shouldRequest:
        !disableDomFiltering && mode === 'timeline' && hasDeferredQuery && !timelineLoaded,
    })
  }, [disableDomFiltering, hasDeferredQuery, mode, timelineLoaded])

  const index = useMemo(() => {
    if (!shouldBuildIndex)
      return createEmptySearchIndex()
    return buildSearchIndex(mode, externalEntries, {
      domSnapshotKey: effectiveDomSnapshotKey,
      skipDomContext: shouldSkipDomContext,
    })
  }, [effectiveDomSnapshotKey, externalEntries, mode, shouldBuildIndex, shouldSkipDomContext])
  const [hydratedIndex, setHydratedIndex] = useState<SearchIndex | null>(null)
  const resolvedIndex = useMemo(() => {
    if (!hydratedIndex || hydratedIndex.entries !== index.entries) {
      return index
    }

    if (index.fuse) {
      return index
    }

    return {
      ...index,
      fuse: hydratedIndex.fuse,
    }
  }, [hydratedIndex, index])
  const shouldHydrateFuse = shouldWarmFuse || hasQuery

  useEffect(() => {
    let active = true
    if (!shouldHydrateFuse || !index.entries.length || resolvedIndex.fuse) {
      return () => {
        active = false
      }
    }

    void hydrateSearchIndexFuse(index).then((nextIndex) => {
      if (!active)
        return
      setHydratedIndex(nextIndex)
    })

    return () => {
      active = false
    }
  }, [index, resolvedIndex.fuse, shouldHydrateFuse])

  const matchedIds = useMemo(
    () => getMatchedEntryIds(deferredQuery, resolvedIndex),
    [deferredQuery, resolvedIndex],
  )
  const { visibleEntriesCount, visibleMatchedCount, hiddenArchivedMatchedCount } = useMemo(
    () =>
      getDisplayMetrics({
        searchIndex: resolvedIndex,
        matchedIds,
        disableDomFiltering,
        hasDeferredQuery,
        mode,
        archivedLoaded,
      }),
    [disableDomFiltering, hasDeferredQuery, matchedIds, mode, resolvedIndex, archivedLoaded],
  )

  const didAutoShowArchivedRef = useRef(false)

  useEffect(() => {
    // Reset suppression when query context changes away from "archived-only results".
    // Intentionally does NOT reset when archivedVisible flips — that would cause re-trigger
    // immediately after the user manually collapses the archived section.
    if (!hasDeferredQuery || visibleMatchedCount > 0) {
      // Reset dedup ref so the next archived-only query can auto-show again.
      // Clearing the query does not hide the archived section — that's a separate
      // user-initiated action; this effect only shows, never hides.
      didAutoShowArchivedRef.current = false
      return
    }

    if (didAutoShowArchivedRef.current)
      return

    if (
      !disableDomFiltering
      && mode === 'character'
      && !archivedVisible
      && hiddenArchivedMatchedCount > 0
    ) {
      didAutoShowArchivedRef.current = true
      requestArchivedCharactersVisibility(window, 'visible')
    }
  }, [
    disableDomFiltering,
    hasDeferredQuery,
    mode,
    archivedVisible,
    visibleMatchedCount,
    hiddenArchivedMatchedCount,
  ])

  const suggestionContextMatchedIds = useMemo(() => {
    return resolveSuggestionContextMatchedIds({
      rawQuery: deferredQuery,
      suggestionQuery,
      suggestionContextQuery,
      matchedIds,
      index: resolvedIndex,
      suggestionOperator,
    })
  }, [
    deferredQuery,
    matchedIds,
    resolvedIndex,
    suggestionContextQuery,
    suggestionOperator,
    suggestionQuery,
  ])

  const filteredSuggestions = useMemo(() => {
    return filterSuggestions({
      entries: resolvedIndex.entries,
      suggestions: resolvedIndex.suggestions,
      suggestionQuery,
      suggestionContextQuery,
      suggestionContextMatchedIds,
      isExclusionSuggestion: suggestionIsExclusion,
    })
  }, [
    resolvedIndex.entries,
    resolvedIndex.suggestions,
    suggestionContextMatchedIds,
    suggestionContextQuery,
    suggestionIsExclusion,
    suggestionQuery,
  ])

  const hasSuggestionResults = filteredSuggestions.length > 0
  const relatedSuggestionTermsMap = useMemo(
    () =>
      hasSuggestionResults
        ? buildRelatedSuggestionTermsMap(resolvedIndex.entries, suggestionAliasGroups)
        : EMPTY_RELATED_SUGGESTION_TERMS_MAP,
    [hasSuggestionResults, resolvedIndex.entries, suggestionAliasGroups],
  )

  const suggestionViewModels = useMemo<SuggestionViewModel[]>(() => {
    return filteredSuggestions.map(suggestion => ({
      term: suggestion.term,
      matchCountLabel: controls.formatMatchCount(suggestion.matchedCount),
      sourcesLabel: suggestion.sources.map(source => suggestionSourceLabels[source]).join(' / '),
      relatedTerms: relatedSuggestionTermsMap.get(suggestion.term.trim().toLowerCase()) ?? [],
    }))
  }, [controls, filteredSuggestions, relatedSuggestionTermsMap, suggestionSourceLabels])

  const shouldShowHiddenArchivedNotice = hiddenArchivedMatchedCount > 0
  const shouldShowSuggestionPanel
    = !isSuggestionPanelDismissed
      && hasQuery
      && (suggestionViewModels.length > 0 || shouldShowHiddenArchivedNotice)

  const visibleStatusMessage = useMemo(
    () =>
      hasDeferredQuery
        ? controls.formatSearchResultsStatus(visibleMatchedCount, visibleEntriesCount)
        : controls.formatSearchClearedStatus(visibleEntriesCount),
    [controls, hasDeferredQuery, visibleEntriesCount, visibleMatchedCount],
  )
  const hiddenArchivedNoticeMessage = useMemo(
    () => controls.formatHiddenArchivedResultsNotice(hiddenArchivedMatchedCount),
    [controls, hiddenArchivedMatchedCount],
  )

  const resolvedActiveCommandValue = useMemo(() => {
    if (shouldShowHiddenArchivedNotice && activeCommandValue === LOAD_ARCHIVED_COMMAND_VALUE) {
      return LOAD_ARCHIVED_COMMAND_VALUE
    }

    if (suggestionViewModels.some(item => item.term === activeCommandValue)) {
      return activeCommandValue
    }

    if (suggestionViewModels.length > 0) {
      return suggestionViewModels[0].term
    }

    return shouldShowHiddenArchivedNotice ? LOAD_ARCHIVED_COMMAND_VALUE : ''
  }, [activeCommandValue, shouldShowHiddenArchivedNotice, suggestionViewModels])

  const shouldSuppressHandoffPanelAnimation
    = suppressInitialSuggestionPanelAnimation && !!initialQuery && query === initialQuery
  const shouldAnimateSuggestionPanel = !shouldSuppressHandoffPanelAnimation
  const statusMessage = useMemo(
    () =>
      shouldShowHiddenArchivedNotice
        ? `${visibleStatusMessage} ${hiddenArchivedNoticeMessage}`
        : visibleStatusMessage,
    [hiddenArchivedNoticeMessage, shouldShowHiddenArchivedNotice, visibleStatusMessage],
  )
  const { liveRef } = useCommissionSearchDomSync({
    disableDomFiltering,
    hasDeferredQuery,
    hiddenArchivedMatchedCount,
    matchedIds,
    resolvedIndex,
    archivedBatchCount,
    archivedVisible,
    statusMessage,
    visibleEntriesCount,
  })

  useEffect(() => {
    onQueryChange?.(query)
  }, [onQueryChange, query])

  useEffect(() => {
    onMatchedIdsChange?.(matchedIds)
  }, [matchedIds, onMatchedIdsChange])

  const hasTrackedSearchUsageRef = useRef(false)
  useEffect(() => {
    if (normalizedDeferredQuery.length < MIN_TRACK_QUERY_LENGTH || hasTrackedSearchUsageRef.current)
      return
    if (resolvedIndex.entries.length > 0 && !resolvedIndex.fuse)
      return
    hasTrackedSearchUsageRef.current = true

    trackRybbitEvent(ANALYTICS_EVENTS.searchUsed, {
      source: inputQuery === null ? 'url_query' : 'input',
    })
  }, [
    inputQuery,
    normalizedDeferredQuery.length,
    resolvedIndex.entries.length,
    resolvedIndex.fuse,
  ])

  const setIndexReadyIfDeferred = useCallback(() => {
    if (deferIndexInit)
      setIsIndexReady(true)
  }, [deferIndexInit])

  const ensureIndexReady = useCallback(() => {
    setIndexReadyIfDeferred()
  }, [setIndexReadyIfDeferred])

  const ensureSearchRuntimeReady = useCallback(() => {
    setIndexReadyIfDeferred()
    setShouldWarmFuse(true)
  }, [setIndexReadyIfDeferred])

  return {
    deferredQuery,
    ensureIndexReady,
    ensureSearchRuntimeReady,
    hasDeferredQuery,
    hasQuery,
    hiddenArchivedNoticeMessage,
    initialUrlQuery,
    inputQuery,
    liveRef,
    matchedIds,
    query,
    resolvedActiveCommandValue,
    resolvedIndex,
    setInputQuery,
    shouldAnimateSuggestionPanel,
    shouldShowHiddenArchivedNotice,
    shouldShowSuggestionPanel,
    statusMessage,
    suggestionIsExclusion,
    suggestionOperator,
    suggestionViewModels,
    visibleEntriesCount,
    visibleStatusMessage,
  }
}
