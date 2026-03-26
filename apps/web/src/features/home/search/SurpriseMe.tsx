import { Button } from '@components/ui/button'
import { IconArrowsShuffle } from '@tabler/icons-react'
import { useCallback, useRef } from 'react'

const COMMISSION_ENTRY_SELECTOR = '[data-commission-entry="true"]'
const ACTIVE_VIEW_PANEL_SELECTOR = '[data-commission-view-panel][data-commission-view-active="true"]'

interface SurpriseMeProps {
  label?: string
  onShuffle?: () => void
}

interface CurrentRef<T> {
  current: T | null
}

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
    randomIndex = Math.floor(Math.random() * arr.length)
  }

  return arr[randomIndex]
}

function pickAvoidingLast<T>(arr: T[], lastRef: CurrentRef<T>): T | null {
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

export default function SurpriseMe({ label = 'Shuffle', onShuffle }: SurpriseMeProps) {
  const lastRandomRef = useRef<HTMLElement | null>(null)

  const handleShuffle = useCallback(() => {
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
    onShuffle?.()
  }, [onShuffle])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="
        size-7 shrink-0 rounded-full border border-gray-200/80 bg-white/70
        text-gray-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]
        transition-[color,border-color,background-color,box-shadow] duration-200
        hover:border-gray-400 hover:bg-white hover:text-gray-900
        hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]
        dark:border-gray-700 dark:bg-black/35 dark:text-gray-400
        dark:hover:border-gray-500 dark:hover:bg-black/55
        dark:hover:text-gray-100 dark:hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)]
      "
      aria-label={label}
      onClick={handleShuffle}
    >
      <IconArrowsShuffle className="size-4" stroke={1.85} aria-hidden="true" />
    </Button>
  )
}
