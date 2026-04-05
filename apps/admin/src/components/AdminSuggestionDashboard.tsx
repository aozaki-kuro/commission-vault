import type { DragHandleProps } from '../hooks/useNativeDragReorder'
import { IconGripHorizontal, IconX } from '@tabler/icons-react'
import { useActionState, useCallback, useEffect, useMemo, useState } from 'react'
import { adminSurfaceStyles, formControlStyles } from '../app/ui'
import { arrayMove, useNativeDragReorder } from '../hooks/useNativeDragReorder'
import { saveHomeFeaturedKeywordsAction } from '../lib/adminActions'
import { INITIAL_FORM_STATE } from '../lib/formState'
import { dedupeKeywords, normalizeKeyword, normalizeKeywordKey } from '../lib/keywords'
import { markPendingRebuild } from '../lib/pendingRebuildSignal'
import { DropIndicator } from './DropIndicator'
import { FormStatusIndicator } from './FormStatusIndicator'
import { SaveButton } from './SaveButton'

interface AdminSuggestionDashboardProps {
  featuredKeywords: string[]
  keywordOptions: string[]
}

const MAX_FEATURED_KEYWORDS = 6

interface KeywordItemProps {
  dragHandleProps: DragHandleProps
  isDragging: boolean
  keyword: string
  onRemove: (keyword: string) => void
}

function KeywordItem({ dragHandleProps, isDragging, keyword, onRemove }: KeywordItemProps) {
  return (
    <div
      className={`
        flex items-center gap-2 rounded-lg border border-gray-200 bg-white/80
        px-3 py-2
        dark:border-gray-700 dark:bg-gray-900/50
        ${isDragging ? 'opacity-55' : ''}
      `}
    >
      <button
        type="button"
        className="
          inline-flex size-7 shrink-0 items-center justify-center rounded-md
          border border-transparent text-gray-400 transition
          cursor-grab
          hover:text-gray-700
          active:cursor-grabbing
          dark:text-gray-500
          dark:hover:text-gray-200
        "
        aria-label={`Drag ${keyword}`}
        {...dragHandleProps}
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
    </div>
  )
}

export function AdminSuggestionDashboard({
  featuredKeywords,
  keywordOptions,
}: AdminSuggestionDashboardProps) {
  const [state, formAction] = useActionState(saveHomeFeaturedKeywordsAction, INITIAL_FORM_STATE)

  useEffect(() => {
    if (state.status === 'success') {
      markPendingRebuild()
    }
  }, [state.status])

  const [manualInput, setManualInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState(() =>
    dedupeKeywords(featuredKeywords, MAX_FEATURED_KEYWORDS),
  )

  const selectedKeySet = useMemo(
    () => new Set(selectedKeywords.map(normalizeKeywordKey)),
    [selectedKeywords],
  )

  const dedupedOptions = useMemo(
    () => dedupeKeywords(keywordOptions),
    [keywordOptions],
  )

  const filteredOptions = useMemo(() => {
    const query = normalizeKeywordKey(searchInput)
    if (!query)
      return dedupedOptions
    return dedupedOptions.filter(kw => normalizeKeywordKey(kw).includes(query))
  }, [dedupedOptions, searchInput])

  const keywordsJson = useMemo(() => JSON.stringify(selectedKeywords), [selectedKeywords])
  const canAddMore = selectedKeywords.length < MAX_FEATURED_KEYWORDS

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedKeywords(prev => arrayMove(prev, fromIndex, toIndex))
  }, [])

  const {
    containerProps: dragContainerProps,
    dragHandleProps,
    dragItemAttr,
    draggingIndex,
    dropIndicatorIndex,
  } = useNativeDragReorder({
    itemCount: selectedKeywords.length,
    onReorder: handleReorder,
  })

  const addKeyword = (rawKeyword: string) => {
    const keyword = normalizeKeyword(rawKeyword)
    if (!keyword)
      return

    setSelectedKeywords((prev) => {
      if (prev.length >= MAX_FEATURED_KEYWORDS)
        return prev
      if (prev.some(item => normalizeKeywordKey(item) === normalizeKeywordKey(keyword)))
        return prev
      return [...prev, keyword]
    })
  }

  const removeKeyword = (keyword: string) => {
    const key = normalizeKeywordKey(keyword)
    setSelectedKeywords(prev => prev.filter(item => normalizeKeywordKey(item) !== key))
  }

  const toggleKeyword = (keyword: string) => {
    if (selectedKeySet.has(normalizeKeywordKey(keyword))) {
      removeKeyword(keyword)
    }
    else {
      addKeyword(keyword)
    }
  }

  const handleManualAdd = () => {
    addKeyword(manualInput)
    setManualInput('')
  }

  return (
    <form
      action={formAction}
      className={`${adminSurfaceStyles} motion-safe:animate-[tabFade_300ms_cubic-bezier(0.25,1,0.5,1)_both]`}
    >
      <input type="hidden" name="keywordsJson" value={keywordsJson} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="
            text-lg font-semibold text-gray-900
            dark:text-gray-100
          "
        >
          Featured keywords
          {' '}
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            (
            {selectedKeywords.length}
            /
            {MAX_FEATURED_KEYWORDS}
            )
          </span>
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            successLabel="Saved"
            errorFallback="Unable to save featured keywords."
          />
          <SaveButton label="Save" />
        </div>
      </div>

      {/* Edit zone: sortable list + manual add */}
      <div className="space-y-3">
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
              <div role="list" className="space-y-2" {...dragContainerProps}>
                {selectedKeywords.map((keyword, index) => (
                  <div key={keyword} role="listitem" className="relative" {...dragItemAttr(index)}>
                    {dropIndicatorIndex === index && <DropIndicator offsetClass="-top-1.5" />}
                    <KeywordItem
                      keyword={keyword}
                      onRemove={removeKeyword}
                      dragHandleProps={dragHandleProps(index)}
                      isDragging={draggingIndex === index}
                    />
                  </div>
                ))}
                {dropIndicatorIndex === selectedKeywords.length && <DropIndicator offsetClass="-top-1.5" />}
              </div>
            )}

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={manualInput}
              onChange={event => setManualInput(event.target.value)}
              className={formControlStyles}
              placeholder="Add keyword manually"
              aria-label="Add keyword manually"
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
      </div>

      {/* Keyword pool — separated as auxiliary browse zone */}
      <div className="space-y-4 border-t border-gray-200/80 pt-5 dark:border-gray-700/80">
        <div className="flex items-center gap-3">
          <h3
            className="
              shrink-0 text-sm font-semibold text-gray-900
              dark:text-gray-100
            "
          >
            Keyword pool
          </h3>
          <div className="min-w-0 flex-1">
            <input
              type="search"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className={formControlStyles}
              placeholder="Search keywords"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredOptions.length === 0
            ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No keyword matches the current search.
                </p>
              )
            : (
                filteredOptions.map((keyword) => {
                  const isSelected = selectedKeySet.has(normalizeKeywordKey(keyword))
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => toggleKeyword(keyword)}
                      disabled={!isSelected && !canAddMore}
                      className={`
                        rounded-full border px-3 py-1.5 text-xs font-medium transition
                        ${isSelected
                      ? `
                            border-gray-900 bg-gray-900 text-white
                            dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900
                          `
                      : `
                            border-gray-300/80 bg-white text-gray-700
                            hover:border-gray-400 hover:text-gray-900
                            disabled:pointer-events-none disabled:opacity-50
                            dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-200
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
      </div>
    </form>
  )
}
