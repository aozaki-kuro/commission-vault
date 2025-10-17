'use client'

import { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps {
  children: ReactNode
  pendingLabel?: string
}

const SubmitButton = ({ children, pendingLabel = 'Saving…' }: SubmitButtonProps) => {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

export default SubmitButton
