import type { HomeSearchControls } from '@features/home/i18n/homeSearchControls'
import type { CommissionSearchEntrySource } from '@features/home/search/commissionSearchIndex'
import { replaceCommissionViewModeInAddress } from '@features/home/commission/viewModeState'
import { applySuggestionToQuery } from '@lib/search/index'
import { IconArrowsShuffle } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const COMMISSION_ENTRY_SELECTOR = '[data-commission-entry="true"]'
const ACTIVE_VIEW_PANEL_SELECTOR = '[data-commission-view-panel][data-commission-view-active="true"]'
const FLASH_DURATION_MS = 500

const YEAR_ONLY_PATTERN = /^\d{4}$/
const MULTI_SPACE_PATTERN = /\s+/g

type SurpriseModeKey = 'random' | 'artist' | 'year'

interface SurpriseMeProps {
  controls: HomeSearchControls
  externalEntries?: CommissionSearchEntrySource[]
  onApplyQuery: (query: string) => void
}

function extractCreators(entries: CommissionSearchEntrySource[]): string[] {
  const creators = new Set<string>()
  for (const entry of entries) {
    if (!entry.searchSuggest)
      continue
    for (const line of entry.searchSuggest.split('\n')) {
      const tabIdx = line.indexOf('\t')
      if (tabIdx < 0)
        continue
      if (line.slice(0, tabIdx) === 'Creator') {
        const term = line.slice(tabIdx + 1).trim()
        if (term)
          creators.add(term)
      }
    }
  }
  return [...creators]
}

function extractYears(entries: CommissionSearchEntrySource[]): string[] {
  const years = new Set<string>()
  for (const entry of entries) {
    const fileName = entry.domKey.split('::')[1]
    if (fileName) {
      const year = fileName.slice(0, 4)
      if (YEAR_ONLY_PATTERN.test(year))
        years.add(year)
    }
  }
  return [...years].sort()
}

// Picks a random item from the pool with better distribution.
// Uses crypto.getRandomValues for higher entropy than Math.random.
function pickRandomWithBetterDistribution<T>(arr: T[]): T | null {
  if (!arr.length)
    return null

  let randomIndex: number
  try {
    const randomValues = new Uint32Array(1)
    crypto.getRandomValues(randomValues)
    randomIndex = randomValues[0] % arr.length
  }
  catch {
    // Fallback to Math.random if crypto is unavailable
    randomIndex = Math.floor(Math.random() * arr.length)
  }

  return arr[randomIndex]
}

// Avoids picking the same item as last time.
// If the pool only has one item, returns it regardless.
function pickAvoidingLast<T>(arr: T[], lastRef: React.MutableRefObject<T | null>): T | null {
  if (!arr.length)
    return null

  const candidates = arr.length > 1 && lastRef.current !== null
    ? arr.filter(item => item !== lastRef.current)
    : arr

  const pool = candidates.length > 0 ? candidates : arr
  const pick = pickRandomWithBetterDistribution(pool)
  if (pick !== null)
    lastRef.current = pick
  return pick
}

function getActiveRoot(): ParentNode {
  return document.querySelector<HTMLElement>(ACTIVE_VIEW_PANEL_SELECTOR) ?? document
}

export default function SurpriseMe({ controls, externalEntries, onApplyQuery }: SurpriseMeProps) {
  const [flashedMode, setFlashedMode] = useState<SurpriseModeKey | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRandomRef = useRef<HTMLElement | null>(null)
  const lastArtistRef = useRef<string | null>(null)
  const lastYearRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (flashTimerRef.current)
        clearTimeout(flashTimerRef.current)
    }
  }, [])

  const flash = useCallback((mode: SurpriseModeKey) => {
    if (flashTimerRef.current)
      clearTimeout(flashTimerRef.current)
    setFlashedMode(mode)
    flashTimerRef.current = setTimeout(() => {
      setFlashedMode(null)
      flashTimerRef.current = null
    }, FLASH_DURATION_MS)
  }, [])

  const handleRandom = useCallback(() => {
    flash('random')
    const root = getActiveRoot()
    const entries = Array.from(root.querySelectorAll<HTMLElement>(COMMISSION_ENTRY_SELECTOR)).filter(
      el => Boolean(el.id),
    )
    const target = pickAvoidingLast(entries, lastRandomRef)
    if (!target)
      return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.animate(
      [
        { boxShadow: '0 0 0 3px rgba(107,114,128,0.5)' },
        { boxShadow: '0 0 0 12px rgba(107,114,128,0)' },
      ],
      { duration: 1100, easing: 'ease-out' },
    )
  }, [flash])

  const handleArtist = useCallback(() => {
    flash('artist')
    const creators = extractCreators(externalEntries ?? [])
    const creator = pickAvoidingLast(creators, lastArtistRef)
    if (!creator)
      return

    const query = applySuggestionToQuery('', creator)
    // Switch to character view so results are presented naturally
    replaceCommissionViewModeInAddress(window, 'character')
    // Update React state directly — avoids the inputQuery='' override bug after clear
    onApplyQuery(query)
  }, [externalEntries, flash, onApplyQuery])

  const handleYear = useCallback(() => {
    flash('year')
    const years = extractYears(externalEntries ?? [])
    const year = pickAvoidingLast(years, lastYearRef)
    if (!year)
      return

    replaceCommissionViewModeInAddress(window, 'timeline')
    onApplyQuery(year)
  }, [externalEntries, flash, onApplyQuery])

  const buttonClass = (mode: SurpriseModeKey) => {
    const isFlashed = flashedMode === mode
    return `
      rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-[0.01em]
      transition-[transform,border-color,background-color,color] duration-150
      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500
      dark:focus-visible:outline-gray-300
      ${isFlashed
          ? 'scale-95 border-gray-400 bg-gray-100 text-gray-900 dark:border-gray-500 dark:bg-gray-800/80 dark:text-white'
          : `
          border-gray-300/80 bg-white/75 text-gray-700
          hover:border-gray-400 hover:text-gray-900
          dark:border-gray-700 dark:bg-black/40 dark:text-gray-300
          dark:hover:border-gray-500 dark:hover:text-gray-100
        `
      }
    `.trim().replace(MULTI_SPACE_PATTERN, ' ')
  }

  return (
    <div
      className="
        mt-2 flex min-h-8 items-center gap-2 text-xs text-gray-500
        dark:text-gray-400
      "
    >
      <span
        className="
          flex shrink-0 cursor-default items-center gap-1 font-mono text-[11px]
          tracking-[0.01em] select-none
        "
        aria-hidden="true"
      >
        <IconArrowsShuffle className="size-3.5 opacity-60 transition-none" stroke={1.8} />
        {controls.surpriseMe}
      </span>
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pr-0.5">
        <button type="button" className={buttonClass('random')} onClick={handleRandom}>
          {controls.surpriseMeRandom}
        </button>
        <button type="button" className={buttonClass('artist')} onClick={handleArtist}>
          {controls.surpriseMeArtist}
        </button>
        <button type="button" className={buttonClass('year')} onClick={handleYear}>
          {controls.surpriseMeYear}
        </button>
      </div>
    </div>
  )
}
