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
import { useEffect, useMemo, useState, useTransition, type KeyboardEvent } from 'react'

import type { CharacterRow } from '#lib/admin/db'

import { deleteCharacterAction, renameCharacter, saveCharacterOrder } from '#admin/actions'
import { notifyDataUpdate } from './dataUpdateSignal'
import type { FormState } from './types'

interface CharacterManagerProps {
  characters: CharacterRow[]
}

type EditingState = { id: number; value: string } | null

type FormFeedback = { type: 'success' | 'error'; text: string } | null

type ListItem =
  | { type: 'character'; id: number; data: CharacterRow }
  | { type: 'divider'; id: 'divider' }

const DIVIDER_ID = 'divider'

const inlineEditStyles =
  'flex-1 min-w-0 text-base font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none px-0 py-0'

// 可拖动的角色项组件
interface SortableCharacterItemProps {
  character: CharacterRow
  isActive: boolean
  isEditing: boolean
  editingValue: string
  onStartEdit: () => void
  onRenameChange: (value: string) => void
  onCancelEdit: () => void
  onSubmitRename: () => void
  onDelete: () => void
  isDeleting: boolean
}

const SortableCharacterItem = ({
  character,
  isActive,
  isEditing,
  editingValue,
  onStartEdit,
  onRenameChange,
  onCancelEdit,
  onSubmitRename,
  onDelete,
  isDeleting,
}: SortableCharacterItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: character.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isDeleting ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-6 rounded-xl border border-gray-200/80 bg-white/95 px-4 py-3 text-sm shadow-sm ring-1 ring-gray-900/5 transition dark:border-gray-700/80 dark:bg-gray-900/50 dark:ring-white/10"
    >
      <div className="flex min-h-10 flex-1 items-center gap-3">
        {/* 拖动手柄 */}
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:cursor-grabbing disabled:cursor-not-allowed disabled:text-gray-300 dark:hover:text-gray-200 dark:focus-visible:ring-offset-gray-900 dark:disabled:text-gray-600"
          disabled={isDeleting}
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
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? 'bg-blue-500/90' : 'bg-gray-400/80'}`}
        />
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:focus-visible:ring-offset-gray-900 dark:disabled:text-gray-600"
          onClick={onStartEdit}
          disabled={isDeleting}
          aria-label={`Rename ${character.name}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>

        {isEditing ? (
          <div className="relative min-w-0 flex-1">
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
              style={{ minWidth: '200px' }}
            />
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate text-base font-medium text-gray-900 dark:text-gray-100">
            {character.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-24 text-right font-mono text-xs tracking-wide text-gray-500 dark:text-gray-300">
          {character.commissionCount.toString().padStart(3, ' ')} entries
        </span>
      </div>

      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-400 dark:hover:text-red-300 dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-gray-900 dark:disabled:text-gray-600"
        onClick={onDelete}
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
    </div>
  )
}

// 可排序但不可拖动的分割线组件
const SortableDivider = ({ activeCount }: { activeCount: number }) => {
  const { setNodeRef, transform, transition } = useSortable({
    id: DIVIDER_ID,
    disabled: true, // 禁用拖动
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative flex items-center gap-3 py-3">
      <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
      <span className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
        Active ({activeCount}) / Stale
      </span>
      <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
    </div>
  )
}

const CharacterManager = ({ characters }: CharacterManagerProps) => {
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters],
  )

  // 构建初始列表：active + divider + stale
  const initialList = useMemo((): ListItem[] => {
    const active = sortedCharacters.filter(c => c.status === 'active')
    const stale = sortedCharacters.filter(c => c.status === 'stale')

    return [
      ...active.map(c => ({ type: 'character' as const, id: c.id, data: c })),
      { type: 'divider' as const, id: DIVIDER_ID },
      ...stale.map(c => ({ type: 'character' as const, id: c.id, data: c })),
    ]
  }, [sortedCharacters])

  const [list, setList] = useState<ListItem[]>(initialList)
  const [editing, setEditing] = useState<EditingState>(null)
  const [feedback, setFeedback] = useState<FormFeedback>(null)
  const [isSaving, startSaveTransition] = useTransition()
  const [isRenaming, startRenameTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 配置拖放传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    setList(initialList)
  }, [initialList])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [feedback])

  const toFeedback = (state: FormState): FormFeedback =>
    state.status === 'error'
      ? { type: 'error', text: state.message ?? 'Something went wrong.' }
      : { type: 'success', text: state.message ?? 'Saved.' }

  const persistOrder = (currentList: ListItem[]) => {
    const dividerIndex = currentList.findIndex(i => i.type === 'divider')

    const activeIds = currentList
      .slice(0, dividerIndex)
      .filter((i): i is Extract<ListItem, { type: 'character' }> => i.type === 'character')
      .map(i => i.data.id)

    const staleIds = currentList
      .slice(dividerIndex + 1)
      .filter((i): i is Extract<ListItem, { type: 'character' }> => i.type === 'character')
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

  const handleDeleteCharacter = (character: CharacterRow) => {
    const confirmed = window.confirm(
      `Remove ${character.name}? This will also delete all ${character.commissionCount} associated commission${character.commissionCount === 1 ? '' : 's'}.`,
    )
    if (!confirmed) return

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
            prev.filter(item => !(item.type === 'character' && item.id === character.id)),
          )

          setFeedback(toFeedback(result))
          notifyDataUpdate()
        })
        .catch(() => {
          setFeedback({ type: 'error', text: 'Unable to delete character.' })
        })
        .finally(() => {
          setDeletingId(null)
        })
    })
  }

  // 处理拖动中的预览
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIdx = list.findIndex(i => i.id === active.id)
    const overIdx = list.findIndex(i => i.id === over.id)

    if (activeIdx === -1 || overIdx === -1) return

    const next = dndArrayMove(list, activeIdx, overIdx)
    setList(next)
  }

  // 处理拖放结束
  const handleDragEnd = () => {
    persistOrder(list)
  }

  const startEditingName = (character: CharacterRow) => {
    setEditing({ id: character.id, value: character.name })
  }

  const handleRenameChange = (value: string) => {
    setEditing(current => (current ? { ...current, value } : current))
  }

  const cancelEditing = () => {
    if (editing) {
      // 恢复原始值
      const itemIndex = list.findIndex(i => i.type === 'character' && i.id === editing.id)
      if (itemIndex !== -1) {
        const item = list[itemIndex] as Extract<ListItem, { type: 'character' }>
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

    const itemIndex = list.findIndex(i => i.type === 'character' && i.id === current.id)
    if (itemIndex === -1) {
      setEditing(null)
      return
    }

    const item = list[itemIndex] as Extract<ListItem, { type: 'character' }>
    const dividerIndex = list.findIndex(i => i.type === 'divider')
    const status = itemIndex < dividerIndex ? 'active' : 'stale'

    if (trimmed === item.data.name) {
      setEditing(null)
      return
    }

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
              i.type === 'character' && i.id === current.id
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

  // 计算当前的 activeCount
  const activeCount = useMemo(() => {
    const dividerIndex = list.findIndex(i => i.type === 'divider')
    return dividerIndex === -1 ? 0 : dividerIndex
  }, [list])

  // 用于 SortableContext 的 ID 列表（包括分割线）
  const itemIds = useMemo(() => {
    return list.map(i => i.id)
  }, [list])

  const statusText = feedback?.text ?? (isSaving || isRenaming || isDeleting ? 'Saving…' : null)
  const statusClass =
    feedback?.type === 'error'
      ? 'text-red-500 dark:text-red-400'
      : feedback?.type === 'success'
        ? 'text-gray-700 dark:text-gray-200'
        : 'text-gray-500 dark:text-gray-300'

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Characters</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Drag to reorder or move between Active and Stale. Active characters appear in the
          commission form.
        </p>
      </header>

      <div className="space-y-3">
        {list.filter(i => i.type === 'character').length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-300">No characters yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {list.map((item, index) => {
                if (item.type === 'divider') {
                  return <SortableDivider key="divider" activeCount={activeCount} />
                }

                const character = item.data
                const dividerIndex = list.findIndex(i => i.type === 'divider')
                const isActive = index < dividerIndex
                const isEditing = editing?.id === character.id
                const editingValue = isEditing ? editing!.value : character.name

                return (
                  <SortableCharacterItem
                    key={character.id}
                    character={character}
                    isActive={isActive}
                    isEditing={isEditing}
                    editingValue={editingValue}
                    onStartEdit={() => startEditingName(character)}
                    onRenameChange={handleRenameChange}
                    onCancelEdit={cancelEditing}
                    onSubmitRename={submitRename}
                    onDelete={() => handleDeleteCharacter(character)}
                    isDeleting={deletingId === character.id}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {statusText && <div className={`text-sm ${statusClass}`}>{statusText}</div>}
    </section>
  )
}

export default CharacterManager
