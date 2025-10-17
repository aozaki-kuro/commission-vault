'use client'

import { Disclosure, Transition } from '@headlessui/react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import type { CharacterRow, CommissionRow } from '#lib/admin/db'

import CommissionEditForm from './CommissionEditForm'

interface CommissionManagerProps {
  characters: CharacterRow[]
  commissions: CommissionRow[]
}

const disclosureStorageKey = 'admin-existing-open'

const CommissionManager = ({ characters, commissions }: CommissionManagerProps) => {
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters],
  )

  const initialMap = useMemo(() => {
    const grouped = new Map<number, CommissionRow[]>()
    sortedCharacters.forEach(character => grouped.set(character.id, []))
    commissions.forEach(commission => {
      const list = grouped.get(commission.characterId)
      if (list) list.push(commission)
    })
    return grouped
  }, [sortedCharacters, commissions])

  const [commissionMap, setCommissionMap] = useState(initialMap)

  useEffect(() => {
    setCommissionMap(initialMap)
  }, [initialMap])

  const [openId, setOpenId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem(disclosureStorageKey)
    const parsed = stored ? Number(stored) : NaN
    return Number.isFinite(parsed) ? parsed : null
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (openId === null) window.localStorage.removeItem(disclosureStorageKey)
      else window.localStorage.setItem(disclosureStorageKey, String(openId))
    }
  }, [openId])

  const handleDelete = useCallback((characterId: number, commissionId: number) => {
    setCommissionMap(prev => {
      const next = new Map(prev)
      const list = next.get(characterId) ?? []
      next.set(
        characterId,
        list.filter(item => item.id !== commissionId),
      )
      return next
    })
  }, [])

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Existing commissions
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Review, edit, or delete entries per character. Changes apply immediately.
        </p>
      </header>

      <div className="space-y-4">
        {sortedCharacters.map(character => {
          const characterCommissions = commissionMap.get(character.id) ?? []
          const isOpen = openId === character.id

          return (
            <Disclosure key={`${character.id}-${isOpen ? 'open' : 'closed'}`} defaultOpen={isOpen}>
              {({ open }) => (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm ring-1 ring-gray-900/5 dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10">
                  <Disclosure.Button
                    onClick={() =>
                      setOpenId(prev => (prev === character.id && open ? null : character.id))
                    }
                    className="flex w-full items-center justify-between bg-white/90 px-5 py-3 text-left text-base font-semibold text-gray-800 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:bg-gray-900/40 dark:text-gray-100 dark:hover:bg-gray-800/60 dark:focus-visible:ring-offset-gray-900"
                  >
                    <span>{character.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-300">
                      {characterCommissions.length} entries
                    </span>
                  </Disclosure.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-150"
                    enterFrom="transform opacity-0 -translate-y-1"
                    enterTo="transform opacity-100 translate-y-0"
                    leave="transition ease-in duration-100"
                    leaveFrom="transform opacity-100 translate-y-0"
                    leaveTo="transform opacity-0 -translate-y-1"
                  >
                    <Disclosure.Panel className="space-y-4 border-t border-gray-200 bg-white/85 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30">
                      {characterCommissions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-300">
                          No commissions recorded yet.
                        </p>
                      ) : (
                        characterCommissions.map(commission => (
                          <CommissionEditForm
                            key={commission.id}
                            commission={commission}
                            characters={sortedCharacters}
                            onDelete={() => handleDelete(character.id, commission.id)}
                          />
                        ))
                      )}
                    </Disclosure.Panel>
                  </Transition>
                </div>
              )}
            </Disclosure>
          )
        })}
      </div>
    </section>
  )
}

export default CommissionManager
