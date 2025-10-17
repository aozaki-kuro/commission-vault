'use client'

import { Disclosure, Input, Menu, Transition } from '@headlessui/react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove as dndArrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

const controlStyles =
  'w-full rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900'

// 可拖动的角色项组件
interface SortableCharacterItemProps {
  character: CharacterRow
  group: CharacterGroup
  isEditing: boolean
  editingValue: string
  onStartEdit: () => void
  onRenameChange: (value: string) => void
  onCancelEdit: () => void
  onSubmitRename: () => void
  onMoveToGroup: (to: CharacterGroup) => void
}

const SortableCharacterItem = ({
  character,
  group,
  isEditing,
  editingValue,
  onStartEdit,
  onRenameChange,
  onCancelEdit,
  onSubmitRename,
  onMoveToGroup,
}: SortableCharacterItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: character.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-6 rounded-xl border border-gray-200/80 bg-white/95 p-4 text-sm shadow-sm ring-1 ring-gray-900/5 transition dark:border-gray-700/80 dark:bg-gray-900/50 dark:ring-white/10"
    >
      <div className="flex flex-1 items-center gap-3">
        {/* 拖动手柄 */}
        <button
          type="button"
          className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:cursor-grabbing dark:hover:text-gray-200 dark:focus-visible:ring-offset-gray-900"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${character.name}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>

        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${group === 'active' ? 'bg-blue-500/90' : 'bg-gray-400/80'}`}
        />
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-xs text-gray-500 transition hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:text-gray-300 dark:hover:text-gray-100 dark:focus-visible:ring-offset-gray-900"
          onClick={onStartEdit}
          aria-label={`Rename ${character.name}`}
        >
          ✎
        </button>
        {isEditing ? (
          <form
            className="flex-1"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              onSubmitRename()
            }}
          >
            <Input
              autoFocus
              value={editingValue}
              onChange={event => onRenameChange(event.target.value)}
              onBlur={onCancelEdit}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onSubmitRename()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onCancelEdit()
                }
              }}
              className={controlStyles}
            />
          </form>
        ) : (
          <span className="text-base font-medium text-gray-900 dark:text-gray-100">
            {character.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/80 px-3 text-xs font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:border-gray-600/80 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:border-gray-400/60 dark:hover:text-gray-50 dark:focus-visible:ring-offset-gray-900">
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
            <Menu.Items className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-lg border border-gray-200 bg-white/95 p-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-gray-600 dark:bg-gray-900/90 dark:ring-white/10">
              {group === 'active' ? (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                        active
                          ? 'bg-gray-900/5 text-gray-900 dark:bg-white/15 dark:text-gray-100'
                          : 'text-gray-600 dark:text-gray-200'
                      }`}
                      onClick={() => onMoveToGroup('stale')}
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
                      className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                        active
                          ? 'bg-gray-900/5 text-gray-900 dark:bg-white/15 dark:text-gray-100'
                          : 'text-gray-600 dark:text-gray-200'
                      }`}
                      onClick={() => onMoveToGroup('active')}
                    >
                      Move to Active
                    </button>
                  )}
                </Menu.Item>
              )}
            </Menu.Items>
          </Transition>
        </Menu>
        <span className="w-24 text-right font-mono text-xs tracking-wide text-gray-500 uppercase dark:text-gray-300">
          {character.commissionCount.toString().padStart(3, ' ')} entries
        </span>
      </div>
    </div>
  )
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

  // 配置拖放传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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

  // 处理拖放结束事件
  const handleDragEnd = (event: DragEndEvent, group: CharacterGroup) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const list = group === 'active' ? activeOrder : staleOrder
    const oldIndex = list.findIndex(item => item.id === active.id)
    const newIndex = list.findIndex(item => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = dndArrayMove(list, oldIndex, newIndex)

    if (group === 'active') {
      setActiveOrder(reordered)
      persistOrder(reordered, staleOrder)
    } else {
      setStaleOrder(reordered)
      persistOrder(activeOrder, reordered)
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm ring-1 ring-gray-900/5 dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10">
          <Disclosure.Button className="flex w-full items-center justify-between bg-white/90 px-5 py-3 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:bg-gray-900/40 dark:text-gray-100 dark:hover:bg-gray-800/60 dark:focus-visible:ring-offset-gray-900">
            <span>{title}</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Disclosure.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in-out duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1"
          >
            <Disclosure.Panel
              static
              className="space-y-3 border-t border-gray-200 bg-white/85 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30"
            >
              {list.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  No characters in this group.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={event => handleDragEnd(event, group)}
                >
                  <SortableContext
                    items={list.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {list.map(character => {
                      const isEditing = editing?.id === character.id
                      const editingValue = isEditing ? editing!.value : character.name

                      return (
                        <SortableCharacterItem
                          key={character.id}
                          character={character}
                          group={group}
                          isEditing={isEditing}
                          editingValue={editingValue}
                          onStartEdit={() => startEditingName(character, group)}
                          onRenameChange={handleRenameChange}
                          onCancelEdit={cancelEditing}
                          onSubmitRename={submitRename}
                          onMoveToGroup={to => moveCharacterToGroup(character.id, group, to)}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  )

  const statusText = feedback?.text ?? (isSaving || isRenaming ? 'Saving…' : null)
  const statusClass =
    feedback?.type === 'error'
      ? 'text-red-500 dark:text-red-400'
      : feedback?.type === 'success'
        ? 'text-gray-700 dark:text-gray-200'
        : 'text-gray-500 dark:text-gray-300'

  return (
    <section className="space-y-6">
      {renderList('Active', 'active', activeOrder)}
      {renderList('Stale', 'stale', staleOrder)}

      {statusText && <div className={`text-sm ${statusClass}`}>{statusText}</div>}
    </section>
  )
}

export default CharacterManager
