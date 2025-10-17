'use client'

import { kebabCase } from '#lib/strings'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface CharacterEntry {
  DisplayName: string
}

const STYLES = {
  menuButton:
    'relative z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-[12px] transition-all duration-300 hover:bg-gray-100/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] focus:outline-hidden dark:bg-black/80 dark:text-white dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:ring-white/10 dark:hover:bg-gray-900/80 dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
  listItem:
    'group flex w-full items-center rounded-lg px-4 py-2 font-mono text-base text-gray-900 !no-underline transition-colors duration-150 hover:bg-white/70 dark:text-white dark:hover:bg-white/10',
  toggleButton:
    'mt-2 flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2 font-mono transition-colors duration-150 hover:bg-white/70 dark:hover:bg-white/10',
  backdrop: 'blur(12px)',
} as const

const MenuIcon = memo(({ isOpen }: { isOpen: boolean }) => (
  <svg
    className="h-6 w-6 text-gray-900 dark:text-white"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    aria-hidden="true"
  >
    {isOpen ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    )}
  </svg>
))
MenuIcon.displayName = 'MenuIcon'

const ChevronIcon = memo(({ isExpanded }: { isExpanded: boolean }) => (
  <svg
    className={`h-4 w-4 text-gray-600 transition-transform duration-200 dark:text-gray-300 ${
      isExpanded ? 'rotate-180' : ''
    }`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
))
ChevronIcon.displayName = 'ChevronIcon'

interface ListItemProps {
  character: CharacterEntry
  href: string
  isActive?: boolean
  close: () => void
}

const ListItem = memo(({ character, href, isActive, close }: ListItemProps) => {
  const router = useRouter()

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      close()
      router.push(href)
    },
    [href, close, router],
  )

  return (
    <Link
      href={href}
      onClick={handleClick}
      prefetch
      className={`${isActive ? 'bg-white/70 dark:bg-white/10' : ''} ${STYLES.listItem}`}
    >
      {character.DisplayName}
    </Link>
  )
})
ListItem.displayName = 'ListItem'

const OptimizedMenuItem = memo(
  ({ character, href, close }: { character: CharacterEntry; href: string; close: () => void }) => (
    <MenuItem key={character.DisplayName} as={Fragment}>
      {({ active }: { active: boolean }) => (
        <ListItem character={character} href={href} isActive={active} close={close} />
      )}
    </MenuItem>
  ),
)
OptimizedMenuItem.displayName = 'OptimizedMenuItem'

interface CharacterListProps {
  active: CharacterEntry[]
  stale: CharacterEntry[]
  close: () => void
}

