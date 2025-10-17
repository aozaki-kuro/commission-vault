'use client'

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useEffect, useState } from 'react'

import type { CharacterRow, CommissionRow } from '#lib/admin/db'

import AddCharacterForm from './AddCharacterForm'
import AddCommissionForm from './AddCommissionForm'
import CharacterManager from './CharacterManager'
import CommissionManager from './CommissionManager'

interface AdminDashboardProps {
  characters: CharacterRow[]
  commissions: CommissionRow[]
}

const tabs = ['Create', 'Manage', 'Existing'] as const
const tabStorageKey = 'admin-dashboard-tab-index'

const AdminDashboard = ({ characters, commissions }: AdminDashboardProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(tabStorageKey)
    if (stored !== null) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < tabs.length) {
        setSelectedIndex(parsed)
      }
    }
  }, [])

  const handleChange = (index: number) => {
    setSelectedIndex(index)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tabStorageKey, String(index))
    }
  }

  const characterOptions = characters.map(character => ({
    id: character.id,
    name: character.name,
    status: character.status,
    sortOrder: character.sortOrder,
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

      <TabGroup selectedIndex={selectedIndex} onChange={handleChange}>
        <TabList className="flex gap-2 rounded-xl border border-gray-200 bg-white/80 p-1 text-sm font-medium shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/60">
          {tabs.map(tab => (
            <Tab
              key={tab}
              className={({ selected }) =>
                `flex-1 rounded-lg px-4 py-2.5 text-center transition focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:focus-visible:ring-offset-gray-900 ${
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
          <TabPanel>
            <div className="space-y-4">
              <AddCharacterForm />
              <AddCommissionForm characters={characterOptions} />
            </div>
          </TabPanel>

          <TabPanel className="space-y-6">
            <CharacterManager characters={characters} />
          </TabPanel>

          <TabPanel>
            <CommissionManager characters={characters} commissions={commissions} />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  )
}

export default AdminDashboard
