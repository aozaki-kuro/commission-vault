import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CommissionRow,
} from '@commission-index/domain'
import type { KeyboardEvent } from 'react'
import type { CharacterItem } from '../../hooks/useCommissionManager'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconDeviceFloppy, IconGripHorizontal, IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import { CommissionEditForm } from './CommissionEditForm'

const inlineEditStyles
  = 'flex-1 min-w-0 bg-transparent px-0 py-0 text-base font-semibold text-gray-900 outline-none dark:text-gray-100'

function CommissionEditFormSkeleton() {
  return (
    <div className="space-y-4">
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
  onSaveSuccess: (updated: CommissionRow) => void
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
  onSaveSuccess,
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
      data-character-status={isActive ? 'active' : 'archived'}
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
        <div
          role={isEditing ? undefined : 'button'}
          tabIndex={isEditing ? undefined : -1}
          onClick={isEditing
            ? undefined
            : (event) => {
                event.preventDefault()
                onToggle()
              }}
          className={`
            flex items-center gap-2 bg-white/90 px-3 py-2.5
            sm:gap-3 sm:px-5 sm:py-3
            dark:bg-gray-900/40
            ${isEditing ? '' : 'cursor-pointer'}
          `}
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

          {/* 名字/输入区域 — 统一结构，编辑时原地替换内容 */}
          <button
            ref={isEditing ? undefined : buttonRefFor(character.id)}
            type="button"
            aria-expanded={isEditing ? undefined : isOpen}
            aria-controls={isEditing ? undefined : panelId}
            tabIndex={isEditing ? -1 : undefined}
            className="
              flex flex-1 items-center gap-3 rounded-lg text-left
              focus-visible:ring-2 focus-visible:ring-gray-400
              focus-visible:ring-offset-2
              focus-visible:ring-offset-white focus-visible:outline-none
              dark:focus-visible:ring-offset-gray-900
            "
          >
            <span
              aria-hidden="true"
              className={isActive
                ? 'size-2.5 shrink-0 rounded-full bg-blue-500/90'
                : 'size-2.5 shrink-0 rounded-full bg-gray-400/80'}
            />
            {isEditing
              ? (
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
                )
              : (
                  <span className="
                    truncate text-base font-semibold text-gray-800
                    dark:text-gray-100
                  "
                  >
                    {character.name}
                  </span>
                )}
          </button>

          <span className="
            shrink-0 text-right font-mono text-xs font-normal text-gray-500
            dark:text-gray-300
          "
          >
            {totalCommissions}
            <span className="
              hidden
              sm:inline
            "
            >
              {' '}
              entries
            </span>
          </span>

          {/* 操作按钮 — 位置尺寸固定，编辑时只换图标和功能 */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (isEditing)
                  onSubmitRename()
                else
                  onStartEdit()
              }}
              disabled={isDeleting}
              aria-label={isEditing ? `Save name for ${character.name}` : `Rename ${character.name}`}
              className="
                inline-flex size-7 shrink-0 items-center justify-center
                rounded-lg border border-transparent text-gray-400
                transition
                hover:text-gray-600
                focus-visible:ring-2 focus-visible:ring-gray-400
                focus-visible:ring-offset-2
                focus-visible:ring-offset-white
                focus-visible:outline-none
                disabled:cursor-not-allowed disabled:text-gray-300
                dark:hover:text-gray-200
                dark:focus-visible:ring-offset-gray-900
                dark:disabled:text-gray-600
              "
            >
              {isEditing
                ? <IconDeviceFloppy className="size-4" stroke={2} aria-hidden="true" />
                : <IconPencil className="size-4" stroke={2} aria-hidden="true" />}
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (isEditing)
                  onCancelEdit()
                else
                  onRequestDelete()
              }}
              disabled={isDeleting}
              aria-label={isEditing ? `Cancel renaming ${character.name}` : `Remove ${character.name}`}
              className={`
                inline-flex size-8 shrink-0 items-center justify-center
                rounded-lg border border-transparent text-gray-400
                transition
                focus-visible:ring-2 focus-visible:ring-offset-2
                focus-visible:ring-offset-white focus-visible:outline-none
                disabled:cursor-not-allowed disabled:text-gray-300
                dark:focus-visible:ring-offset-gray-900
                dark:disabled:text-gray-600
                ${isEditing
      ? `hover:text-gray-600 focus-visible:ring-gray-400
         dark:hover:text-gray-200`
      : `hover:text-red-500 focus-visible:ring-red-400
         dark:hover:text-red-300`}
              `}
            >
              {isEditing
                ? <IconX className="size-4" stroke={2} aria-hidden="true" />
                : <IconTrash className="size-4" stroke={2} aria-hidden="true" />}
            </button>
          </div>
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
                border-t border-gray-200 bg-white/85 px-3
                sm:px-5
                dark:border-gray-700 dark:bg-gray-900/30
                ${reduceMotion ? '' : 'transition-all duration-200 ease-out'}
                ${isOpen
      ? 'translate-y-0 opacity-100'
      : `-translate-y-1 opacity-0`}
              `}
            >
              {/* Show skeleton only while the card is open and loading */}
              {isOpen && (isCommissionsLoading || !isCommissionsLoaded)
                ? (
                    <div className="space-y-4 py-4">
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
                : null}

              {/* Keep forms mounted once loaded so images stay cached through open/close cycles */}
              {isCommissionsLoaded && !isCommissionsLoading
                ? commissionList.length === 0
                  ? (
                      <p className="
                        py-4 text-sm text-gray-500
                        dark:text-gray-300
                      "
                      >
                        No commissions recorded yet.
                      </p>
                    )
                  : (
                      <div className="
                        divide-y divide-gray-200/80
                        dark:divide-gray-700/80
                      "
                      >
                        {commissionList.map(commission => (
                          <div key={commission.id} className="py-5">
                            <CommissionEditForm
                              commission={commission}
                              characters={charactersForSelect}
                              commissionSearchRows={commissionSearchRows}
                              onDelete={() => onDeleteCommission(commission.id)}
                              onSaveSuccess={onSaveSuccess}
                            />
                          </div>
                        ))}
                      </div>
                    )
                : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
