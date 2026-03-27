import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripHorizontal, IconX } from '@tabler/icons-react'
import { useActionState, useDeferredValue, useMemo, useState } from 'react'
import { adminSurfaceStyles, formControlStyles } from '../app/ui'
import { saveHomeFeaturedKeywordsAction } from '../lib/adminActions'
import { INITIAL_FORM_STATE } from '../lib/formState'
import { dedupeKeywords } from '../lib/keywords'
import { FormStatusIndicator } from './FormStatusIndicator'
import { SaveButton } from './SaveButton'

interface AdminSuggestionDashboardProps {
  featuredKeywords: string[]
  keywordOptions: string[]
}

const MAX_FEATURED_KEYWORDS = 6
const MAX_KEYWORD_OPTIONS = 240
const MAX_VISIBLE_AVAILABLE_KEYWORDS = 120
const NORMALIZE_SPACES_PATTERN = /\s+/g

function normalizeKeyword(value: string) {
  return value.trim().replace(NORMALIZE_SPACES_PATTERN, ' ')
}

function normalizeKeywordKey(value: string) {
  return normalizeKeyword(value).toLowerCase()
}

interface SortableKeywordItemProps {
  keyword: string
  onRemove: (keyword: string) => void
}

function SortableKeywordItem({ keyword, onRemove }: SortableKeywordItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: keyword,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="
        flex items-center gap-2 rounded-lg border border-gray-200 bg-white/80
        px-3 py-2
        dark:border-gray-700 dark:bg-gray-900/50
      "
    >
      <button
        type="button"
        className="
          inline-flex size-7 shrink-0 items-center justify-center rounded-md
          border border-transparent text-gray-400 transition
          hover:text-gray-700
          dark:text-gray-500
          dark:hover:text-gray-200
        "
        aria-label={`Drag ${keyword}`}
        {...attributes}
        {...listeners}
      >
        <IconGripHorizontal className="size-4" stroke={2} aria-hidden="true" />
      </button>

      <span
        className="
          min-w-0 flex-1 truncate font-mono text-xs text-gray-800
          dark:text-gray-200
        "
      >
        {keyword}
      </span>

      <button
        type="button"
        onClick={() => onRemove(keyword)}
        className="
          inline-flex size-7 shrink-0 items-center justify-center rounded-md
          border border-transparent text-gray-400 transition
          hover:text-red-500
          dark:text-gray-500
          dark:hover:text-red-300
        "
        aria-label={`Remove ${keyword}`}
      >
        <IconX className="size-4" stroke={2} aria-hidden="true" />
      </button>
    </li>
  )
}

