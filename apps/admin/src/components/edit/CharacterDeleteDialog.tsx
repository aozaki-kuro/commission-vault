import type { RefObject } from 'react'
import { useEffect } from 'react'

interface CharacterDeleteDialogProps {
  characterName: string
  commissionCount: number
  confirmButtonRef: RefObject<HTMLButtonElement | null>
  isDeletePending: boolean
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function CharacterDeleteDialog({
  characterName,
  commissionCount,
  confirmButtonRef,
  isDeletePending,
  isOpen,
  onClose,
  onConfirm,
}: CharacterDeleteDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    confirmButtonRef.current?.focus()
  }, [confirmButtonRef, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletePending) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDeletePending, isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4
        backdrop-blur-[2px]
        motion-safe:animate-[overlayFadeIn_200ms_ease-out]
      "
      onClick={() => {
        if (!isDeletePending) {
          onClose()
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-character-title"
        aria-describedby="delete-character-description"
        className="
          w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1
          ring-gray-900/10
          motion-safe:animate-[dialogEnter_240ms_cubic-bezier(0.25,1,0.5,1)]
          dark:bg-gray-950 dark:ring-white/10
        "
        onClick={event => event.stopPropagation()}
      >
        <h3
          id="delete-character-title"
          className="
            text-lg font-bold text-gray-900
            dark:text-gray-100
          "
        >
          Delete character?
        </h3>

        <div className="mt-2 space-y-2">
          <p
            id="delete-character-description"
            className="
              text-sm text-gray-600
              dark:text-gray-300
            "
          >
            This will remove the character and all associated commissions. This action cannot be
            undone.
          </p>
          <p
            className="
              text-sm text-gray-700
              dark:text-gray-200
            "
          >
            <span className="font-semibold">{characterName}</span>
            {' '}
            has
            {' '}
            <span className="font-mono">{commissionCount}</span>
            {' '}
            entr
            {commissionCount === 1 ? 'y' : 'ies'}
            .
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeletePending}
            className="
              inline-flex h-10 items-center justify-center rounded-md border
              border-gray-300 px-4 text-sm font-medium text-gray-700 transition
              hover:bg-gray-50
              focus-visible:ring-2 focus-visible:ring-gray-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-white
              focus-visible:outline-none
              disabled:cursor-not-allowed disabled:opacity-60
              dark:border-gray-700 dark:text-gray-200
              dark:hover:bg-gray-900/40
              dark:focus-visible:ring-offset-gray-900
            "
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isDeletePending}
            className="
              inline-flex h-10 items-center justify-center rounded-md bg-red-600
              px-4 text-sm font-semibold text-white transition
              hover:bg-red-500
              focus-visible:ring-2 focus-visible:ring-red-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-white
              focus-visible:outline-none
              disabled:cursor-not-allowed disabled:opacity-60
              dark:focus-visible:ring-offset-gray-900
            "
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
