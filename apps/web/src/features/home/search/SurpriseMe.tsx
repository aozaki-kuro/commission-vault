import { Button } from '@components/ui/button'
import { IconArrowsShuffle } from '@tabler/icons-react'

interface SurpriseMeProps {
  label?: string
  onShuffle?: () => void
}

export default function SurpriseMe({ label = 'Shuffle', onShuffle }: SurpriseMeProps) {
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
      onClick={onShuffle}
    >
      <IconArrowsShuffle className="size-4" stroke={1.85} aria-hidden="true" />
    </Button>
  )
}
