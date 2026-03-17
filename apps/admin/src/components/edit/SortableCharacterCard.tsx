import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CommissionRow,
} from '@commission-index/domain'
import type { KeyboardEvent } from 'react'
import type { CharacterItem } from '../../hooks/useCommissionManager'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripHorizontal, IconPencil, IconX } from '@tabler/icons-react'
import { CommissionEditForm } from './CommissionEditForm'

const inlineEditStyles
  = 'flex-1 min-w-0 bg-transparent px-0 py-0 text-base font-semibold text-gray-900 outline-none dark:text-gray-100'

function CommissionEditFormSkeleton() {
  return (
    <div className="
      space-y-4 rounded-xl border border-gray-200/80 bg-white/80 p-4
      dark:border-gray-700/80 dark:bg-gray-900/30
    "
    >
      <div className="
        aspect-1280/525 w-full animate-pulse rounded-xl bg-gray-200/80
        dark:bg-gray-800
      "
      />
      <div className="
        grid gap-3
        md:grid-cols-2
      "
      >
        <div className="
          h-14 w-full animate-pulse rounded-lg bg-gray-200/80
          dark:bg-gray-800
        "
        />
        <div className="
          h-14 w-full animate-pulse rounded-lg bg-gray-200/80
          dark:bg-gray-800
        "
        />
      </div>
      <div className="
        h-24 w-full animate-pulse rounded-lg bg-gray-200/80
        dark:bg-gray-800
      "
      />
    </div>
  )
}

interface SortableCharacterCardProps {
  buttonRefFor: (id: number) => (element: HTMLButtonElement | null) => void
  charactersForSelect: CharacterRow[]
  commissionList: CommissionRow[]
  commissionSearchRows: AdminCommissionSearchRow[]
  disableDrag?: boolean
  editingValue: string
  isActive: boolean
  isCommissionsLoaded: boolean
  isCommissionsLoading: boolean
  isDeleting: boolean
  isEditing: boolean
  isOpen: boolean
  item: CharacterItem
  onCancelEdit: () => void
  onDeleteCommission: (commissionId: number) => void
  onRenameChange: (value: string) => void
  onRequestDelete: () => void
  onStartEdit: () => void
  onSubmitRename: () => void
  onToggle: () => void
  reduceMotion?: boolean
  totalCommissions: number
}

