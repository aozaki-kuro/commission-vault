'use client'

import type { Section } from '#lib/visibility'
import { calculateVisibility, findActiveSection } from '#lib/visibility'
import { useEffect, useRef, useState } from 'react'

const getScrollThreshold = () => {
  const viewportRatio = window.innerWidth < 768 ? 0.2 : 0.25
  return Math.max(80, window.innerHeight * viewportRatio)
}

const isElementAtThreshold = (element: HTMLElement, threshold: number) => {
  const rect = element.getBoundingClientRect()
  return rect.top <= threshold && rect.bottom >= threshold
}

const getSectionsFromElements = (elements: HTMLElement[]): Section[] =>
  elements
    .map(element => {
      if (!element?.parentElement) return null

      const rect = element.getBoundingClientRect()
      const contentHeight = element.parentElement.offsetHeight

      return { id: element.id, ...calculateVisibility(rect, contentHeight) }
    })
    .filter((section): section is Section => section !== null)

const resetStaleHash = () => {
  const hash = window.location.hash
  if (!hash) return

  const element = document.querySelector(hash)
  if (!element) {
    history.replaceState(null, '', ' ')
    return
  }

  const rect = element.getBoundingClientRect()
  const isOffscreen = rect.bottom < 0 || rect.top > window.innerHeight
  if (isOffscreen) history.replaceState(null, '', ' ')
}

export const useCharacterScrollSpy = (
  titleIds: string[],
  introductionId = 'title-introduction',
) => {
  const [activeId, setActiveId] = useState<string>('')
  const rafId = useRef<number | null>(null)
  const thresholdRef = useRef<number>(0)
  const sectionElementsRef = useRef<HTMLElement[]>([])
  const introductionElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    introductionElementRef.current = document.getElementById(introductionId)
    sectionElementsRef.current = titleIds
      .map(id => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))
  }, [introductionId, titleIds])

  useEffect(() => {
    const updateThreshold = () => {
      thresholdRef.current = getScrollThreshold()
    }

    updateThreshold()
    window.addEventListener('resize', updateThreshold)

    return () => window.removeEventListener('resize', updateThreshold)
  }, [])

  useEffect(() => {
    const updateActiveId = () => {
      const introductionElement = introductionElementRef.current
      const threshold = thresholdRef.current
      const isAtIntroduction =
        introductionElement && isElementAtThreshold(introductionElement, threshold)

      if (window.scrollY === 0 || isAtIntroduction) {
        setActiveId('')
        resetStaleHash()
        return
      }

      const sections = getSectionsFromElements(sectionElementsRef.current)
      if (!sections.length) return

      setActiveId(findActiveSection(sections))
      resetStaleHash()
    }

    const handleScroll = () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(updateActiveId)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [titleIds])

  return activeId
}
