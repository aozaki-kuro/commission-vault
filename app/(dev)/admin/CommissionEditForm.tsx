'use client'

import {
  Description,
  Field,
  Input,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Switch,
  Textarea,
  Transition,
} from '@headlessui/react'
import Image from 'next/image'
import { Fragment, useActionState, useEffect, useMemo, useState, useTransition } from 'react'

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

const statusLabels: Record<CharacterRow['status'], string> = {
  active: 'Active',
  stale: 'Stale',
}

const controlStyles =
  'w-full rounded-lg border border-gray-200 bg-white/80 px-3 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900'

const surfaceStyles =
  'space-y-5 rounded-2xl border border-gray-200 bg-white/90 p-6 text-sm shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'

const CommissionEditForm = ({ commission, characters, onDelete }: CommissionEditFormProps) => {
  const [state, formAction] = useActionState(updateCommissionAction, INITIAL_FORM_STATE)
  const [imageError, setImageError] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [deleteStatus, setDeleteStatus] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState<number>(commission.characterId)
  const [isHidden, setIsHidden] = useState<boolean>(commission.hidden)

  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters],
  )

  useEffect(() => {
    if (!sortedCharacters.some(character => character.id === selectedCharacterId)) {
      const fallbackId = sortedCharacters[0]?.id
      if (fallbackId) {
        setSelectedCharacterId(fallbackId)
      }
    }
  }, [sortedCharacters, selectedCharacterId])

  const selectedCharacter = useMemo(
    () => sortedCharacters.find(character => character.id === selectedCharacterId) ?? null,
    [sortedCharacters, selectedCharacterId],
  )

  const linkValue = useMemo(() => commission.links.join('\n'), [commission.links])
  const imageSrc = useMemo(() => buildImageSrc(commission.fileName), [commission.fileName])

  useEffect(() => {
    setImageError(false)
  }, [imageSrc])

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
    <form action={formAction} className={surfaceStyles}>
      <input type="hidden" name="id" value={commission.id} />
      <input type="hidden" name="characterId" value={selectedCharacterId} />
      {isHidden && <input type="hidden" name="hidden" value="on" />}

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="relative aspect-[1280/525] w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-900/30">
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
                sizes="(max-width: 1024px) 100vw, 480px"
                unoptimized
                onError={() => setImageError(true)}
              />
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-300">
                File
              </p>
              <p className="mt-1 truncate font-medium text-gray-900 dark:text-gray-100">
                {commission.fileName}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field className="space-y-1">
                <Label className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
                  Character
                </Label>
                <Listbox value={selectedCharacterId} onChange={setSelectedCharacterId}>
                  <div className="relative">
                    <ListboxButton className={`${controlStyles} flex items-center justify-between`}>
                      <span
                        className={`truncate ${selectedCharacter ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}
                      >
                        {selectedCharacter
                          ? `${selectedCharacter.name} • ${statusLabels[selectedCharacter.status]}`
                          : 'Select character'}
                      </span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        className="h-4 w-4 text-gray-400"
                      >
                        <path
                          d="M6 8l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </ListboxButton>

                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 -translate-y-1"
                    >
                      <ListboxOptions className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white/95 p-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-gray-700 dark:bg-gray-900/90 dark:ring-white/10">
                        {sortedCharacters.map(character => (
                          <ListboxOption
                            key={character.id}
                            value={character.id}
                            className={({ active, selected }) =>
                              `flex cursor-pointer items-start justify-between gap-3 rounded-md px-3 py-2 text-sm transition ${
                                active
                                  ? 'bg-gray-900/5 text-gray-900 dark:bg-white/10 dark:text-gray-100'
                                  : 'text-gray-700 dark:text-gray-100'
                              } ${selected ? 'ring-1 ring-gray-400/60 ring-inset' : ''}`
                            }
                          >
                            {({ selected }) => (
                              <>
                                <div className="space-y-0.5">
                                  <p className="font-medium">{character.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-300">
                                    {statusLabels[character.status]}
                                  </p>
                                </div>
                                <span
                                  aria-hidden="true"
                                  className={`mt-1 text-base ${selected ? 'text-gray-900 dark:text-gray-100' : 'text-transparent'}`}
                                >
                                  ✓
                                </span>
                              </>
                            )}
                          </ListboxOption>
                        ))}
                      </ListboxOptions>
                    </Transition>
                  </div>
                </Listbox>
              </Field>

              <Field className="space-y-1">
                <Label className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
                  File name
                </Label>
                <Input
                  name="fileName"
                  defaultValue={commission.fileName}
                  required
                  className={controlStyles}
                />
              </Field>
            </div>
          </div>
        </div>

        <Field className="space-y-1">
          <Label className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
            Links (one per line)
          </Label>
          <Textarea
            name="links"
            defaultValue={linkValue}
            rows={3}
            required
            className={controlStyles}
          />
          <Description className="text-xs text-gray-500 dark:text-gray-400">
            Paste each URL on a separate line.
          </Description>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field className="space-y-1">
            <Label className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
              Design (optional)
            </Label>
            <Input name="design" defaultValue={commission.design ?? ''} className={controlStyles} />
          </Field>

          <Field className="space-y-1">
            <Label className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-300">
              Description (optional)
            </Label>
            <Input
              name="description"
              defaultValue={commission.description ?? ''}
              className={controlStyles}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel="Saving changes...">Save changes</SubmitButton>

        <Switch.Group as="div" className="flex items-center gap-3">
          <Switch
            checked={isHidden}
            onChange={setIsHidden}
            className={`${isHidden ? 'bg-gray-900 dark:bg-gray-200' : 'bg-gray-300 dark:bg-gray-700'} relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition`}
          >
            <span className="sr-only">Hide commission from public list</span>
            <span
              aria-hidden="true"
              className={`${isHidden ? 'translate-x-5' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white shadow transition`}
            />
          </Switch>
          <Switch.Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Hidden
          </Switch.Label>
        </Switch.Group>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200/70 px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-gray-900"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>

        {state.status === 'error' && (
          <p className="text-sm text-red-500">{state.message ?? 'Unable to update commission.'}</p>
        )}
        {state.status === 'success' && (
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {state.message ?? 'Commission updated successfully.'}
          </p>
        )}
        {deleteStatus && (
          <p
            className={`text-sm ${deleteStatus.type === 'success' ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}
          >
            {deleteStatus.text}
          </p>
        )}
      </div>
    </form>
  )
}

export default CommissionEditForm
