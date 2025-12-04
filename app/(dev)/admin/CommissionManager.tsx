'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
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
  Dialog,
  DialogPanel,
  DialogTitle,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react'

import { deleteCharacterAction, renameCharacter, saveCharacterOrder } from '#admin/actions'
import type { CharacterRow, CharacterStatus, CommissionRow } from '#lib/admin/db'
import { notifyDataUpdate } from './dataUpdateSignal'
import CommissionEditForm from './CommissionEditForm'
import type { FormState } from './types'

interface CommissionManagerProps {
  characters: CharacterRow[]
  commissions: CommissionRow[]
}

const disclosureStorageKey = 'admin-existing-open'
const DIVIDER_ID = 'divider'
const EXPIRY_MINUTES = 30 // 30分钟过期

type ListItem =
  | { type: 'character'; data: CharacterRow }
  | { type: 'divider'; id: typeof DIVIDER_ID }

type CharacterItem = Extract<ListItem, { type: 'character' }>

type FormFeedback = { type: 'success' | 'error'; text: string } | null

type EditingState = { id: number; value: string } | null
type DeletingState = number | null

// 存储结构：包含 id 和时间戳
type StoredOpenState = {
  id: number
  timestamp: number
}

const inlineEditStyles =
  'flex-1 min-w-0 text-base font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none px-0 py-0'

// 读取并验证 localStorage 中的展开状态
const readOpenIdFromStorage = (): number | null => {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.localStorage.getItem(disclosureStorageKey)
    if (!stored) return null

    const parsed: StoredOpenState = JSON.parse(stored)
    const now = Date.now()
    const expiryTime = EXPIRY_MINUTES * 60 * 1000 // 转换为毫秒

    // 检查是否过期
    if (now - parsed.timestamp > expiryTime) {
      window.localStorage.removeItem(disclosureStorageKey)
      return null
    }

    return parsed.id
  } catch {
    return null
  }
}

// 保存展开状态到 localStorage
const saveOpenIdToStorage = (id: number | null) => {
  if (typeof window === 'undefined') return

  if (id === null) {
    window.localStorage.removeItem(disclosureStorageKey)
  } else {
    const data: StoredOpenState = {
      id,
      timestamp: Date.now(),
    }
    window.localStorage.setItem(disclosureStorageKey, JSON.stringify(data))
  }
}

