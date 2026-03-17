import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps {
  children: ReactNode
  pendingLabel?: string
}

export function SubmitButton({
  children,
  pendingLabel = 'Saving...',
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="
        inline-flex h-10 w-[150px] items-center justify-center rounded-md
        bg-gray-900 px-3 text-sm font-semibold whitespace-nowrap text-white
        transition
        hover:bg-gray-700
        focus-visible:ring-2 focus-visible:ring-gray-400
        focus-visible:ring-offset-2 focus-visible:ring-offset-white
        focus-visible:outline-none
        disabled:pointer-events-none disabled:opacity-50
        dark:bg-gray-100 dark:text-gray-900
        dark:hover:bg-gray-200
        dark:focus-visible:ring-offset-gray-900
      "
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
