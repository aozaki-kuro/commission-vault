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
    <TabGroup selectedIndex={selectedIndex} onChange={handleChange}>
      <TabList className="flex gap-3 rounded-lg border border-gray-200 bg-white p-1 text-sm font-medium dark:border-gray-700 dark:bg-gray-900/50">
        {tabs.map(tab => (
          <Tab
            key={tab}
            className={({ selected }) =>
              `flex-1 rounded-md px-3 py-2 text-center transition ${
                selected
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`
            }
          >
            {tab}
          </Tab>
        ))}
      </TabList>

      <TabPanels className="mt-4 space-y-6">
        <TabPanel>
          <div className="flex flex-col gap-4">
            <AddCharacterForm />
            <AddCommissionForm characters={characterOptions} />
          </div>
        </TabPanel>

        <TabPanel className="space-y-8">
          <CharacterManager characters={characters} />
        </TabPanel>

        <TabPanel>
          <CommissionManager characters={characters} commissions={commissions} />
        </TabPanel>
      </TabPanels>
    </TabGroup>
  )
}

export default AdminDashboard
