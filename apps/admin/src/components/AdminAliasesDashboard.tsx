import type { CharacterAliasRow, CreatorAliasRow, KeywordAliasRow } from '@commission-index/domain'
import { hasCjkCharacter } from '@commission-index/domain'
import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { adminSurfaceStyles, formControlStyles } from '../app/ui'
import {
  saveCharacterAliasesBatchAction,
  saveCreatorAliasesBatchAction,
  saveKeywordAliasesBatchAction,
} from '../lib/adminActions'
import { INITIAL_FORM_STATE } from '../lib/formState'
import { FormStatusIndicator } from './FormStatusIndicator'

interface AdminAliasesDashboardProps {
  characters: CharacterAliasRow[]
  creators: CreatorAliasRow[]
  keywords: KeywordAliasRow[]
}

type AliasTab = 'character' | 'creator' | 'keyword'

function buildInitialCharacterDrafts(characters: CharacterAliasRow[]) {
  return Object.fromEntries(characters.map(row => [row.characterName, row.aliases.join(', ')])) as Record<
    string,
    string
  >
}

function buildInitialCreatorDrafts(creators: CreatorAliasRow[]) {
  return Object.fromEntries(creators.map(row => [row.creatorName, row.aliases[0] ?? ''])) as Record<
    string,
    string
  >
}

function buildInitialKeywordDrafts(keywords: KeywordAliasRow[]) {
  return Object.fromEntries(keywords.map(row => [row.baseKeyword, row.aliases.join(', ')])) as Record<
    string,
    string
  >
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="
        inline-flex h-9 items-center justify-center gap-2 rounded-md bg-gray-900
        px-3 text-sm font-medium whitespace-nowrap text-white transition
        hover:bg-gray-700
        focus-visible:ring-2 focus-visible:ring-gray-400
        focus-visible:ring-offset-2 focus-visible:ring-offset-white
        focus-visible:outline-none
        active:scale-[0.97]
        disabled:pointer-events-none disabled:opacity-50
        dark:bg-gray-100 dark:text-gray-900
        dark:hover:bg-gray-200
        dark:focus-visible:ring-offset-gray-900
      "
    >
      {pending ? 'Saving...' : label}
    </button>
  )
}

const tabListStyles
  = 'grid w-full grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-white/90 p-1.5 shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'
const tabTriggerStyles
  = 'inline-flex items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm text-gray-700 transition focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none hover:border-gray-300/80 hover:bg-white dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800/70 dark:focus-visible:ring-offset-gray-900'
const activeTabTriggerStyles
  = 'border-gray-900/15 bg-white text-gray-900 shadow-sm dark:border-gray-100/20 dark:bg-gray-100 dark:text-gray-900'
const tabCountStyles
  = 'hidden min-w-7 items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 sm:inline-flex dark:bg-gray-800 dark:text-gray-200'
const panelHeaderTitleStyles = 'text-base font-semibold text-gray-900 dark:text-gray-100'
const panelHeaderDescriptionStyles = 'text-sm text-gray-600 dark:text-gray-300'
const tableShellStyles = 'space-y-0'
const tableHeaderStyles
  = 'hidden gap-4 border-b border-gray-200/80 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase md:grid dark:border-gray-700/80 dark:text-gray-300'
const tableRowStyles = 'grid gap-4 px-4 py-3 md:items-center'
const tableDividerStyles = 'border-t border-gray-200/80 dark:border-gray-700/80'
const aliasGridTemplate = 'md:grid-cols-[minmax(10rem,16rem)_minmax(0,1fr)]'

function CharacterAliasesPanel({ characters }: { characters: CharacterAliasRow[] }) {
  const [state, formAction] = useActionState(saveCharacterAliasesBatchAction, INITIAL_FORM_STATE)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    buildInitialCharacterDrafts(characters),
  )

  const rowsPayload = useMemo(
    () =>
      JSON.stringify(
        characters.map(row => ({
          characterName: row.characterName,
          aliases: drafts[row.characterName] ?? '',
        })),
      ),
    [characters, drafts],
  )

  return (
    <form action={formAction} className={adminSurfaceStyles}>
      <input type="hidden" name="rowsJson" value={rowsPayload} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className={panelHeaderTitleStyles}>Character aliases</h3>
          <p className={panelHeaderDescriptionStyles}>
            Character aliases have top priority over creator and keyword aliases for duplicate
            terms.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            successLabel="Saved"
            errorFallback="Unable to save character aliases."
          />
          <SaveButton label="Save character aliases" />
        </div>
      </div>

      {characters.length === 0
        ? (
            <p className="
              text-sm text-gray-600
              dark:text-gray-300
            "
            >
              No characters available.
            </p>
          )
        : (
            <div className={tableShellStyles}>
              <div className={`
                ${tableHeaderStyles}
                ${aliasGridTemplate}
              `}
              >
                <div>Character</div>
                <div>Aliases</div>
              </div>

              {characters.map(row => (
                <div
                  key={row.characterName}
                  className={`
                    ${tableRowStyles}
                    ${aliasGridTemplate}
                    ${tableDividerStyles}
                    first:border-t-0
                  `}
                >
                  <div className="space-y-1">
                    <div className="
                      text-sm font-semibold text-gray-900
                      dark:text-gray-100
                    "
                    >
                      {row.characterName}
                    </div>
                    <p className="
                      text-xs text-gray-500
                      dark:text-gray-400
                    "
                    >
                      {row.commissionCount}
                      {' '}
                      commission
                      {row.commissionCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={drafts[row.characterName] ?? ''}
                    onChange={event =>
                      setDrafts(prev => ({
                        ...prev,
                        [row.characterName]: event.target.value,
                      }))}
                    className={formControlStyles}
                    placeholder="e.g. 七市, ななし"
                  />
                </div>
              ))}
            </div>
          )}
    </form>
  )
}

