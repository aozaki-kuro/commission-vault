import type { CommissionSearchEntrySource, SearchSuggestionAliasGroup } from '@features/home/search/CommissionSearch'
import {
  readHomeCharacterBatchManifest,
} from '@features/home/commission/batch/homeCharacterBatchManifest'
import {
  ACTIVE_CHARACTERS_LOADED_EVENT,
  requestActiveCharactersLoad,
} from '@features/home/commission/loader/activeCharactersEvent'
import {
  ARCHIVED_CHARACTERS_LOADED_EVENT,
  requestArchivedCharactersLoad,
} from '@features/home/commission/loader/archivedCharactersEvent'
import { resolveHomeSearchControls } from '@features/home/i18n/homeSearchControls'
import CommissionSearch from '@features/home/search/CommissionSearch'
import {
  buildPopularKeywordPoolFromSuggestTexts,
  dedupeKeywords,
} from '@lib/search/popularKeywords'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MAX_FEATURED_KEYWORDS = 6
const MAX_VISIBLE_POPULAR_KEYWORDS = 6
const HOME_SEARCH_INDEX_URL = '/search/home-search-entries.json'
const COMMISSION_ENTRY_SELECTOR = '[data-commission-entry="true"]'

let cachedHomeSearchEntries: CommissionSearchEntrySource[] | null = null
let homeSearchEntriesPromise: Promise<CommissionSearchEntrySource[]> | null = null

