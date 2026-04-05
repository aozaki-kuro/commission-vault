// apps/admin/src/hooks/useNativeDragReorder.ts
import type { DragEvent } from 'react'
import { useCallback, useRef, useState } from 'react'

interface UseNativeDragReorderOptions {
  itemCount: number
  onReorder: (fromIndex: number, toIndex: number) => void
  disabled?: boolean
}

const DRAG_ITEM_ATTR = 'data-drag-item-index'

export function useNativeDragReorder({
  itemCount,
  onReorder,
  disabled = false,
}: UseNativeDragReorderOptions) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const computeDropIndex = useCallback((clientY: number, currentDraggingIndex: number): number | null => {
    const container = containerRef.current
    if (!container)
      return null

    const items = container.querySelectorAll<HTMLElement>(`[${DRAG_ITEM_ATTR}]`)
    if (items.length === 0)
      return null

    for (const item of items) {
      const index = Number(item.getAttribute(DRAG_ITEM_ATTR))
      if (index === currentDraggingIndex)
        continue

      const rect = item.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2

      if (clientY < midpoint) {
        return index
      }
    }

    // Below all items — drop at the end
    return itemCount
  }, [itemCount])

  const dragHandleProps = useCallback((index: number) => {
    if (disabled) {
      return {
        'aria-disabled': true as const,
        'draggable': false as const,
      }
    }

    return {
      draggable: true as const,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        // Set minimal data so the drag is recognized
        e.dataTransfer.setData('text/plain', String(index))
        setDraggingIndex(index)
      },
      onDragEnd: () => {
        setDraggingIndex(null)
        setDropIndicatorIndex(null)
      },
    }
  }, [disabled])

  const containerProps = {
    ref: containerRef,
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      if (draggingIndex === null)
        return
      const targetIndex = computeDropIndex(e.clientY, draggingIndex)
      setDropIndicatorIndex(targetIndex)
    },
    onDragLeave: (e: DragEvent) => {
      // Only clear if leaving the container itself, not entering a child
      if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
        setDropIndicatorIndex(null)
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()

      if (draggingIndex === null || dropIndicatorIndex === null) {
        setDraggingIndex(null)
        setDropIndicatorIndex(null)
        return
      }

      // Convert dropIndicatorIndex (visual position) to actual move target
      let toIndex = dropIndicatorIndex
      // If dropping below the original position, adjust because the dragged
      // item will be removed first, shifting indices down
      if (toIndex > draggingIndex) {
        toIndex -= 1
      }

      if (toIndex !== draggingIndex) {
        onReorder(draggingIndex, toIndex)
      }

      setDraggingIndex(null)
      setDropIndicatorIndex(null)
    },
  }

  return {
    containerProps,
    dragHandleProps,
    dragItemAttr: (index: number) => ({ [DRAG_ITEM_ATTR]: index }),
    draggingIndex,
    dropIndicatorIndex,
  }
}
