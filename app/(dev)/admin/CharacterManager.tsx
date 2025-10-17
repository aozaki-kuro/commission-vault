'use client'

import { Disclosure, Menu, Transition } from '@headlessui/react'
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import type { CharacterRow } from '#lib/admin/db'

import { renameCharacter, saveCharacterOrder } from '#admin/actions'
import type { FormState } from './types'

interface CharacterManagerProps {
  characters: CharacterRow[]
}

type CharacterGroup = 'active' | 'stale'

type EditingState = { id: number; value: string; group: CharacterGroup } | null

type FormFeedback = { type: 'success' | 'error'; text: string } | null

const arrayMove = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

const CharacterManager = ({ characters }: CharacterManagerProps) => {
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters],
  )

  const initialActive = useMemo(
    () => sortedCharacters.filter(character => character.status === 'active'),
    [sortedCharacters],
  )
  const initialStale = useMemo(
    () => sortedCharacters.filter(character => character.status === 'stale'),
    [sortedCharacters],
  )

  const [activeOrder, setActiveOrder] = useState(initialActive)
  const [staleOrder, setStaleOrder] = useState(initialStale)
  const [editing, setEditing] = useState<EditingState>(null)
  const [feedback, setFeedback] = useState<FormFeedback>(null)
  const [isSaving, startSaveTransition] = useTransition()
  const [isRenaming, startRenameTransition] = useTransition()

  useEffect(() => {
    setActiveOrder(initialActive)
  }, [initialActive])

  useEffect(() => {
    setStaleOrder(initialStale)
  }, [initialStale])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [feedback])

  const toFeedback = (state: FormState): FormFeedback =>
    state.status === 'error'
      ? { type: 'error', text: state.message ?? 'Something went wrong.' }
      : { type: 'success', text: state.message ?? 'Saved.' }

  const persistOrder = (nextActive: CharacterRow[], nextStale: CharacterRow[]) => {
    setFeedback({ type: 'success', text: 'Saving…' })
    startSaveTransition(() => {
      saveCharacterOrder({
        active: nextActive.map(character => character.id),
        stale: nextStale.map(character => character.id),
      })
        .then(result => setFeedback(toFeedback(result)))
        .catch(() => setFeedback({ type: 'error', text: 'Failed to update character order.' }))
    })
  }

  const moveWithinGroup = (group: CharacterGroup, index: number, direction: -1 | 1) => {
    const listLength = group === 'active' ? activeOrder.length : staleOrder.length
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= listLength) return

    if (group === 'active') {
      const nextActive = arrayMove(activeOrder, index, index + direction).map(character => ({
        ...character,
        status: 'active' as const,
      }))
      setActiveOrder(nextActive)
      persistOrder(nextActive, staleOrder)
    } else {
      const nextStale = arrayMove(staleOrder, index, index + direction).map(character => ({
        ...character,
        status: 'stale' as const,
      }))
      setStaleOrder(nextStale)
      persistOrder(activeOrder, nextStale)
    }
  }

  const moveCharacterToGroup = (id: number, from: CharacterGroup, to: CharacterGroup) => {
    if (from === to) return

    const fromList = from === 'active' ? activeOrder : staleOrder
    const item = fromList.find(character => character.id === id)
    if (!item) return

    const remainingActive =
      from === 'active' ? activeOrder.filter(character => character.id !== id) : activeOrder
    const remainingStale =
      from === 'stale' ? staleOrder.filter(character => character.id !== id) : staleOrder

    const nextActiveList =
      to === 'active'
        ? [...remainingActive, { ...item, status: 'active' as const }]
        : remainingActive

    const nextStaleList =
      to === 'stale' ? [...remainingStale, { ...item, status: 'stale' as const }] : remainingStale

    const nextActive = nextActiveList.map(character => ({
      ...character,
      status: 'active' as const,
    }))
    const nextStale = nextStaleList.map(character => ({ ...character, status: 'stale' as const }))

    setActiveOrder(nextActive)
    setStaleOrder(nextStale)
    persistOrder(nextActive, nextStale)
  }

  const startEditingName = (character: CharacterRow, group: CharacterGroup) => {
    setEditing({ id: character.id, value: character.name, group })
  }

  const handleRenameChange = (value: string) => {
    setEditing(current => (current ? { ...current, value } : current))
  }

  const cancelEditing = () => setEditing(null)

  const submitRename = () => {
    const current = editing
    if (!current) return

    const trimmed = current.value.trim()
    if (!trimmed) {
      setEditing(null)
      return
    }

    const sourceList = current.group === 'active' ? activeOrder : staleOrder
    const original = sourceList.find(character => character.id === current.id)
    if (!original || trimmed === original.name) {
      setEditing(null)
      return
    }

    setFeedback({ type: 'success', text: 'Updating name…' })
    startRenameTransition(() => {
      renameCharacter({ id: current.id, name: trimmed, status: current.group })
        .then(result => {
          if (result.status === 'error') {
            setFeedback({ type: 'error', text: result.message ?? 'Unable to update character.' })
            return
          }

          if (current.group === 'active') {
            setActiveOrder(prev =>
              prev.map(character =>
                character.id === current.id ? { ...character, name: trimmed } : character,
              ),
            )
          } else {
            setStaleOrder(prev =>
              prev.map(character =>
                character.id === current.id ? { ...character, name: trimmed } : character,
              ),
            )
          }

          setFeedback(toFeedback(result))
        })
        .catch(() => setFeedback({ type: 'error', text: 'Unable to update character.' }))
        .finally(() => setEditing(null))
    })
  }

  const renderList = (title: string, group: CharacterGroup, list: CharacterRow[]) => (
    <Disclosure defaultOpen>
      {({ open }) => (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
          <Disclosure.Button className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">
            <span>{title}</span>
            <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌃</span>
          </Disclosure.Button>
          <Disclosure.Panel className="space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
            {list.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                No characters in this group.
              </p>
            ) : (
              list.map((character, index) => {
                const isEditing = editing?.id === character.id
                const editingValue = isEditing ? editing!.value : character.name

                return (
                  <div
                    key={character.id}
                    className="flex items-center justify-between gap-6 rounded-md border border-gray-300 bg-white px-4 py-4 text-sm transition dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <span
                        className="w-4 text-center text-lg text-gray-400 select-none"
                        aria-hidden="true"
                      >
                        •
                      </span>
                      <button
                        type="button"
                        className="text-xs text-gray-500 transition hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                        onClick={() => startEditingName(character, group)}
                        aria-label={`Rename ${character.name}`}
                      >
                        ✎
                      </button>
                      {isEditing ? (
                        <form
                          className="flex-1"
                          onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault()
                            submitRename()
                          }}
                        >
                          <input
                            autoFocus
                            value={editingValue}
                            onChange={event => handleRenameChange(event.target.value)}
                            onBlur={cancelEditing}
                            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                submitRename()
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                cancelEditing()
                              }
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </form>
                      ) : (
                        <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {character.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-xs text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                        onClick={() => moveWithinGroup(group, index, -1)}
                        disabled={index === 0 || isEditing}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-xs text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                        onClick={() => moveWithinGroup(group, index, 1)}
                        disabled={index === list.length - 1 || isEditing}
                      >
                        ↓
                      </button>

                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                          Move
                        </Menu.Button>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none dark:border-gray-600 dark:bg-gray-800">
                            {group === 'active' ? (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    type="button"
                                    className={`w-full px-3 py-2 text-left text-sm ${
                                      active
                                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                                        : 'text-gray-600 dark:text-gray-200'
                                    }`}
                                    onClick={() =>
                                      moveCharacterToGroup(character.id, 'active', 'stale')
                                    }
                                  >
                                    Move to Stale
                                  </button>
                                )}
                              </Menu.Item>
                            ) : (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    type="button"
                                    className={`w-full px-3 py-2 text-left text-sm ${
                                      active
                                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                                        : 'text-gray-600 dark:text-gray-200'
                                    }`}
                                    onClick={() =>
                                      moveCharacterToGroup(character.id, 'stale', 'active')
                                    }
                                  >
                                    Move to Active
                                  </button>
                                )}
                              </Menu.Item>
                            )}
                          </Menu.Items>
                        </Transition>
                      </Menu>
                      <span className="w-20 text-right font-mono text-xs text-gray-500 dark:text-gray-300">
                        {character.commissionCount.toString().padStart(3, ' ')} entries
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  )

  return (
    <section className="space-y-6">
      {renderList('Active', 'active', activeOrder)}
      {renderList('Stale', 'stale', staleOrder)}

      {(feedback || isSaving || isRenaming) && (
        <div
          className={`text-xs ${feedback?.type === 'error' ? 'text-red-500' : 'text-gray-500'} dark:text-gray-300`}
        >
          {feedback?.text ?? (isSaving || isRenaming ? 'Saving…' : null)}
        </div>
      )}
    </section>
  )
}

export default CharacterManager