function CreatorAliasesPanel({ creators }: { creators: CreatorAliasRow[] }) {
  const [state, formAction] = useActionState(saveCreatorAliasesBatchAction, INITIAL_FORM_STATE)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    buildInitialCreatorDrafts(creators),
  )
  const visibleCreators = useMemo(
    () => creators.filter(row => hasCjkCharacter(row.creatorName)),
    [creators],
  )

  const rowsPayload = useMemo(
    () =>
      JSON.stringify(
        visibleCreators.map(row => ({
          creatorName: row.creatorName,
          alias: (drafts[row.creatorName] ?? '').trim(),
        })),
      ),
    [drafts, visibleCreators],
  )

  return (
    <form action={formAction} className={adminSurfaceStyles}>
      <input type="hidden" name="rowsJson" value={rowsPayload} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className={panelHeaderTitleStyles}>Creator aliases</h3>
          <p className={panelHeaderDescriptionStyles}>
            Edit romanized aliases for creators with CJK names to stabilize search matching.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            successLabel="Saved"
            errorFallback="Unable to save creator aliases."
          />
          <SaveButton label="Save creator aliases" />
        </div>
      </div>

      {visibleCreators.length === 0
        ? (
            <p className="
              text-sm text-gray-600
              dark:text-gray-300
            "
            >
              No creators available for alias editing.
            </p>
          )
        : (
            <div className={tableShellStyles}>
              <div className={`
                ${tableHeaderStyles}
                ${aliasGridTemplate}
              `}
              >
                <div>Creator</div>
                <div>Aliases</div>
              </div>

              {visibleCreators.map(row => (
                <div
                  key={row.creatorName}
                  className={`
                    ${tableRowStyles}
                    ${aliasGridTemplate}
                    ${tableDividerStyles}
                    first:border-t-0
                  `}
                >
                  <div className="space-y-1">
                    <div className="
                      text-sm font-semibold text-gray-900
                      dark:text-gray-100
                    "
                    >
                      {row.creatorName}
                    </div>
                    <p className="
                      text-xs text-gray-500
                      dark:text-gray-400
                    "
                    >
                      {row.commissionCount}
                      {' '}
                      commission
                      {row.commissionCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={drafts[row.creatorName] ?? ''}
                    onChange={event =>
                      setDrafts(prev => ({
                        ...prev,
                        [row.creatorName]: event.target.value,
                      }))}
                    className={formControlStyles}
                  />
                </div>
              ))}
            </div>
          )}
    </form>
  )
}

function KeywordAliasesPanel({ keywords }: { keywords: KeywordAliasRow[] }) {
  const [state, formAction] = useActionState(saveKeywordAliasesBatchAction, INITIAL_FORM_STATE)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    buildInitialKeywordDrafts(keywords),
  )

  const rowsPayload = useMemo(
    () =>
      JSON.stringify(
        keywords.map(row => ({
          baseKeyword: row.baseKeyword,
          aliases: drafts[row.baseKeyword] ?? '',
        })),
      ),
    [drafts, keywords],
  )

  return (
    <form action={formAction} className={adminSurfaceStyles}>
      <input type="hidden" name="rowsJson" value={rowsPayload} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className={panelHeaderTitleStyles}>Keyword aliases</h3>
          <p className={panelHeaderDescriptionStyles}>
            Keywords duplicated in character or creator aliases are hidden here to avoid mapping
            conflicts.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            successLabel="Saved"
            errorFallback="Unable to save keyword aliases."
          />
          <SaveButton label="Save keyword aliases" />
        </div>
      </div>

      {keywords.length === 0
        ? (
            <p className="
              text-sm text-gray-600
              dark:text-gray-300
            "
            >
              No keywords available yet. Add keywords to commissions first.
            </p>
          )
        : (
            <div className={tableShellStyles}>
              <div className={`
                ${tableHeaderStyles}
                ${aliasGridTemplate}
              `}
              >
                <div>Base keyword</div>
                <div>Aliases</div>
              </div>

              {keywords.map(row => (
                <div
                  key={row.baseKeyword}
                  className={`
                    ${tableRowStyles}
                    ${aliasGridTemplate}
                    ${tableDividerStyles}
                    first:border-t-0
                  `}
                >
                  <div className="space-y-1">
                    <div className="
                      text-sm font-semibold text-gray-900
                      dark:text-gray-100
                    "
                    >
                      {row.baseKeyword}
                    </div>
                    <p className="
                      text-xs text-gray-500
                      dark:text-gray-400
                    "
                    >
                      {row.commissionCount}
                      {' '}
                      commission
                      {row.commissionCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={drafts[row.baseKeyword] ?? ''}
                    onChange={event =>
                      setDrafts(prev => ({
                        ...prev,
                        [row.baseKeyword]: event.target.value,
                      }))}
                    className={formControlStyles}
                    placeholder="e.g. 七市, ななし"
                  />
                </div>
              ))}
            </div>
          )}
    </form>
  )
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
  const visibleCreatorCount = useMemo(
    () => creators.filter(row => hasCjkCharacter(row.creatorName)).length,
    [creators],
  )

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
          count={characters.length}
          label="Character"
          onSelect={setActiveTab}
          tab="character"
        />
        <TabButton
          activeTab={activeTab}
          count={visibleCreatorCount}
          label="Creator"
          onSelect={setActiveTab}
          tab="creator"
        />
        <TabButton
          activeTab={activeTab}
          count={keywords.length}
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
            <CharacterAliasesPanel characters={characters} />
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
            <CreatorAliasesPanel creators={creators} />
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
            <KeywordAliasesPanel keywords={keywords} />
          </div>
        )}
      </div>
    </section>
  )
}
