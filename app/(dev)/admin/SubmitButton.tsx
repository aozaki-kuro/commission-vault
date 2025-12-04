'use client'

import { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps {
  children: ReactNode
  pendingLabel?: string
}

const SubmitButton = ({ children, pendingLabel = 'Saving...' }: SubmitButtonProps) => {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="inline-flex h-10 w-[150px] items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus-visible:ring-offset-gray-900"
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

export default SubmitButton
