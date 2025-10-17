'use client'

import Image from 'next/image'
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'

import type { CharacterRow } from '#lib/admin/db'

import { updateCommissionAction, deleteCommissionAction } from '#admin/actions'
import SubmitButton from './SubmitButton'
import { INITIAL_FORM_STATE } from './types'

interface CommissionEditFormProps {
  commission: {
    id: number
    characterId: number
    fileName: string
    links: string[]
    design?: string | null
    description?: string | null
    hidden: boolean
  }
  characters: CharacterRow[]
  onDelete?: () => void
}

const buildImageSrc = (fileName: string) => `/images/webp/${encodeURIComponent(fileName)}.webp`

const CommissionEditForm = ({ commission, characters, onDelete }: CommissionEditFormProps) => {
  const [state, formAction] = useActionState(updateCommissionAction, INITIAL_FORM_STATE)
  const [imageError, setImageError] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [deleteStatus, setDeleteStatus] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const linkValue = useMemo(() => commission.links.join('\n'), [commission.links])
  const imageSrc = useMemo(() => buildImageSrc(commission.fileName), [commission.fileName])

  useEffect(() => {
    if (!deleteStatus) return
    const timer = setTimeout(() => setDeleteStatus(null), 2000)
    return () => clearTimeout(timer)
  }, [deleteStatus])

  const handleDelete = () => {
    if (!window.confirm('Delete this commission entry?')) return

    startDelete(() => {
      deleteCommissionAction(commission.id)
        .then(result => {
          if (result.status === 'success') {
            setDeleteStatus({ type: 'success', text: 'Entry deleted.' })
            onDelete?.()
          } else {
            setDeleteStatus({
              type: 'error',
              text: result.message ?? 'Failed to delete commission.',
            })
          }
        })
        .catch(() => setDeleteStatus({ type: 'error', text: 'Failed to delete commission.' }))
    })
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border border-gray-200 p-4 text-sm shadow-sm dark:border-gray-700"
    >
      <input type="hidden" name="id" value={commission.id} />

      <div className="space-y-3">
        <div className="flex flex-col items-start gap-2">
          <div className="relative aspect-[1280/525] w-full overflow-hidden rounded-md border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900/30">
            {imageError ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                Image not found
              </div>
            ) : (
              <Image
                src={imageSrc}
                alt={commission.fileName}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 600px"
                unoptimized
                onError={() => setImageError(true)}
              />
            )}
          </div>
          <p className="max-w-full truncate text-xs text-gray-500 dark:text-gray-300">
            {commission.fileName}
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
                Character
              </span>
              <select
                name="characterId"
                defaultValue={commission.characterId}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {characters.map(character => (
                  <option key={character.id} value={character.id}>
                    {character.name} ({character.status})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
                File name
              </span>
              <input
                name="fileName"
                defaultValue={commission.fileName}
                required
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
              Links (one per line)
            </span>
            <textarea
              name="links"
              defaultValue={linkValue}
              rows={3}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
                Design (optional)
              </span>
              <input
                name="design"
                defaultValue={commission.design ?? ''}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
                Description (optional)
              </span>
              <input
                name="description"
                defaultValue={commission.description ?? ''}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              name="hidden"
              defaultChecked={commission.hidden}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-700 dark:text-gray-100"
            />
            Hidden
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving changes...">Save changes</SubmitButton>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
        {state.status === 'error' && (
          <p className="text-xs text-red-500">{state.message ?? 'Unable to update commission.'}</p>
        )}
        {state.status === 'success' && (
          <p className="text-xs text-green-600">
            {state.message ?? 'Commission updated successfully.'}
          </p>
        )}
        {deleteStatus && (
          <p
            className={`text-xs ${
              deleteStatus.type === 'success' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {deleteStatus.text}
          </p>
        )}
      </div>
    </form>
  )
}

export default CommissionEditForm
