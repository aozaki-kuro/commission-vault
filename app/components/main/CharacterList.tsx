'use client'
import { kebabCase } from '#lib/strings'
import { getAllCharacters } from '#lib/characters'
import { getSections, findActiveSection } from '#lib/visibility'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'

const CharacterList = () => {
  const allCharacters = useMemo(() => getAllCharacters(), [])
  const [activeId, setActiveId] = useState<string>('')
  const rafId = useRef<number | null>(null)
  const introductionElementRef = useRef<HTMLElement | null>(null)

  // 缓存 DOM 查询
  useEffect(() => {
    introductionElementRef.current = document.getElementById('title-introduction')
  }, [])

  // 计算最佳阈值：桌面端25%，移动端20%，最小80px（考虑导航栏）
  const getOptimalThreshold = useCallback(() => {
    const isMobile = window.innerWidth < 768
    const viewportRatio = isMobile ? 0.2 : 0.25
    const calculatedThreshold = window.innerHeight * viewportRatio
    const minThreshold = 80 // 考虑导航栏高度

    return Math.max(minThreshold, calculatedThreshold)
  }, [])

  const handleScroll = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
    }

    rafId.current = requestAnimationFrame(() => {
      const sections = getSections(allCharacters)
      const newActiveId = findActiveSection(sections)

      const introductionElement = introductionElementRef.current
      const isAtTop = window.scrollY === 0

      // 使用优化后的阈值
      const threshold = getOptimalThreshold()
      const isAtIntroduction =
        introductionElement &&
        (() => {
          const rect = introductionElement.getBoundingClientRect()
          return rect.top <= threshold && rect.bottom >= threshold
        })()

      setActiveId(isAtTop || isAtIntroduction ? '' : newActiveId)

      // 优化 hash 处理
      const hash = window.location.hash
      if (hash) {
        const element = document.querySelector(hash)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.bottom < 0 || rect.top > window.innerHeight) {
            history.replaceState(null, '', ' ')
          }
        }
      }
    })
  }, [allCharacters, getOptimalThreshold])

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

  // 预计算字符数据
  const characterItems = useMemo(
    () =>
      allCharacters.map(character => ({
        id: kebabCase(character.DisplayName),
        displayName: character.DisplayName,
      })),
    [allCharacters],
  )

  return (
    <aside
      id="Character List"
      className="hidden md:top-52 md:left-[calc(50%+22rem)] md:h-screen md:w-full md:max-w-50 lg:fixed lg:block"
    >
      <nav className="sticky top-4 ml-8">
        <ul className="space-y-2">
          {characterItems.map(({ id, displayName }) => {
            const isActive = activeId === `title-${id}`

            return (
              <li
                key={id}
                className="relative pl-4 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
              >
                <div
                  className={`absolute top-1/2 left-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gray-400 transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                  }`}
                />
                <a
                  href={`#${id}`}
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