export function AdminSuggestionDashboard({
  featuredKeywords,
  keywordOptions,
}: AdminSuggestionDashboardProps) {
  const [state, formAction] = useActionState(saveHomeFeaturedKeywordsAction, INITIAL_FORM_STATE)
  const [manualInput, setManualInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const deferredSearchInput = useDeferredValue(searchInput)
  const [selectedKeywords, setSelectedKeywords] = useState(() =>
    dedupeKeywords(featuredKeywords, MAX_FEATURED_KEYWORDS),
  )
  const normalizedSelectedKeywordKeySet = useMemo(
    () => new Set(selectedKeywords.map(normalizeKeywordKey)),
    [selectedKeywords],
  )
  const dedupedKeywordOptions = useMemo(
    () => dedupeKeywords(keywordOptions, MAX_KEYWORD_OPTIONS),
    [keywordOptions],
  )
  const normalizedSearchQuery = useMemo(
    () => normalizeKeywordKey(deferredSearchInput),
    [deferredSearchInput],
  )

  const availableKeywords = useMemo(() => {
    if (!normalizedSearchQuery) {
      return dedupedKeywordOptions.slice(0, MAX_VISIBLE_AVAILABLE_KEYWORDS)
    }

    return dedupedKeywordOptions
      .filter(keyword => normalizeKeywordKey(keyword).includes(normalizedSearchQuery))
      .slice(0, MAX_VISIBLE_AVAILABLE_KEYWORDS)
  }, [dedupedKeywordOptions, normalizedSearchQuery])

  const keywordsJson = useMemo(() => JSON.stringify(selectedKeywords), [selectedKeywords])
  const canAddMore = selectedKeywords.length < MAX_FEATURED_KEYWORDS
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const addKeyword = (rawKeyword: string) => {
    const keyword = normalizeKeyword(rawKeyword)
    if (!keyword) {
      return
    }

    setSelectedKeywords((previous) => {
      if (previous.length >= MAX_FEATURED_KEYWORDS) {
        return previous
      }

      const keywordKey = normalizeKeywordKey(keyword)
      const hasDuplicate = previous.some(item => normalizeKeywordKey(item) === keywordKey)
      if (hasDuplicate) {
        return previous
      }

      return [...previous, keyword]
    })
  }

  const removeKeywordByKey = (keywordKey: string) => {
    setSelectedKeywords(previous =>
      previous.filter(item => normalizeKeywordKey(item) !== keywordKey),
    )
  }

  const removeKeyword = (keyword: string) => {
    removeKeywordByKey(normalizeKeywordKey(keyword))
  }

  const toggleKeyword = (keyword: string) => {
    const keywordKey = normalizeKeywordKey(keyword)
    if (normalizedSelectedKeywordKeySet.has(keywordKey)) {
      removeKeywordByKey(keywordKey)
      return
    }

    addKeyword(keyword)
  }

  const handleManualAdd = () => {
    addKeyword(manualInput)
    setManualInput('')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    setSelectedKeywords((previous) => {
      const oldIndex = previous.findIndex(keyword => keyword === active.id)
      const newIndex = previous.findIndex(keyword => keyword === over.id)
      if (oldIndex < 0 || newIndex < 0) {
        return previous
      }

      return arrayMove(previous, oldIndex, newIndex)
    })
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2
          className="
            text-lg font-semibold text-gray-900
            dark:text-gray-100
          "
        >
          Suggestion curation
        </h2>
        <p
          className="
            text-sm text-gray-600
            dark:text-gray-300
          "
        >
          Configure the first-batch home keyword suggestions and keep ordering fully deterministic.
        </p>
      </header>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="keywordsJson" value={keywordsJson} />

        <section className={adminSurfaceStyles}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className="
                text-sm font-medium text-gray-900
                dark:text-gray-100
              "
            >
              Featured keywords (
              {selectedKeywords.length}
              /
              {MAX_FEATURED_KEYWORDS}
              )
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <FormStatusIndicator
                status={state.status}
                message={state.message}
                successLabel="Saved"
                errorFallback="Unable to save featured keywords."
              />
              <SaveButton label="Save featured keywords" />
            </div>
          </div>

          <p
            className="
              text-sm text-gray-600
              dark:text-gray-300
            "
          >
            Home first batch uses these keywords first, then rotates to random suggestions.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedKeywords}
              strategy={verticalListSortingStrategy}
            >
              {selectedKeywords.length === 0
                ? (
                    <div
                      className="
                        rounded-lg border border-dashed border-gray-300/80 px-4
                        py-6 text-sm text-gray-500
                        dark:border-gray-700 dark:text-gray-400
                      "
                    >
                      No featured keywords yet. Add up to six.
                    </div>
                  )
                : (
                    <ol className="space-y-2">
                      {selectedKeywords.map(keyword => (
                        <SortableKeywordItem
                          key={keyword}
                          keyword={keyword}
                          onRemove={removeKeyword}
                        />
                      ))}
                    </ol>
                  )}
            </SortableContext>
          </DndContext>
        </section>

        <section className={adminSurfaceStyles}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="manual-featured-keyword"
                className="
                  mb-2 block text-sm font-medium text-gray-900
                  dark:text-gray-100
                "
              >
                Add keyword manually
              </label>
              <input
                id="manual-featured-keyword"
                type="text"
                value={manualInput}
                onChange={event => setManualInput(event.target.value)}
                className={formControlStyles}
                placeholder="Type a keyword"
              />
            </div>

            <button
              type="button"
              onClick={handleManualAdd}
              disabled={!manualInput.trim() || !canAddMore}
              className="
                inline-flex h-11 items-center justify-center rounded-lg border
                border-gray-300 bg-white px-4 text-sm font-medium text-gray-700
                transition
                hover:bg-gray-100
                focus-visible:ring-2 focus-visible:ring-gray-400
                focus-visible:ring-offset-2 focus-visible:ring-offset-white
                focus-visible:outline-none
                active:scale-[0.97]
                disabled:pointer-events-none disabled:opacity-50
                dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100
                dark:hover:bg-gray-800
                dark:focus-visible:ring-offset-gray-900
              "
            >
              Add
            </button>
          </div>
        </section>

        <section className={adminSurfaceStyles}>
          <div className="space-y-3">
            <div className="space-y-1">
              <h3
                className="
                  text-sm font-medium text-gray-900
                  dark:text-gray-100
                "
              >
                Keyword pool
              </h3>
              <p
                className="
                  text-sm text-gray-600
                  dark:text-gray-300
                "
              >
                Search the current keyword pool and toggle items into the featured list.
              </p>
            </div>

            <input
              type="search"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className={formControlStyles}
              placeholder="Search keywords"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {availableKeywords.length === 0
              ? (
                  <p
                    className="
                      text-sm text-gray-500
                      dark:text-gray-400
                    "
                  >
                    No keyword matches the current search.
                  </p>
                )
              : (
                  availableKeywords.map((keyword) => {
                    const isSelected = normalizedSelectedKeywordKeySet.has(normalizeKeywordKey(keyword))
                    return (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => toggleKeyword(keyword)}
                        disabled={!isSelected && !canAddMore}
                        className={`
                          rounded-full border px-3 py-1.5 text-xs font-medium
                          transition
                          ${isSelected
                        ? `
                          border-gray-900 bg-gray-900 text-white
                          dark:border-gray-100 dark:bg-gray-100
                          dark:text-gray-900
                        `
                        : `
                          border-gray-300/80 bg-white text-gray-700
                          hover:border-gray-400 hover:text-gray-900
                          disabled:pointer-events-none disabled:opacity-50
                          dark:border-gray-700 dark:bg-gray-950/40
                          dark:text-gray-200
                          dark:hover:border-gray-600 dark:hover:text-gray-100
                        `}
                        `}
                      >
                        {keyword}
                      </button>
                    )
                  })
                )}
          </div>
        </section>
      </form>
    </section>
  )
}
