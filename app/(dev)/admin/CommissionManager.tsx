'use client'

import { Disclosure, DisclosureButton, DisclosurePanel, Transition } from '@headlessui/react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
    sortedCharacters.forEach(c => grouped.set(c.id, []))
    commissions.forEach(cm => {
      const list = grouped.get(cm.characterId)
      if (list) list.push(cm)
    })
    return grouped
  }, [sortedCharacters, commissions])

  const [commissionMap, setCommissionMap] = useState(initialMap)

  const [openId, setOpenId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem(disclosureStorageKey)
    const parsed = stored ? Number(stored) : NaN
    return Number.isFinite(parsed) ? parsed : null
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (openId === null) window.localStorage.removeItem(disclosureStorageKey)
    else window.localStorage.setItem(disclosureStorageKey, String(openId))
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

  // ✅ 集中管理每个角色按钮的 ref
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({})

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
          const characterCommissions = [...(commissionMap.get(character.id) ?? [])].sort((a, b) =>
            b.fileName.localeCompare(a.fileName),
          )

          const isOpenInitially = openId === character.id

          return (
            <Disclosure key={character.id} defaultOpen={isOpenInitially}>
              {({ open }) => (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm ring-1 ring-gray-900/5 dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10">
                  <DisclosureButton
                    ref={el => {
                      buttonRefs.current[character.id] = el
                    }}
                    onClick={() => {
                      setOpenId(prev => (prev === character.id && open ? null : character.id))
                      // ✅ 点击时滚动到按钮位置，保持展开方向向下
                      queueMicrotask(() => {
                        buttonRefs.current[character.id]?.scrollIntoView({
                          block: 'nearest',
                          inline: 'nearest',
                        })
                      })
                    }}
                    className="flex w-full items-center justify-between bg-white/90 px-5 py-3 text-left text-base font-semibold text-gray-800 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none dark:bg-gray-900/40 dark:text-gray-100 dark:hover:bg-gray-800/60 dark:focus-visible:ring-offset-gray-900"
                  >
                    <span className="font-semibold">{character.name}</span>
                    <span className="font-mono text-xs font-normal text-gray-500 dark:text-gray-300">
                      {characterCommissions.length} entries
                    </span>
                  </DisclosureButton>

                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-150"
                    enterFrom="opacity-0 -translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in-out duration-150"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 -translate-y-1"
                  >
                    <DisclosurePanel
                      static
                      className="space-y-4 border-t border-gray-200 bg-white/85 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30"
                    >
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
                    </DisclosurePanel>
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