const CharacterList = memo(({ active, stale, close }: CharacterListProps) => {
  const [isStaleExpanded, setIsStaleExpanded] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const activeListRef = useRef<HTMLDivElement>(null)
  const staleListRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getListHeight = useCallback((listRef: React.MutableRefObject<HTMLDivElement | null>) => {
    return listRef.current?.scrollHeight ?? 0
  }, [])

  const updateContainerHeight = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const activeHeight = getListHeight(activeListRef)
    const staleHeight = getListHeight(staleListRef)
    const targetHeight = isStaleExpanded ? staleHeight : activeHeight

    if (isInitialRender) {
      container.style.height = `${targetHeight}px`
      setIsInitialRender(false)
    } else {
      requestAnimationFrame(() => {
        container.style.height = `${targetHeight}px`
      })
    }
  }, [isStaleExpanded, isInitialRender, getListHeight])

  useEffect(() => {
    const activeList = activeListRef.current
    const staleList = staleListRef.current
    if (!activeList || !staleList) return

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateContainerHeight)
    })

    resizeObserver.observe(activeList)
    resizeObserver.observe(staleList)
    updateContainerHeight()

    return () => resizeObserver.disconnect()
  }, [updateContainerHeight])

  const toggleStaleList = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setIsStaleExpanded(prev => !prev)
    setTimeout(() => setIsAnimating(false), 300)
  }, [isAnimating])

  const hrefMap = useMemo(() => {
    return new Map(
      [...active, ...stale].map(
        character =>
          [character.DisplayName, `/#title-${kebabCase(character.DisplayName)}`] as const,
      ),
    )
  }, [active, stale])

  const activeItems = useMemo(
    () =>
      active.map(character => (
        <OptimizedMenuItem
          key={character.DisplayName}
          character={character}
          href={hrefMap.get(character.DisplayName) ?? `/#title-${kebabCase(character.DisplayName)}`}
          close={close}
        />
      )),
    [active, close, hrefMap],
  )

  const staleItems = useMemo(
    () =>
      stale.map(character => (
        <OptimizedMenuItem
          key={character.DisplayName}
          character={character}
          href={hrefMap.get(character.DisplayName) ?? `/#title-${kebabCase(character.DisplayName)}`}
          close={close}
        />
      )),
    [stale, close, hrefMap],
  )

  const getListTransform = (isStaleList: boolean) => {
    if (isInitialRender) return isStaleList ? 'translate-y-full' : 'translate-y-0'
    if (isStaleExpanded) return isStaleList ? 'translate-y-0' : '-translate-y-full'
    return isStaleList ? 'translate-y-full' : 'translate-y-0'
  }

  const getListOpacity = (isStaleList: boolean) => {
    if (isInitialRender) return isStaleList ? 'opacity-0' : 'opacity-100'
    if (isAnimating) return 'opacity-100'
    return isStaleExpanded
      ? isStaleList
        ? 'opacity-100'
        : 'opacity-0'
      : isStaleList
        ? 'opacity-0'
        : 'opacity-100'
  }

  return (
    <div className="relative overflow-hidden">
      <div ref={containerRef} className="relative transition-all duration-300 ease-in-out">
        <div
          ref={activeListRef}
          className={`space-y-1 transition-transform duration-300 ease-in-out ${getListTransform(false)} ${getListOpacity(false)}`}
        >
          {activeItems}
        </div>
        <div
          ref={staleListRef}
          className={`pointer-events-none space-y-1 transition-transform duration-300 ease-in-out ${getListTransform(true)} ${getListOpacity(true)}`}
        >
          {staleItems}
        </div>
      </div>
      <button
        type="button"
        onClick={toggleStaleList}
        className={STYLES.toggleButton}
        disabled={isAnimating}
      >
        <span className="font-semibold text-gray-700 dark:text-gray-200">
          {isStaleExpanded ? 'Active' : 'Stale'} →
        </span>
        <ChevronIcon isExpanded={isStaleExpanded} />
      </button>
    </div>
  )
})
CharacterList.displayName = 'HamburgerCharacterList'

interface HamburgerProps {
  active: CharacterEntry[]
  stale: CharacterEntry[]
}

const Hamburger = ({ active, stale }: HamburgerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setIsMounted(true), 100)
    return () => clearTimeout(timeout)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  return (
    <Menu as="div" className="fixed right-6 bottom-6 z-40 flex items-center">
      <Transition
        show={isMounted}
        enter="transition duration-300 ease-out"
        enterFrom="opacity-0 translate-y-4"
        enterTo="opacity-100 translate-y-0"
        leave="transition duration-200 ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
      >
        <MenuButton
          onClick={() => setIsOpen(prev => !prev)}
          className={STYLES.menuButton}
          aria-label="Open character navigation"
        >
          <MenuIcon isOpen={isOpen} />
        </MenuButton>
      </Transition>

      <Transition
        show={isOpen}
        enter="transition duration-200 ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition duration-150 ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
      >
        <MenuItems
          static
          className="absolute right-0 bottom-14 w-64 origin-bottom-right rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-[0_18px_36px_rgba(24,39,75,0.12)] backdrop-blur-[12px] focus:outline-hidden dark:border-white/10 dark:bg-black/80"
        >
          <CharacterList active={active} stale={stale} close={close} />
        </MenuItems>
      </Transition>
    </Menu>
  )
}

export default Hamburger
