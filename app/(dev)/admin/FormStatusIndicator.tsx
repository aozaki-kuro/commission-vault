'use client'

import { useEffect, useState } from 'react'

import type { FormStatus } from './types'

interface FormStatusIndicatorProps {
  status: FormStatus
  message?: string
  successLabel?: string
  errorFallback?: string
  hideDelay?: number
}

const FormStatusIndicator = ({
  status,
  message,
  successLabel = 'Saved',
  errorFallback = 'Unable to save.',
  hideDelay = 2500,
}: FormStatusIndicatorProps) => {
  const [visibleStatus, setVisibleStatus] = useState<FormStatus>('idle')

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    if (status === 'success') {
      showTimer = setTimeout(() => setVisibleStatus('success'), 0)
      hideTimer = setTimeout(() => setVisibleStatus('idle'), hideDelay)
    } else if (status === 'error') {
      showTimer = setTimeout(() => setVisibleStatus('error'), 0)
    } else {
      showTimer = setTimeout(() => setVisibleStatus('idle'), 0)
    }

    return () => {
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [status, hideDelay])

  if (visibleStatus === 'idle') return null

  const isError = visibleStatus === 'error'
  const text = isError ? (message ?? errorFallback) : successLabel

  return (
    <span
      className={`text-sm ${isError ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}
      aria-live="polite"
    >
      {text}
    </span>
  )
}

export default FormStatusIndicator
