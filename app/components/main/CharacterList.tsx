'use client'
import { buildCharacterNavItems } from '#lib/characters'
import { findActiveSection, getSectionsByIds } from '#lib/visibility'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface CharacterListProps {
  characters: { DisplayName: string }[]
}

const CharacterList = ({ characters }: CharacterListProps) => {
  const navItems = useMemo(() => buildCharacterNavItems(characters), [characters])
  const titleIds = useMemo(() => navItems.map(item => item.titleId), [navItems])
  const [activeId, setActiveId] = useState<string>('')
  const rafId = useRef<number | null>(null)
  const introductionElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    introductionElementRef.current = document.getElementById('title-introduction')
  }, [])

  const getOptimalThreshold = useCallback(() => {
    const isMobile = window.innerWidth < 768
    const viewportRatio = isMobile ? 0.2 : 0.25
    const calculatedThreshold = window.innerHeight * viewportRatio
    const minThreshold = 80

    return Math.max(minThreshold, calculatedThreshold)
  }, [])

  const handleScroll = useCallback(() => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current)

    rafId.current = requestAnimationFrame(() => {
      if (!titleIds.length) return

      const sections = getSectionsByIds(titleIds)
      if (!sections.length) return

      const newActiveId = findActiveSection(sections)

      const introductionElement = introductionElementRef.current
      const isAtTop = window.scrollY === 0

      const threshold = getOptimalThreshold()
      const isAtIntroduction =
        introductionElement &&
        (() => {
          const rect = introductionElement.getBoundingClientRect()
          return rect.top <= threshold && rect.bottom >= threshold
        })()

      setActiveId(isAtTop || isAtIntroduction ? '' : newActiveId)

      const hash = window.location.hash
      if (hash) {
        const element = document.querySelector(hash)
        if (!element) {
          history.replaceState(null, '', ' ')
          return
        }

        const rect = element.getBoundingClientRect()
        const isOffscreen = rect.bottom < 0 || rect.top > window.innerHeight
        if (isOffscreen) history.replaceState(null, '', ' ')
      }
    })
  }, [getOptimalThreshold, titleIds])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [handleScroll])

  return (
    <aside
      id="Character List"
      className="hidden md:top-52 md:left-[calc(50%+22rem)] md:h-screen md:w-full md:max-w-50 lg:fixed lg:block"
    >
      <nav className="sticky top-4 ml-8">
        <ul className="space-y-2">
          {navItems.map(({ displayName, sectionId, sectionHash, titleId }) => {
            const isActive = activeId === titleId

            return (
              <li
                key={sectionId}
                className="relative pl-4 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
              >
                <div
                  className={`absolute top-1/2 left-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gray-400 transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                  }`}
                />
                <a
                  href={sectionHash}
                  className="font-mono text-sm no-underline transition-colors duration-200"
                >
                  {displayName}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

export default CharacterList
