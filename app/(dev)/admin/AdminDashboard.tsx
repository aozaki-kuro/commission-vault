'use client'

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useCallback, useSyncExternalStore } from 'react'
import type { CharacterRow, CommissionRow } from '#lib/admin/db'
import Link from 'next/link'
import AddCharacterForm from './AddCharacterForm'
import AddCommissionForm from './AddCommissionForm'
import CommissionManager from './CommissionManager'

interface AdminDashboardProps {
  characters: CharacterRow[]
  commissions: CommissionRow[]
}

const tabs = ['Create', 'Existing'] as const
const tabStorageKey = 'admin-dashboard-tab-index'

// ---- 小型 localStorage store（客户端）----
const LOCAL_EVENT = 'localstorage:' + tabStorageKey

function readTabIndex(): number {
  const raw = typeof window !== 'undefined' ? window.localStorage.getItem(tabStorageKey) : null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n < tabs.length ? n : 0
}

function useStoredTabIndex() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    // 1) 其他标签页改动：原生 storage 事件
    const onStorage = (e: StorageEvent) => {
      if (e.key === tabStorageKey) onStoreChange()
    }
    // 2) 本标签页改动：自定义事件
    const onLocal = () => onStoreChange()

    window.addEventListener('storage', onStorage)
    window.addEventListener(LOCAL_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(LOCAL_EVENT, onLocal)
    }
  }, [])

  const getSnapshot = useCallback(() => readTabIndex(), [])
  const getServerSnapshot = useCallback(() => 0, [])

  // 关键：hydration 期间使用 server snapshot(0)，结束后再切客户端值
  const index = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const set = useCallback((next: number) => {
    // 写 localStorage
    window.localStorage.setItem(tabStorageKey, String(next))
    // 通知本标签页的订阅者刷新（storage 事件只在跨标签页触发）
    window.dispatchEvent(new Event(LOCAL_EVENT))
  }, [])

  return [index, set] as const
}

const AdminDashboard = ({ characters, commissions }: AdminDashboardProps) => {
  const [selectedIndex, setSelectedIndex] = useStoredTabIndex()

  const characterOptions = characters.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    sortOrder: c.sortOrder,
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-10 lg:px-0">
      <header className="space-y-2">
        <h1 className="text-2xl leading-tight font-semibold text-gray-900 dark:text-gray-100">
          Commission Vault Admin
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Create new entries, reprioritize characters, and curate the commission archive.
        </p>
      </header>

      <div className="flex justify-end">
        <Link href="/">Home</Link>
      </div>

      <TabGroup selectedIndex={selectedIndex} onChange={setSelectedIndex}>
        <TabList className="flex gap-2 rounded-xl border border-gray-200 bg-white/80 p-1 text-sm font-medium shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/60">
          {tabs.map(tab => (
            <Tab
              key={tab}
              className={({ selected }) =>
                `flex-1 rounded-lg px-4 py-2.5 text-center transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:focus-visible:ring-offset-gray-900 ${
                  selected
                    ? 'bg-gray-900 text-white shadow-sm dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60'
                }`
              }
            >
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="mt-6 space-y-8">
          <TabPanel className="animate-[tabFade_260ms_ease-out] focus:outline-none">
            <div className="space-y-4">
              <AddCharacterForm />
              <AddCommissionForm characters={characterOptions} />
            </div>
          </TabPanel>

          <TabPanel className="animate-[tabFade_260ms_ease-out] focus:outline-none">
            <CommissionManager characters={characters} commissions={commissions} />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  )
}

export default AdminDashboard
