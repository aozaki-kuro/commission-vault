'use client'

import { kebabCase } from '#lib/strings'
import { characterStatus } from '#data/commissionStatus'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────── 预计算静态数据 ───────────────────
const ACTIVE_CHARACTERS = characterStatus.active
const STALE_CHARACTERS = characterStatus.stale

// 预计算 href 映射
const CHARACTER_HREF_MAP = new Map([
  ...ACTIVE_CHARACTERS.map(
    char => [char.DisplayName, `/#title-${kebabCase(char.DisplayName)}`] as const,
  ),
  ...STALE_CHARACTERS.map(
    char => [char.DisplayName, `/#title-${kebabCase(char.DisplayName)}`] as const,
  ),
])

// ─────────────────── 样式常量 ───────────────────
const STYLES = {
  menuButton:
    'relative z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-[12px] transition-all duration-300 hover:bg-gray-100/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] focus:outline-hidden dark:bg-black/80 dark:text-white dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:ring-white/10 dark:hover:bg-gray-900/80 dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
  listItem:
    'group flex w-full items-center rounded-lg px-4 py-2 font-mono text-base text-gray-900 !no-underline transition-colors duration-150 hover:bg-white/70 dark:text-white dark:hover:bg-white/10',
  toggleButton:
    'mt-2 flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2 font-mono transition-colors duration-150 hover:bg-white/70 dark:hover:bg-white/10',
  backdrop: 'blur(12px)',
} as const

// ─────────────────── 接口定义 ───────────────────
interface Character {
  DisplayName: string
}

// MenuIcon 组件
const MenuIcon = memo(({ isOpen }: { isOpen: boolean }) => (
  <svg
    className="h-5 w-5 transform transition-transform duration-300"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
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

// ChevronIcon 组件
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

// ListItem 组件
interface ListItemProps {
  character: Character
  isActive?: boolean
  close: () => void
}

const ListItem = memo(({ character, isActive, close }: ListItemProps) => {
  const router = useRouter()
  const href =
    CHARACTER_HREF_MAP.get(character.DisplayName) || `/#title-${kebabCase(character.DisplayName)}`

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

// 优化的 MenuItem 组件
const OptimizedMenuItem = memo(
  ({ character, close }: { character: Character; close: () => void }) => (
    <MenuItem key={character.DisplayName} as={Fragment}>
      {({ active }: { active: boolean }) => (
        <ListItem character={character} isActive={active} close={close} />
      )}
    </MenuItem>
  ),
)
OptimizedMenuItem.displayName = 'OptimizedMenuItem'

// CharacterList 组件
interface CharacterListProps {
  close: () => void
}

const CharacterList = memo(({ close }: CharacterListProps) => {
  const [isStaleExpanded, setIsStaleExpanded] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const activeListRef = useRef<HTMLDivElement>(null)
  const staleListRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 👇 getListHeight 改为接受 MutableRef，允许 null ── modified
  const getListHeight = useCallback((listRef: React.MutableRefObject<HTMLDivElement | null>) => {
    return listRef.current?.scrollHeight ?? 0
  }, [])

  // 更新容器高度
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

  // 监听列表尺寸变化
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

  // 切换列表
  const toggleStaleList = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setIsStaleExpanded(prev => !prev)
    setTimeout(() => setIsAnimating(false), 300) // 匹配 CSS 动画时长
  }, [isAnimating])

  // 预渲染列表项
  const activeItems = ACTIVE_CHARACTERS.map(character => (
    <OptimizedMenuItem key={character.DisplayName} character={character} close={close} />
  ))
  const staleItems = STALE_CHARACTERS.map(character => (
    <OptimizedMenuItem key={character.DisplayName} character={character} close={close} />
  ))

  // 计算动画 class
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

  const transitionClasses = isInitialRender ? '' : 'transition-all duration-300 ease-out'

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`relative overflow-hidden will-change-[height] ${
          isInitialRender ? '' : 'transition-[height] duration-300 ease-out'
        }`}
      >
        {/* Active list */}
        <div
          ref={activeListRef}
          className={`absolute inset-x-0 w-full will-change-transform ${transitionClasses} ${getListTransform(
            false,
          )} ${getListOpacity(false)}`}
        >
          {activeItems}
        </div>

        {/* Stale list */}
        <div
          ref={staleListRef}
          className={`absolute inset-x-0 w-full will-change-transform ${transitionClasses} ${getListTransform(
            true,
          )} ${getListOpacity(true)}`}
        >
          {staleItems}
        </div>
      </div>

      <button
        onClick={toggleStaleList}
        className={STYLES.toggleButton}
        type="button"
        disabled={isAnimating}
      >
        <p className="font-bold text-gray-600 dark:text-gray-300">Stale Characters</p>
        <ChevronIcon isExpanded={isStaleExpanded} />
      </button>
    </div>
  )
})
CharacterList.displayName = 'CharacterList'

// MenuContent 组件
const MenuContent = memo(({ open, close }: { open: boolean; close: () => void }) => {
  useEffect(() => {
    const html = document.documentElement
    if (open) {
      html.classList.add('overflow-hidden', 'touch-none')
    } else {
      html.classList.remove('overflow-hidden', 'touch-none')
    }
    return () => html.classList.remove('overflow-hidden', 'touch-none')
  }, [open])

  const backdropStyle = {
    WebkitBackdropFilter: STYLES.backdrop,
    backdropFilter: STYLES.backdrop,
  } as const

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-gray-200/10 backdrop-blur-xs dark:bg-gray-900/10" />
      )}

      <MenuButton className={STYLES.menuButton} style={backdropStyle}>
        <span className="sr-only">Open navigation menu</span>
        <MenuIcon isOpen={open} />
      </MenuButton>

      <Transition
        as={Fragment}
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <MenuItems
          className="absolute right-4 bottom-full z-40 mb-4 max-h-[calc(100vh-8rem)] w-64 origin-bottom-right overflow-y-auto rounded-xl border border-white/20 bg-white/80 font-mono shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-lg focus:outline-hidden dark:bg-black/80"
          style={backdropStyle}
        >
          <div className="border-b border-gray-300/50 p-4 dark:border-white/10">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Characters</h2>
          </div>
          <div className="p-2">
            <CharacterList close={close} />
          </div>
        </MenuItems>
      </Transition>
    </>
  )
})
MenuContent.displayName = 'MenuContent'

// Hamburger 组件
const Hamburger = () => (
  <Menu as="div" className="fixed right-8 bottom-8 block md:hidden">
    {({ open, close }) => <MenuContent open={open} close={close} />}
  </Menu>
)

export default Hamburger
