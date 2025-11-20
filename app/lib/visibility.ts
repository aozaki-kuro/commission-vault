import { kebabCase } from './strings'

export interface Section {
  id: string
  visibleHeight: number
  distanceToCenter: number
  top: number
  bottom: number
}

/**
 * Calculate visibility metrics for a section.
 */
export const calculateVisibility = (rect: DOMRect, contentHeight: number) => {
  const viewportHeight = window.innerHeight
  const bottom = rect.top + contentHeight

  const visibleTop = Math.max(rect.top, 0)
  const visibleBottom = Math.min(bottom, viewportHeight)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)

  const sectionVisibleCenter = visibleHeight > 0 ? (visibleTop + visibleBottom) * 0.6 : Infinity
  const distanceToCenter = Math.abs(sectionVisibleCenter - viewportHeight / 2)

  return {
    visibleHeight,
    distanceToCenter,
    top: rect.top,
    bottom,
  }
}

/**
 * Collect visibility info for all character sections.
 */
export const getSections = (characters: { DisplayName: string }[]): Section[] =>
  characters
    .map(character => {
      const id = `title-${kebabCase(character.DisplayName)}`
      const element = document.getElementById(id)
      if (!element?.parentElement) return null

      const rect = element.getBoundingClientRect()
      const contentHeight = element.parentElement.offsetHeight

      return { id, ...calculateVisibility(rect, contentHeight) }
    })
    .filter((section): section is Section => section !== null)

/**
 * Collect visibility info for a set of element ids.
 */
export const getSectionsByIds = (ids: string[]): Section[] =>
  ids
    .map(id => {
      const element = document.getElementById(id)
      if (!element?.parentElement) return null

      const rect = element.getBoundingClientRect()
      const contentHeight = element.parentElement.offsetHeight

      return { id, ...calculateVisibility(rect, contentHeight) }
    })
    .filter((section): section is Section => section !== null)

/**
 * Determine the active section based on visibility.
 */
export const findActiveSection = (sections: Section[]): string => {
  const visibleSections = sections.filter(section => section.visibleHeight > 0)

  if (visibleSections.length > 0) {
    return visibleSections.reduce((closest, current) =>
      current.distanceToCenter < closest.distanceToCenter ? current : closest,
    ).id
  }

  return sections.reduce((closest, current) =>
    Math.abs(current.top) < Math.abs(closest.top) ? current : closest,
  ).id
}
