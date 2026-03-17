import type {
  AdminCommissionSearchRow,
  CreatorAliasRow,
} from '@commission-index/domain'
import { buildCommissionSearchMetadata } from '@commission-index/domain'

const WHITESPACE_PATTERN = /\s+/g

export interface AdminCommissionSearchEntry {
  characterId: number
  id: number
  searchText: string
}

export function normalizeAdminSearchQuery(value: string) {
  return value.trim().toLowerCase().replace(WHITESPACE_PATTERN, ' ')
}

function tokenizeSearchQuery(value: string) {
  const normalized = normalizeAdminSearchQuery(value)
  return normalized ? normalized.split(' ') : []
}

function buildCreatorAliasesMap(rows: CreatorAliasRow[]) {
  return new Map(rows.map(row => [row.creatorName, row.aliases] as const))
}

function includeFileNameInSearchText(baseSearchText: string, fileName: string) {
  return `${baseSearchText} ${fileName}`.toLowerCase()
}

export function buildAdminCommissionSearchEntries(
  rows: AdminCommissionSearchRow[],
  creatorAliases: CreatorAliasRow[],
): AdminCommissionSearchEntry[] {
  const creatorAliasesMap = buildCreatorAliasesMap(creatorAliases)

  return rows.map(row => ({
    characterId: row.characterId,
    id: row.id,
    searchText: includeFileNameInSearchText(
      buildCommissionSearchMetadata({
        characterName: row.characterName,
        creatorAliasesMap,
        creatorSearchTextMode: 'raw',
        creatorSuggestionMode: 'raw',
        description: row.description,
        design: row.design,
        fileName: row.fileName,
        keyword: row.keyword,
      }).searchText,
      row.fileName,
    ),
  }))
}

export function matchCommissionIds(
  query: string,
  entries: AdminCommissionSearchEntry[],
): Set<number> {
  const tokens = tokenizeSearchQuery(query)
  if (tokens.length === 0) {
    return new Set(entries.map(entry => entry.id))
  }

  return new Set(
    entries
      .filter(entry => tokens.every(token => entry.searchText.includes(token)))
      .map(entry => entry.id),
  )
}

export function buildCommissionToCharacterMap(rows: AdminCommissionSearchRow[]) {
  const next = new Map<number, number>()
  for (const row of rows) {
    next.set(row.id, row.characterId)
  }
  return next
}

export function collectMatchedCharacterIds(
  matchedCommissionIds: ReadonlySet<number>,
  commissionToCharacterIdMap: ReadonlyMap<number, number>,
) {
  const next = new Set<number>()
  for (const commissionId of matchedCommissionIds) {
    const characterId = commissionToCharacterIdMap.get(commissionId)
    if (characterId !== undefined) {
      next.add(characterId)
    }
  }
  return next
}
