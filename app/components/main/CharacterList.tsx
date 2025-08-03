'use client'
import { kebabCase } from '#lib/strings'
import { getAllCharacters } from '#lib/characters'
import { getSections, findActiveSection } from '#lib/visibility'
import { useEffect, useMemo, useRef, useState } from 'react'

const CharacterList = () => {
  const allCharacters = useMemo(() => getAllCharacters(), [])
  const [activeId, setActiveId] = useState<string>('')

  // 使用 useRef 来存储 rafId，避免在每次渲染时重新创建
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }

      rafId.current = requestAnimationFrame(() => {
        const sections = getSections(allCharacters)
        const newActiveId = findActiveSection(sections)

        const introductionElement = document.getElementById('title-introduction')
        const isAtTop = window.scrollY === 0
        const isAtIntroduction =
          introductionElement &&
          introductionElement.getBoundingClientRect().top <= window.innerHeight / 2 &&
          introductionElement.getBoundingClientRect().bottom >= window.innerHeight / 2

        if (isAtTop || isAtIntroduction) {
          setActiveId('')
        } else {
          setActiveId(newActiveId)
        }

        if (window.location.hash) {
          const element = document.querySelector(window.location.hash)
          if (element) {
            const rect = element.getBoundingClientRect()
            // 如果元素不在当前视口内，则清空哈希
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
              history.replaceState(null, '', ' ')
            }
          }
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [allCharacters])

  return (
    <aside
      id="Character List"
      className="hidden md:fixed md:top-52 md:left-[calc(50%+20rem)] md:block md:h-screen md:w-full md:max-w-[15rem]"
    >
      <nav className="sticky top-4 ml-8">
        <ul className="space-y-2">
          {allCharacters.map(character => {
            const id = kebabCase(character.DisplayName)
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
                  {character.DisplayName}
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