function ensureHomeSearchEntriesPromise() {
  if (cachedHomeSearchEntries) {
    return Promise.resolve(cachedHomeSearchEntries)
  }

  if (!homeSearchEntriesPromise) {
    homeSearchEntriesPromise = fetch(HOME_SEARCH_INDEX_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load search index: ${response.status}`)
        }
        return (await response.json()) as CommissionSearchEntrySource[]
      })
      .then((entries) => {
        cachedHomeSearchEntries = entries
        return entries
      })
      .catch((error) => {
        homeSearchEntriesPromise = null
        throw error
      })
  }

  return homeSearchEntriesPromise
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0 || 0x6D2B79F5

  return () => {
    state += 0x6D2B79F5
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleKeywords(keywords: string[], seed: number) {
  const shuffled = [...keywords]
  const random = createSeededRandom(seed)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

function getPopularKeywordBatch(keywords: string[], page: number, batchSize: number) {
  if (keywords.length <= batchSize)
    return keywords

  const seed = (keywords.length * 2654435761 + (page + 1) * 1013904223) >>> 0
  return shuffleKeywords(keywords, seed).slice(0, batchSize)
}

const normalizeKeywordVariantKey = (value: string) => value.trim().toLowerCase()

function collectSearchEntryElementsFromNode(root: ParentNode): HTMLElement[] {
  const directEntries = [...root.querySelectorAll<HTMLElement>(COMMISSION_ENTRY_SELECTOR)]
  const nestedTemplateEntries = [...root.querySelectorAll<HTMLTemplateElement>('template')].flatMap(template => collectSearchEntryElementsFromNode(template.content))

  return [...directEntries, ...nestedTemplateEntries]
}

function buildAliasKeyLookup(aliasGroups: SearchSuggestionAliasGroup[]) {
  const keyToGroup = new Map<string, string>()

  for (const group of aliasGroups) {
    const normalizedTerms = [...[group.term, ...group.aliases]
      .map(term => normalizeKeywordVariantKey(term))
      .filter((term): term is string => Boolean(term))]

    const uniqueTerms = [...new Set(normalizedTerms)]
    if (uniqueTerms.length < 2)
      continue

    const existingGroup = uniqueTerms.map(term => keyToGroup.get(term)).find(Boolean)
    const groupKey = existingGroup ?? uniqueTerms[0]

    for (const term of uniqueTerms) {
      keyToGroup.set(term, groupKey)
    }
  }

  return keyToGroup
}

function collapseAliasKeywordVariants(keywords: string[], aliasGroups: SearchSuggestionAliasGroup[], seed: number) {
  if (keywords.length === 0 || aliasGroups.length === 0)
    return keywords

  const aliasKeyLookup = buildAliasKeyLookup(aliasGroups)
  if (aliasKeyLookup.size === 0)
    return keywords

  const candidatesByGroup = new Map<string, string[]>()
  const seenCandidateKeysByGroup = new Map<string, Set<string>>()

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeKeywordVariantKey(keyword)
    if (!normalizedKeyword)
      continue
    const groupKey = aliasKeyLookup.get(normalizedKeyword)
    if (!groupKey)
      continue

    let seenKeys = seenCandidateKeysByGroup.get(groupKey)
    if (!seenKeys) {
      seenKeys = new Set<string>()
      seenCandidateKeysByGroup.set(groupKey, seenKeys)
    }
    if (seenKeys.has(normalizedKeyword))
      continue
    seenKeys.add(normalizedKeyword)

    const candidates = candidatesByGroup.get(groupKey) ?? []
    candidates.push(keyword.trim())
    candidatesByGroup.set(groupKey, candidates)
  }

  const selectedTermByGroup = new Map<string, string>()
  const random = createSeededRandom(seed ^ candidatesByGroup.size)
  for (const [groupKey, candidates] of candidatesByGroup) {
    if (candidates.length === 0)
      continue
    if (candidates.length === 1) {
      selectedTermByGroup.set(groupKey, candidates[0])
      continue
    }

    const selectedIndex = Math.floor(random() * candidates.length)
    selectedTermByGroup.set(groupKey, candidates[selectedIndex])
  }

  const collapsedKeywords: string[] = []
  const emittedAliasGroups = new Set<string>()
  const emittedKeywordKeys = new Set<string>()

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeKeywordVariantKey(keyword)
    if (!normalizedKeyword)
      continue

    const groupKey = aliasKeyLookup.get(normalizedKeyword)
    if (!groupKey) {
      if (emittedKeywordKeys.has(normalizedKeyword))
        continue
      emittedKeywordKeys.add(normalizedKeyword)
      collapsedKeywords.push(keyword.trim())
      continue
    }
    if (emittedAliasGroups.has(groupKey))
      continue

    emittedAliasGroups.add(groupKey)
    const selectedTerm = selectedTermByGroup.get(groupKey) ?? keyword.trim()
    const selectedTermKey = normalizeKeywordVariantKey(selectedTerm)
    if (!selectedTermKey || emittedKeywordKeys.has(selectedTermKey))
      continue

    emittedKeywordKeys.add(selectedTermKey)
    collapsedKeywords.push(selectedTerm)
  }

  return collapsedKeywords
}

function buildSearchEntriesFromDom(): CommissionSearchEntrySource[] {
  if (typeof document === 'undefined')
    return []

  const entriesByKey = new Map<string, Omit<CommissionSearchEntrySource, 'id'>>()
  collectSearchEntryElementsFromNode(document).forEach((element) => {
    const domKey = element.dataset.commissionSearchKey
    const searchText = element.dataset.searchText
    if (!domKey || !searchText || entriesByKey.has(domKey))
      return

    entriesByKey.set(domKey, {
      domKey,
      searchText,
      searchSuggest: element.dataset.searchSuggest,
    })
  })

  return Array.from(entriesByKey.values(), (entry, id) => ({
    id,
    ...entry,
  }))
}

function buildPopularKeywordPoolFromEntries(entries: CommissionSearchEntrySource[]) {
  return buildPopularKeywordPoolFromSuggestTexts(
    entries
      .map(entry => entry.searchSuggest ?? '')
      .filter((suggestText): suggestText is string => Boolean(suggestText)),
  )
}

function cryptoRandomIndex(length: number) {
  try {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % length
  }
  catch {
    return Math.floor(Math.random() * length)
  }
}

function extractSectionIdFromDomKey(domKey: string) {
  const separatorIndex = domKey.indexOf('::')
  return separatorIndex > 0 ? domKey.slice(0, separatorIndex) : ''
}

const SHUFFLE_DEFERRED_LOAD_TIMEOUT_MS = 8000

function loadDeferredEntryBatch(sectionId: string): Promise<void> {
  const manifest = readHomeCharacterBatchManifest(document)
  if (!manifest)
    return Promise.reject(new Error('No batch manifest'))

  const isActive = sectionId in manifest.active.targetBatchById
  const isArchived = !isActive && sectionId in manifest.archived.targetBatchById
  if (!isActive && !isArchived)
    return Promise.reject(new Error('Section not found in manifest'))

  const loadedEvent = isActive
    ? ACTIVE_CHARACTERS_LOADED_EVENT
    : ARCHIVED_CHARACTERS_LOADED_EVENT

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let timeoutId: number

    const onLoaded = () => {
      if (settled)
        return
      settled = true
      window.clearTimeout(timeoutId)
      window.removeEventListener(loadedEvent, onLoaded)
      resolve()
    }

    timeoutId = window.setTimeout(() => {
      if (settled)
        return
      settled = true
      window.removeEventListener(loadedEvent, onLoaded)
      reject(new Error('Deferred load timeout'))
    }, SHUFFLE_DEFERRED_LOAD_TIMEOUT_MS)

    window.addEventListener(loadedEvent, onLoaded)

    if (isActive) {
      requestActiveCharactersLoad(window, {
        strategy: 'target',
        targetId: sectionId,
      })
    }
    else {
      requestArchivedCharactersLoad(window, {
        strategy: 'target',
        targetId: sectionId,
      })
    }
  })
}

function scrollAndAnimateEntry(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  element.animate(
    [
      { boxShadow: '0 0 0 3px rgba(107,114,128,0.5)' },
      { boxShadow: '0 0 0 12px rgba(107,114,128,0)' },
    ],
    { duration: 1100, easing: 'ease-out' },
  )
}

interface CommissionSearchDeferredProps {
  locale?: string
  featuredKeywords?: string[]
  suggestionAliasGroups?: SearchSuggestionAliasGroup[]
}

export default function CommissionSearchDeferred({
  locale,
  featuredKeywords = [],
  suggestionAliasGroups = [],
}: CommissionSearchDeferredProps = {}) {
  const controls = resolveHomeSearchControls(locale)
  const [popularKeywordPage, setPopularKeywordPage] = useState(0)
  const [hasDismissedFeaturedKeywords, setHasDismissedFeaturedKeywords] = useState(false)
  const [externalEntries, setExternalEntries] = useState<CommissionSearchEntrySource[] | null>(
    () => {
      if (cachedHomeSearchEntries)
        return cachedHomeSearchEntries
      const entries = buildSearchEntriesFromDom()
      return entries.length > 0 ? entries : null
    },
  )
  const [popularKeywordPool, setPopularKeywordPool] = useState<string[]>(() =>
    externalEntries ? buildPopularKeywordPoolFromEntries(externalEntries) : [],
  )
  const [matchedIds, setMatchedIds] = useState<Set<number>>(() => new Set())

  const dedupedFeaturedKeywordBatch = useMemo(
    () => dedupeKeywords(featuredKeywords, MAX_FEATURED_KEYWORDS),
    [featuredKeywords],
  )
  const featuredKeywordBatch = useMemo(
    () =>
      collapseAliasKeywordVariants(
        dedupedFeaturedKeywordBatch,
        suggestionAliasGroups,
        popularKeywordPage ^ 0x9E3779B9,
      ),
    [dedupedFeaturedKeywordBatch, popularKeywordPage, suggestionAliasGroups],
  )

  useEffect(() => {
    let active = true
    let didApplyFetchedEntries = false

    const applyEntries = (
      entries: CommissionSearchEntrySource[],
      source: 'dom' | 'fetch',
    ) => {
      if (!active)
        return
      if (source === 'dom' && didApplyFetchedEntries)
        return
      if (source === 'fetch')
        didApplyFetchedEntries = true

      startTransition(() => {
        setExternalEntries(entries.length > 0 ? entries : null)
        setPopularKeywordPool(buildPopularKeywordPoolFromEntries(entries))
      })
    }

    const rafId = window.requestAnimationFrame(() => {
      if (cachedHomeSearchEntries)
        return
      applyEntries(buildSearchEntriesFromDom(), 'dom')
    })

    if (cachedHomeSearchEntries) {
      applyEntries(cachedHomeSearchEntries, 'fetch')
    }
    else {
      void ensureHomeSearchEntriesPromise()
        .then(entries => applyEntries(entries, 'fetch'))
        .catch((error) => {
          console.error(error)
        })
    }

    return () => {
      active = false
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  const dedupedPopularKeywordPool = useMemo(
    () =>
      collapseAliasKeywordVariants(popularKeywordPool, suggestionAliasGroups, popularKeywordPage),
    [popularKeywordPage, popularKeywordPool, suggestionAliasGroups],
  )
  const shouldUseFeaturedKeywords = !hasDismissedFeaturedKeywords && featuredKeywordBatch.length > 0
  const popularKeywords = useMemo(
    () =>
      shouldUseFeaturedKeywords
        ? featuredKeywordBatch.slice(0, MAX_VISIBLE_POPULAR_KEYWORDS)
        : getPopularKeywordBatch(
            dedupedPopularKeywordPool,
            popularKeywordPage,
            MAX_VISIBLE_POPULAR_KEYWORDS,
          ),
    [
      dedupedPopularKeywordPool,
      featuredKeywordBatch,
      popularKeywordPage,
      shouldUseFeaturedKeywords,
    ],
  )

  const rotatePopularKeywords = useCallback(() => {
    setHasDismissedFeaturedKeywords(true)
    setPopularKeywordPage(previous => previous + 1)
  }, [])

  const lastShuffledIdRef = useRef<number | null>(null)

  const shuffleRandomEntry = useCallback((matchedIds?: Set<number>) => {
    if (!externalEntries || externalEntries.length === 0)
      return

    const candidates = matchedIds && matchedIds.size > 0
      ? externalEntries.filter(entry => matchedIds.has(entry.id))
      : externalEntries

    if (candidates.length === 0)
      return

    // Avoid picking the same entry twice in a row
    const pool = candidates.length > 1 && lastShuffledIdRef.current !== null
      ? candidates.filter(entry => entry.id !== lastShuffledIdRef.current)
      : candidates

    const randomIndex = cryptoRandomIndex(pool.length)
    const randomEntry = pool[randomIndex]
    lastShuffledIdRef.current = randomEntry.id

    if (!randomEntry.domKey)
      return

    // Try to find the element in DOM (already loaded)
    const element = document.querySelector<HTMLElement>(
      `[data-commission-search-key="${CSS.escape(randomEntry.domKey)}"]`,
    )
    if (element) {
      scrollAndAnimateEntry(element)
      return
    }

    // Entry is in a deferred batch — trigger load, then scroll
    const sectionId = extractSectionIdFromDomKey(randomEntry.domKey)
    if (!sectionId)
      return

    void loadDeferredEntryBatch(sectionId)
      .then(() => {
        // Use requestAnimationFrame so layout is committed after batch mount
        window.requestAnimationFrame(() => {
          const loadedElement = document.querySelector<HTMLElement>(
            `[data-commission-search-key="${CSS.escape(randomEntry.domKey)}"]`,
          )
          if (loadedElement) {
            scrollAndAnimateEntry(loadedElement)
          }
        })
      })
      .catch(() => {
        // Deferred load failed or timed out — silently ignore
      })
  }, [externalEntries])

  return (
    <CommissionSearch
      controls={controls}
      deferIndexInit={false}
      externalEntries={externalEntries ?? undefined}
      popularKeywords={popularKeywords}
      refreshPopularSearchLabel={controls.refreshPopularSearchLabel}
      onRotatePopularKeywords={popularKeywords.length > 0 ? rotatePopularKeywords : undefined}
      onShuffleRandomEntry={() => shuffleRandomEntry(matchedIds)}
      onMatchedIdsChange={setMatchedIds}
      suggestionAliasGroups={suggestionAliasGroups}
    />
  )
}