export function SortableCharacterCard({
  buttonRefFor,
  charactersForSelect,
  commissionList,
  commissionSearchRows,
  disableDrag = false,
  editingValue,
  isActive,
  isCommissionsLoaded,
  isCommissionsLoading,
  isDeleting,
  isEditing,
  isOpen,
  item,
  onCancelEdit,
  onDeleteCommission,
  onRenameChange,
  onRequestDelete,
  onStartEdit,
  onSubmitRename,
  onToggle,
  reduceMotion = false,
  totalCommissions,
}: SortableCharacterCardProps) {
  const character = item.data
  const sectionId = `admin-character-${character.id}`
  const panelId = `${sectionId}-panel`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    disabled: disableDrag || isDeleting,
    id: character.id,
  })

  return (
    <div
      ref={setNodeRef}
      id={sectionId}
      data-character-section="true"
      data-character-status={isActive ? 'active' : 'stale'}
      data-total-commissions={totalCommissions}
      style={{
        opacity: isDragging ? 0.55 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="
        overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm
        ring-1 ring-gray-900/5 transition
        dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10
      "
      >
        <div className="
          flex items-center gap-3 bg-white/90 px-5 py-3
          dark:bg-gray-900/40
        "
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={isDeleting || disableDrag}
            onClick={event => event.stopPropagation()}
            aria-label={disableDrag
              ? `Drag disabled while search is applied for ${character.name}`
              : `Drag ${character.name}`}
            className={`
              inline-flex size-8 shrink-0 items-center justify-center rounded-lg
              border border-transparent text-gray-400 transition
              focus-visible:ring-2 focus-visible:ring-gray-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-white
              focus-visible:outline-none
              dark:focus-visible:ring-offset-gray-900
              ${disableDrag || isDeleting
      ? 'cursor-not-allowed opacity-50'
      : `
        cursor-grab
        hover:text-gray-600
        active:cursor-grabbing
        dark:hover:text-gray-200
      `}
            `}
          >
            <IconGripHorizontal className="size-5" stroke={2} aria-hidden="true" />
          </button>

          {isEditing
            ? (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={isActive
                      ? 'size-2.5 shrink-0 rounded-full bg-blue-500/90'
                      : 'size-2.5 shrink-0 rounded-full bg-gray-400/80'}
                  />
                  <input
                    type="text"
                    autoFocus
                    value={editingValue}
                    disabled={isDeleting}
                    onChange={event => onRenameChange(event.target.value)}
                    onBlur={onSubmitRename}
                    onClick={event => event.stopPropagation()}
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
                  />
                  <span className="
                    w-24 text-right font-mono text-xs font-normal text-gray-500
                    dark:text-gray-300
                  "
                  >
                    {totalCommissions}
                    {' '}
                    entries
                  </span>
                </div>
              )
            : (
                <>
                  <button
                    ref={buttonRefFor(character.id)}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      onToggle()
                    }}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="
                      flex flex-1 items-center justify-between gap-3 rounded-lg
                      text-left
                      focus-visible:ring-2 focus-visible:ring-gray-400
                      focus-visible:ring-offset-2
                      focus-visible:ring-offset-white focus-visible:outline-none
                      dark:focus-visible:ring-offset-gray-900
                    "
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={isActive
                          ? 'size-2.5 shrink-0 rounded-full bg-blue-500/90'
                          : 'size-2.5 shrink-0 rounded-full bg-gray-400/80'}
                      />
                      <span className="
                        truncate text-base font-semibold text-gray-800
                        dark:text-gray-100
                      "
                      >
                        {character.name}
                      </span>
                    </div>

                    <span className="
                      w-24 shrink-0 text-right font-mono text-xs font-normal
                      text-gray-500
                      dark:text-gray-300
                    "
                    >
                      {totalCommissions}
                      {' '}
                      entries
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onStartEdit()
                    }}
                    disabled={isDeleting}
                    aria-label={`Rename ${character.name}`}
                    className="
                      inline-flex size-7 shrink-0 items-center justify-center
                      rounded-lg border border-transparent text-gray-400
                      transition
                      hover:text-gray-600
                      focus-visible:ring-2 focus-visible:ring-gray-400
                      focus-visible:ring-offset-2
                      focus-visible:ring-offset-white focus-visible:outline-none
                      disabled:cursor-not-allowed disabled:text-gray-300
                      dark:hover:text-gray-200
                      dark:focus-visible:ring-offset-gray-900
                      dark:disabled:text-gray-600
                    "
                  >
                    <IconPencil className="size-4" stroke={2} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRequestDelete()
                    }}
                    disabled={isDeleting}
                    aria-label={`Remove ${character.name}`}
                    className="
                      inline-flex size-8 shrink-0 items-center justify-center
                      rounded-lg border border-transparent text-gray-400
                      transition
                      hover:text-red-500
                      focus-visible:ring-2 focus-visible:ring-red-400
                      focus-visible:ring-offset-2
                      focus-visible:ring-offset-white focus-visible:outline-none
                      disabled:cursor-not-allowed disabled:text-gray-300
                      dark:hover:text-red-300
                      dark:focus-visible:ring-offset-gray-900
                      dark:disabled:text-gray-600
                    "
                  >
                    <IconX className="size-4" stroke={2} aria-hidden="true" />
                  </button>
                </>
              )}
        </div>

        <div
          id={panelId}
          className={`
            grid
            ${reduceMotion
      ? ''
      : `transition-[grid-template-rows] duration-200 ease-in-out`}
            ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
          `}
        >
          <div className="overflow-hidden">
            <div
              aria-hidden={!isOpen}
              className={`
                space-y-4 border-t border-gray-200 bg-white/85 px-5 py-4
                dark:border-gray-700 dark:bg-gray-900/30
                ${reduceMotion ? '' : 'transition-all duration-200 ease-out'}
                ${isOpen
      ? 'translate-y-0 opacity-100'
      : `-translate-y-1 opacity-0`}
              `}
            >
              {isOpen
                ? (
                    isCommissionsLoading || !isCommissionsLoaded
                      ? (
                          <div className="space-y-4">
                            <CommissionEditFormSkeleton />
                            <p className="
                              text-sm text-gray-500
                              dark:text-gray-300
                            "
                            >
                              Loading commissions…
                            </p>
                          </div>
                        )
                      : commissionList.length === 0
                        ? (
                            <p className="
                              text-sm text-gray-500
                              dark:text-gray-300
                            "
                            >
                              No commissions recorded yet.
                            </p>
                          )
                        : commissionList.map(commission => (
                            <CommissionEditForm
                              key={commission.id}
                              commission={commission}
                              characters={charactersForSelect}
                              commissionSearchRows={commissionSearchRows}
                              onDelete={() => onDeleteCommission(commission.id)}
                            />
                          ))
                  )
                : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