const SortableDivider = ({ activeCount }: { activeCount: number }) => {
  const { setNodeRef, transform, transition } = useSortable({
    id: DIVIDER_ID,
    disabled: true,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative flex items-center gap-3 py-4">
      <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
      <span className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
        Active ({activeCount}) / Stale
      </span>
      <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
    </div>
  )
}

interface SortableCharacterCardProps {
  item: CharacterItem
  isActive: boolean
  commissionList: CommissionRow[]
  isOpen: boolean // 改为受控
  onToggle: () => void // 切换展开/关闭
  onDeleteCommission: (commissionId: number) => void
  charactersForSelect: CharacterRow[]
  buttonRefs: MutableRefObject<Record<number, HTMLButtonElement | null>>
  isEditing: boolean
  editingValue: string
  onStartEdit: () => void
  onRenameChange: (value: string) => void
  onCancelEdit: () => void
  onSubmitRename: () => void
  onRequestDelete: () => void
  isDeleting: boolean
}

const SortableCharacterCard = ({
  item,
  isActive,
  commissionList,
  isOpen,
  onToggle,
  onDeleteCommission,
  charactersForSelect,
  buttonRefs,
  isEditing,
  editingValue,
  onStartEdit,
  onRenameChange,
  onCancelEdit,
  onSubmitRename,
  onRequestDelete,
  isDeleting,
}: SortableCharacterCardProps) => {
  const character = item.data
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: character.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  const triggerDisclosureToggle = () => {
    onToggle()
  }

  const handleHeaderClick = (event: MouseEvent<HTMLDivElement>) => {
    const disclosureButton = buttonRefs.current[character.id]
    if (!disclosureButton) return
    if (disclosureButton.contains(event.target as Node)) return
    triggerDisclosureToggle()
  }

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      triggerDisclosureToggle()
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Disclosure as="div">
        {() => (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm ring-1 ring-gray-900/5 transition dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10">
            <div
              className="flex items-center gap-3 bg-white/90 px-5 py-3 dark:bg-gray-900/40"
              role="button"
              tabIndex={0}
              onClick={handleHeaderClick}
              onKeyDown={handleHeaderKeyDown}
            >
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:cursor-grabbing dark:hover:text-gray-200 dark:focus-visible:ring-offset-gray-900"
                {...attributes}
                {...listeners}
                onClick={event => event.stopPropagation()}
                aria-label={`Drag ${character.name}`}
                disabled={isDeleting}
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

              {isEditing ? (
                <div className="flex flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? 'bg-blue-500/90' : 'bg-gray-400/80'}`}
                  />
                  <input
                    type="text"
                    autoFocus
                    value={editingValue}
                    onChange={event => onRenameChange(event.target.value)}
                    onBlur={onSubmitRename}
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
                    className={inlineEditStyles}
                    disabled={isDeleting}
                    onClick={event => event.stopPropagation()}
                  />
                  <span className="w-24 text-right font-mono text-xs font-normal text-gray-500 dark:text-gray-300">
                    {commissionList.length} entries
                  </span>
                </div>
              ) : (
                <>
                  <DisclosureButton
                    ref={el => {
                      buttonRefs.current[character.id] = el
                    }}
                    onClick={(e: MouseEvent) => {
                      e.preventDefault()
                      onToggle()
                    }}
                    className="flex flex-1 items-center justify-between gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? 'bg-blue-500/90' : 'bg-gray-400/80'}`}
                      />
                      <span className="truncate text-base font-semibold text-gray-800 dark:text-gray-100">
                        {character.name}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={event => {
                          event.stopPropagation()
                          event.preventDefault()
                          onStartEdit()
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                            onStartEdit()
                          }
                        }}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-400 dark:hover:text-gray-200 dark:focus-visible:ring-offset-gray-900"
                        aria-label={`Rename ${character.name}`}
                        aria-disabled={isDeleting}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </span>
                    </div>

                    <span className="w-24 text-right font-mono text-xs font-normal text-gray-500 dark:text-gray-300">
                      {commissionList.length} entries
                    </span>
                  </DisclosureButton>

                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-400 dark:hover:text-red-300 dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-gray-900 dark:disabled:text-gray-600"
                    onClick={event => {
                      event.stopPropagation()
                      onRequestDelete()
                    }}
                    disabled={isDeleting}
                    aria-label={`Remove ${character.name}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>

            <Transition
              show={isOpen}
              as={Fragment}
              enter="transition ease-out duration-150"
              enterFrom="opacity-0 -translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in-out duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 -translate-y-1"
            >
              <DisclosurePanel
                static
                className="space-y-4 border-t border-gray-200 bg-white/85 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30"
              >
                {commissionList.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-300">
                    No commissions recorded yet.
                  </p>
                ) : (
                  commissionList.map(commission => (
                    <CommissionEditForm
                      key={commission.id}
                      commission={commission}
                      characters={charactersForSelect}
                      onDelete={() => onDeleteCommission(commission.id)}
                    />
                  ))
                )}
              </DisclosurePanel>
            </Transition>
          </div>
        )}
      </Disclosure>
    </div>
  )
}

const CommissionManager = ({ characters, commissions }: CommissionManagerProps) => {
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters],
  )

  const initialMap = useMemo(() => {
    const grouped = new Map<number, CommissionRow[]>()
    sortedCharacters.forEach(c => grouped.set(c.id, []))
    commissions.forEach(cm => {
      const list = grouped.get(cm.characterId)
      if (list) list.push(cm)
    })
    return grouped
  }, [sortedCharacters, commissions])

  const initialList = useMemo((): ListItem[] => {
    const active = sortedCharacters.filter(c => c.status === 'active')
    const stale = sortedCharacters.filter(c => c.status === 'stale')

    return [
      ...active.map(c => ({ type: 'character' as const, data: c })),
      { type: 'divider' as const, id: DIVIDER_ID },
      ...stale.map(c => ({ type: 'character' as const, data: c })),
    ]
  }, [sortedCharacters])

  const [commissionMap, setCommissionMap] = useState(initialMap)
  const [list, setList] = useState<ListItem[]>(initialList)
  const [feedback, setFeedback] = useState<FormFeedback>(null)
  const [, startSaveTransition] = useTransition()
  const [editing, setEditing] = useState<EditingState>(null)
  const [, startRenameTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<DeletingState>(null)
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [confirmingCharacter, setConfirmingCharacter] = useState<CharacterRow | null>(null)
  const closeConfirmDialog = () => setConfirmingCharacter(null)

  // 使用 Set 来管理多个展开的角色
  const [openIds, setOpenIds] = useState<Set<number>>(() => {
    const storedId = readOpenIdFromStorage()
    return storedId !== null ? new Set([storedId]) : new Set()
  })

  // 当 openIds 变化时，保存最后一个展开的 ID 到 localStorage
  useEffect(() => {
    const idsArray = Array.from(openIds)
    const lastId = idsArray[idsArray.length - 1] ?? null
    saveOpenIdToStorage(lastId)
  }, [openIds])

  useEffect(() => {
    setCommissionMap(initialMap)
  }, [initialMap])

  useEffect(() => {
    setList(initialList)
  }, [initialList])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [feedback])

  const handleDeleteCommission = useCallback((characterId: number, commissionId: number) => {
    setCommissionMap(prev => {
      const next = new Map(prev)
      const list = next.get(characterId) ?? []
      next.set(
        characterId,
        list.filter(item => item.id !== commissionId),
      )
      return next
    })
  }, [])

  const handleRequestDelete = useCallback((character: CharacterRow) => {
    setConfirmingCharacter(character)
  }, [])

  const toFeedback = (state: FormState): FormFeedback =>
    state.status === 'error'
      ? { type: 'error', text: state.message ?? 'Something went wrong.' }
      : { type: 'success', text: state.message ?? 'Saved.' }

  const persistOrder = (currentList: ListItem[]) => {
    const dividerIndex = currentList.findIndex(i => i.type === 'divider')
    if (dividerIndex === -1) return

    const activeIds = currentList
      .slice(0, dividerIndex)
      .filter((i): i is CharacterItem => i.type === 'character')
      .map(i => i.data.id)

    const staleIds = currentList
      .slice(dividerIndex + 1)
      .filter((i): i is CharacterItem => i.type === 'character')
      .map(i => i.data.id)

    setFeedback({ type: 'success', text: 'Saving…' })

    startSaveTransition(() => {
      saveCharacterOrder({
        active: activeIds,
        stale: staleIds,
      })
        .then(result => {
          setFeedback(toFeedback(result))
          if (result.status === 'success') notifyDataUpdate()
        })
        .catch(() => setFeedback({ type: 'error', text: 'Failed to update character order.' }))
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIdx = list.findIndex(i => (i.type === 'character' ? i.data.id : i.id) === active.id)
    const overIdx = list.findIndex(i => (i.type === 'character' ? i.data.id : i.id) === over.id)

    if (activeIdx === -1 || overIdx === -1) return

    const next = dndArrayMove(list, activeIdx, overIdx)
    setList(next)
  }

  const handleDragEnd = () => {
    persistOrder(list)
  }

  const getCharacterStatus = (characterId: number): CharacterStatus => {
    const dividerIndex = list.findIndex(i => i.type === 'divider')
    const itemIndex = list.findIndex(i => i.type === 'character' && i.data.id === characterId)
    if (dividerIndex === -1 || itemIndex === -1) return 'active'
    return itemIndex < dividerIndex ? 'active' : 'stale'
  }

  const startEditingName = (character: CharacterRow) => {
    setEditing({ id: character.id, value: character.name })
  }

  const handleRenameChange = (value: string) => {
    setEditing(current => (current ? { ...current, value } : current))
  }

  const cancelEditing = () => {
    if (editing) {
      const item = list.find(i => i.type === 'character' && i.data.id === editing.id) as
        | CharacterItem
        | undefined
      if (item) {
        setEditing({ id: editing.id, value: item.data.name })
      }
    }
    setEditing(null)
  }

  const submitRename = () => {
    const current = editing
    if (!current) return

    const trimmed = current.value.trim()
    if (!trimmed) {
      cancelEditing()
      return
    }

    const item = list.find(i => i.type === 'character' && i.data.id === current.id) as
      | CharacterItem
      | undefined
    if (!item) {
      setEditing(null)
      return
    }

    if (trimmed === item.data.name) {
      setEditing(null)
      return
    }

    const status = getCharacterStatus(current.id)
    setFeedback({ type: 'success', text: 'Updating name…' })
    startRenameTransition(() => {
      renameCharacter({ id: current.id, name: trimmed, status })
        .then(result => {
          if (result.status === 'error') {
            setFeedback({ type: 'error', text: result.message ?? 'Unable to update character.' })
            cancelEditing()
            return
          }

          setList(prev =>
            prev.map(i =>
              i.type === 'character' && i.data.id === current.id
                ? { ...i, data: { ...i.data, name: trimmed } }
                : i,
            ),
          )

          setFeedback(toFeedback(result))
          setEditing(null)
          notifyDataUpdate()
        })
        .catch(() => {
          setFeedback({ type: 'error', text: 'Unable to update character.' })
          cancelEditing()
        })
    })
  }

  const performDeleteCharacter = (character: CharacterRow) => {
    setFeedback({ type: 'success', text: 'Deleting…' })
    setDeletingId(character.id)
    setEditing(current => (current?.id === character.id ? null : current))

    startDeleteTransition(() => {
      deleteCharacterAction(character.id)
        .then(result => {
          if (result.status === 'error') {
            setFeedback({
              type: 'error',
              text: result.message ?? 'Unable to delete character.',
            })
            return
          }

          setList(prev =>
            prev.filter(item => !(item.type === 'character' && item.data.id === character.id)),
          )
          setCommissionMap(prev => {
            const next = new Map(prev)
            next.delete(character.id)
            return next
          })

          setFeedback(toFeedback(result))
          notifyDataUpdate()
        })
        .catch(() => {
          setFeedback({ type: 'error', text: 'Unable to delete character.' })
        })
        .finally(() => {
          setDeletingId(null)
          setConfirmingCharacter(null)
        })
    })
  }

  const orderedCharacters = useMemo(
    () => list.filter((i): i is CharacterItem => i.type === 'character').map(i => i.data),
    [list],
  )

  const itemIds = useMemo(() => list.map(i => (i.type === 'character' ? i.data.id : i.id)), [list])

  const activeCount = useMemo(() => {
    const dividerIndex = list.findIndex(i => i.type === 'divider')
    return dividerIndex === -1 ? 0 : dividerIndex
  }, [list])

  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null)

  // 切换展开/关闭的处理函数（累积模式）
  const handleToggle = useCallback((characterId: number) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(characterId)) {
        // 如果已展开，则关闭
        next.delete(characterId)
      } else {
        // 否则展开（不关闭其他）
        next.add(characterId)
      }
      return next
    })

    // 确保按钮保持在视野中
    queueMicrotask(() => {
      const button = buttonRefs.current[characterId]
      if (button) {
        button.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }
    })
  }, [])

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Existing commissions
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Drag to reprioritize characters and edit their commissions in place. Click to expand
          multiple characters at once.
        </p>
      </header>

      {feedback && (
        <p
          className={`text-sm ${
            feedback.type === 'error'
              ? 'text-red-500 dark:text-red-400'
              : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {list.map(item => {
              if (item.type === 'divider') {
                return <SortableDivider key="divider" activeCount={activeCount} />
              }

              const character = item.data
              const characterCommissions = [...(commissionMap.get(character.id) ?? [])].sort(
                (a, b) => b.fileName.localeCompare(a.fileName),
              )

              const dividerIndex = list.findIndex(i => i.type === 'divider')
              const index = list.findIndex(
                i => i.type === 'character' && i.data.id === character.id,
              )
              const isActive = dividerIndex === -1 ? true : index < dividerIndex

              return (
                <SortableCharacterCard
                  key={character.id}
                  item={item}
                  isActive={isActive}
                  commissionList={characterCommissions}
                  isOpen={openIds.has(character.id)}
                  onToggle={() => handleToggle(character.id)}
                  onDeleteCommission={commissionId =>
                    handleDeleteCommission(character.id, commissionId)
                  }
                  charactersForSelect={orderedCharacters}
                  buttonRefs={buttonRefs}
                  isEditing={editing?.id === character.id}
                  editingValue={editing?.id === character.id ? editing.value : character.name}
                  onStartEdit={() => startEditingName(character)}
                  onRenameChange={handleRenameChange}
                  onCancelEdit={cancelEditing}
                  onSubmitRename={submitRename}
                  onRequestDelete={() => handleRequestDelete(character)}
                  isDeleting={deletingId === character.id || isDeletePending}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      </div>

      <Transition appear show={Boolean(confirmingCharacter)} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-20"
          onClose={closeConfirmDialog}
          initialFocus={confirmDeleteButtonRef}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm dark:bg-white/5" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-950">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-bold text-gray-900 dark:text-gray-100"
                  >
                    Delete character?
                  </DialogTitle>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      This will remove the character and all associated commissions. This action
                      cannot be undone.
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <span className="font-semibold">{confirmingCharacter?.name}</span> has{' '}
                      <span className="font-mono">{confirmingCharacter?.commissionCount ?? 0}</span>{' '}
                      entr{(confirmingCharacter?.commissionCount ?? 0) === 1 ? 'y' : 'ies'}.
                    </p>
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900"
                      onClick={closeConfirmDialog}
                      disabled={isDeletePending}
                    >
                      Cancel
                    </button>
                    <button
                      ref={confirmDeleteButtonRef}
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-70 dark:bg-red-500 dark:hover:bg-red-400 dark:focus-visible:ring-offset-gray-900"
                      onClick={() => {
                        if (confirmingCharacter) performDeleteCharacter(confirmingCharacter)
                      }}
                      disabled={isDeletePending}
                    >
                      Delete
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </section>
  )
}

export default CommissionManager
