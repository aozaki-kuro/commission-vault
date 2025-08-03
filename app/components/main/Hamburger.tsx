'use client'

import { kebabCase } from '#lib/strings'
import { characterStatus } from '#data/commissionStatus'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react'

// 预计算静态数据
const ACTIVE_CHARACTERS = characterStatus.active
const STALE_CHARACTERS = characterStatus.stale

// 预计算 href 映射，避免运行时重复计算
const CHARACTER_HREF_MAP = new Map([
  ...ACTIVE_CHARACTERS.map(
    char => [char.DisplayName, `/#title-${kebabCase(char.DisplayName)}`] as const,
  ),
  ...STALE_CHARACTERS.map(
    char => [char.DisplayName, `/#title-${kebabCase(char.DisplayName)}`] as const,
  ),
])

// 样式常量
const STYLES = {
  menuButton:
    'relative z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-[12px] transition-all duration-300 hover:bg-gray-100/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] focus:outline-hidden dark:bg-black/80 dark:text-white dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:ring-white/10 dark:hover:bg-gray-900/80 dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
  listItem:
    'group flex w-full items-center rounded-lg px-4 py-2 font-mono text-base text-gray-900 !no-underline transition-colors duration-150 hover:bg-white/70 dark:text-white dark:hover:bg-white/10',
  toggleButton:
    'mt-2 flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2 font-mono transition-colors duration-150 hover:bg-white/70 dark:hover:bg-white/10',
  backdrop: 'blur(12px)',
} as const

// 防抖 hook
const useDebounce = (callback: () => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  return useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(callback, delay)
  }, [callback, delay])
}

// 定义 Character 接口，表示角色的基本信息
interface Character {
  DisplayName: string
}

// MenuIcon 组件，用于显示汉堡菜单的图标
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

// ChevronIcon 组件，用于显示展开/折叠的箭头图标
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

// ListItem 组件的 props 接口
interface ListItemProps {
  character: Character
  isActive?: boolean
  close: () => void
}

// ListItem 组件，用于显示单个角色项
const ListItem = memo(({ character, isActive, close }: ListItemProps) => {
  const router = useRouter()
  // 使用预计算的 href
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
      className={`${STYLES.listItem} ${isActive ? 'bg-white/70 dark:bg-white/10' : ''}`}
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

// CharacterList 组件的 props 接口
interface CharacterListProps {
  close: () => void
}

// CharacterList 组件，用于显示角色列表
const CharacterList = memo(({ close }: CharacterListProps) => {
  const [isStaleExpanded, setIsStaleExpanded] = useState(false)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const activeListRef = useRef<HTMLDivElement>(null)
  const staleListRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 优化的高度更新逻辑
  const updateContainerHeight = useCallback(() => {
    const activeList = activeListRef.current
    const staleList = staleListRef.current
    const container = containerRef.current

    if (!activeList || !staleList || !container) return

    const targetHeight = isStaleExpanded ? staleList.scrollHeight : activeList.scrollHeight

    if (isInitialRender) {
      container.style.height = `${targetHeight}px`
      setIsInitialRender(false)
    } else {
      // 使用 requestAnimationFrame 确保在下一帧更新
      requestAnimationFrame(() => {
        container.style.height = `${targetHeight}px`
      })
    }
  }, [isStaleExpanded, isInitialRender])

  // 防抖的高度更新
  const debouncedUpdateHeight = useDebounce(updateContainerHeight, 16) // ~60fps

  useEffect(() => {
    const activeList = activeListRef.current
    const staleList = staleListRef.current

    if (!activeList || !staleList) return

    const resizeObserver = new ResizeObserver(() => {
      debouncedUpdateHeight()
    })

    resizeObserver.observe(activeList)
    resizeObserver.observe(staleList)
    updateContainerHeight()

    return () => {
      resizeObserver.disconnect()
    }
  }, [updateContainerHeight, debouncedUpdateHeight])

  const toggleStaleList = useCallback(() => {
    setIsStaleExpanded(prev => !prev)
  }, [])

  // 使用预计算的数据和优化的渲染
  const activeItems = ACTIVE_CHARACTERS.map(character => (
    <OptimizedMenuItem key={character.DisplayName} character={character} close={close} />
  ))

  const staleItems = STALE_CHARACTERS.map(character => (
    <OptimizedMenuItem key={character.DisplayName} character={character} close={close} />
  ))

  // 计算过渡类名
  const transitionClass = isInitialRender ? '' : 'transition-transform duration-300 ease-out'
  const heightTransitionClass = isInitialRender ? '' : 'transition-[height] duration-300 ease-out'

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`relative overflow-hidden will-change-[height] ${heightTransitionClass}`}
      >
        {/* Active Characters 列表 */}
        <div
          ref={activeListRef}
          className={`absolute right-0 left-0 w-full will-change-transform ${transitionClass} ${
            isStaleExpanded ? '-translate-y-full' : 'translate-y-0'
          }`}
          style={{ visibility: isStaleExpanded ? 'hidden' : 'visible' }}
        >
          {activeItems}
        </div>

        {/* Stale Characters 列表 */}
        <div
          ref={staleListRef}
          className={`absolute right-0 left-0 w-full will-change-transform ${transitionClass} ${
            isStaleExpanded ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ visibility: isStaleExpanded ? 'visible' : 'hidden' }}
        >
          {staleItems}
        </div>
      </div>

      <button onClick={toggleStaleList} className={STYLES.toggleButton} type="button">
        <p className="font-bold text-gray-600 dark:text-gray-300">Stale Characters</p>
        <ChevronIcon isExpanded={isStaleExpanded} />
      </button>
    </div>
  )
})
CharacterList.displayName = 'CharacterList'

// MenuContent 组件，用于显示菜单内容
const MenuContent = memo(({ open, close }: { open: boolean; close: () => void }) => {
  useEffect(() => {
    const html = document.documentElement
    const classes = ['overflow-hidden', 'touch-none']

    if (open) {
      html.classList.add(...classes)
    } else {
      html.classList.remove(...classes)
    }

    return () => html.classList.remove(...classes)
  }, [open])

  const backdropStyle = {
    WebkitBackdropFilter: STYLES.backdrop,
    backdropFilter: STYLES.backdrop,
  }

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

// Hamburger 组件，用于显示汉堡菜单
const Hamburger = () => {
  return (
    <Menu as="div" className="fixed right-8 bottom-8 md:hidden">
      {({ open, close }) => <MenuContent open={open} close={close} />}
    </Menu>
  )
}

export default Hamburger
