import type { CharacterAliasRow, CreatorAliasRow, KeywordAliasRow } from '@commission-index/domain'
import type { AliasRow } from './AliasPanel'
import { hasCjkCharacter } from '@commission-index/domain'
import { useCallback, useMemo, useState } from 'react'
import {
  saveCharacterAliasesBatchAction,
  saveCreatorAliasesBatchAction,
  saveKeywordAliasesBatchAction,
} from '../lib/adminActions'
import { AliasPanel } from './AliasPanel'

interface AdminAliasesDashboardProps {
  characters: CharacterAliasRow[]
  creators: CreatorAliasRow[]
  keywords: KeywordAliasRow[]
}

type AliasTab = 'character' | 'creator' | 'keyword'

const tabListStyles
  = 'grid w-full grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-white/90 p-1.5 shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'
const tabTriggerStyles
  = 'inline-flex items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm text-gray-700 transition focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none hover:border-gray-300/80 hover:bg-white dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800/70 dark:focus-visible:ring-offset-gray-900'
const activeTabTriggerStyles
  = 'border-gray-900/15 bg-white text-gray-900 shadow-sm dark:border-gray-100/20 dark:bg-gray-100 dark:text-gray-900'
const tabCountStyles
  = 'hidden min-w-7 items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 sm:inline-flex dark:bg-gray-800 dark:text-gray-200'

function toCharacterAliasRows(characters: CharacterAliasRow[]): AliasRow[] {
  return characters.map(row => ({
    key: row.characterName,
    count: row.commissionCount,
    initialValue: row.aliases.join(', '),
  }))
}

function toCreatorAliasRows(creators: CreatorAliasRow[]): AliasRow[] {
  return creators
    .filter(row => hasCjkCharacter(row.creatorName))
    .map(row => ({
      key: row.creatorName,
      count: row.commissionCount,
      initialValue: row.aliases[0] ?? '',
    }))
}

function toKeywordAliasRows(keywords: KeywordAliasRow[]): AliasRow[] {
  return keywords.map(row => ({
    key: row.baseKeyword,
    count: row.commissionCount,
    initialValue: row.aliases.join(', '),
  }))
}

function buildCharacterPayload(rows: AliasRow[], drafts: Record<string, string>) {
  return JSON.stringify(rows.map(row => ({
    characterName: row.key,
    aliases: drafts[row.key] ?? '',
  })))
}

function buildCreatorPayload(rows: AliasRow[], drafts: Record<string, string>) {
  return JSON.stringify(rows.map(row => ({
    creatorName: row.key,
    alias: (drafts[row.key] ?? '').trim(),
  })))
}

function buildKeywordPayload(rows: AliasRow[], drafts: Record<string, string>) {
  return JSON.stringify(rows.map(row => ({
    baseKeyword: row.key,
    aliases: drafts[row.key] ?? '',
  })))
}

interface TabButtonProps {
  activeTab: AliasTab
  count: number
  label: string
  onSelect: (tab: AliasTab) => void
  tab: AliasTab
}

function TabButton({ activeTab, count, label, onSelect, tab }: TabButtonProps) {
  const isActive = activeTab === tab

  return (
    <button
      id={`aliases-tab-${tab}`}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`aliases-panel-${tab}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onSelect(tab)}
      className={`
        ${tabTriggerStyles}
        ${isActive ? activeTabTriggerStyles : ''}
      `}
    >
      <span>{label}</span>
      <span className={tabCountStyles}>{count}</span>
    </button>
  )
}

export function AdminAliasesDashboard({
  characters,
  creators,
  keywords,
}: AdminAliasesDashboardProps) {
  const [activeTab, setActiveTab] = useState<AliasTab>('character')

  const characterRows = useMemo(() => toCharacterAliasRows(characters), [characters])
  const creatorRows = useMemo(() => toCreatorAliasRows(creators), [creators])
  const keywordRows = useMemo(() => toKeywordAliasRows(keywords), [keywords])

  // Stable references — these pure functions never change
  const buildCharacter = useCallback(buildCharacterPayload, [])
  const buildCreator = useCallback(buildCreatorPayload, [])
  const buildKeyword = useCallback(buildKeywordPayload, [])

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="
          text-lg font-semibold text-gray-900
          dark:text-gray-100
        "
        >
          Alias mapping
        </h2>
        <p className="
          text-sm text-gray-600
          dark:text-gray-300
        "
        >
          Keep search synonyms consistent across character, creator, and keyword dimensions.
        </p>
      </header>

      <div role="tablist" aria-label="Alias mapping sections" className={tabListStyles}>
        <TabButton
          activeTab={activeTab}
          count={characterRows.length}
          label="Character"
          onSelect={setActiveTab}
          tab="character"
        />
        <TabButton
          activeTab={activeTab}
          count={creatorRows.length}
          label="Creator"
          onSelect={setActiveTab}
          tab="creator"
        />
        <TabButton
          activeTab={activeTab}
          count={keywordRows.length}
          label="Keyword"
          onSelect={setActiveTab}
          tab="keyword"
        />
      </div>

      <div className="mt-5 space-y-6">
        {activeTab === 'character' && (
          <div
            key="character"
            id="aliases-panel-character"
            role="tabpanel"
            aria-labelledby="aliases-tab-character"
            className="motion-safe:animate-[tabFade_200ms_ease-out]"
          >
            <AliasPanel
              rows={characterRows}
              formAction={saveCharacterAliasesBatchAction}
              title="Character aliases"
              description="Character aliases have top priority over creator and keyword aliases for duplicate terms."
              saveLabel="Save character aliases"
              errorFallback="Unable to save character aliases."
              emptyMessage="No characters available."
              columnHeader="Character"
              placeholder="e.g. 七市, ななし"
              buildPayload={buildCharacter}
            />
          </div>
        )}

        {activeTab === 'creator' && (
          <div
            key="creator"
            id="aliases-panel-creator"
            role="tabpanel"
            aria-labelledby="aliases-tab-creator"
            className="motion-safe:animate-[tabFade_200ms_ease-out]"
          >
            <AliasPanel
              rows={creatorRows}
              formAction={saveCreatorAliasesBatchAction}
              title="Creator aliases"
              description="Edit romanized aliases for creators with CJK names to stabilize search matching."
              saveLabel="Save creator aliases"
              errorFallback="Unable to save creator aliases."
              emptyMessage="No creators available for alias editing."
              columnHeader="Creator"
              buildPayload={buildCreator}
            />
          </div>
        )}

        {activeTab === 'keyword' && (
          <div
            key="keyword"
            id="aliases-panel-keyword"
            role="tabpanel"
            aria-labelledby="aliases-tab-keyword"
            className="motion-safe:animate-[tabFade_200ms_ease-out]"
          >
            <AliasPanel
              rows={keywordRows}
              formAction={saveKeywordAliasesBatchAction}
              title="Keyword aliases"
              description="Keywords duplicated in character or creator aliases are hidden here to avoid mapping conflicts."
              saveLabel="Save keyword aliases"
              errorFallback="Unable to save keyword aliases."
              emptyMessage="No keywords available yet. Add keywords to commissions first."
              columnHeader="Base keyword"
              placeholder="e.g. 七市, ななし"
              buildPayload={buildKeyword}
            />
          </div>
        )}
      </div>
    </section>
  )
}
