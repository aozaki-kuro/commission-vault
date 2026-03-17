import {
  normalizeAliases,
  normalizeCharacterAliases,
  normalizeCharacterAliasKey,
  normalizeCharacterAliasName,
  normalizeCreatorName,
  normalizeKeywordAliases,
  normalizeKeywordAliasKey,
  normalizeKeywordBaseTerm,
} from '../../../packages/domain/src/index'

interface D1ResultLike {
  success?: boolean
}

interface D1BoundStatementLike {
  run: () => Promise<D1ResultLike>
}

interface D1PreparedStatementLike extends D1BoundStatementLike {
  bind: (...values: unknown[]) => D1BoundStatementLike
}

export interface D1DatabaseLike {
  prepare: (query: string) => D1PreparedStatementLike
}

const MAX_FEATURED_SEARCH_KEYWORDS = 6
const NORMALIZE_SPACES_PATTERN = /\s+/g

const CREATE_CREATOR_ALIASES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS creator_aliases (
    creator_name TEXT PRIMARY KEY,
    aliases TEXT NOT NULL
  )
`

const CREATE_CHARACTER_ALIASES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS character_aliases (
    character_name TEXT PRIMARY KEY,
    aliases TEXT NOT NULL
  )
`

const CREATE_KEYWORD_ALIASES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS keyword_aliases (
    base_keyword TEXT PRIMARY KEY,
    aliases TEXT NOT NULL
  )
`

const CREATE_HOME_FEATURED_SEARCH_KEYWORDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS home_featured_search_keywords (
    keyword TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL
  )
`

function normalizeKeyword(value: string) {
  return value.trim().replace(NORMALIZE_SPACES_PATTERN, ' ')
}

function dedupeKeywords(keywords: Iterable<string>, maxCount = Number.POSITIVE_INFINITY) {
  const uniqueKeywords: string[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword)
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueKeywords.push(normalized)

    if (uniqueKeywords.length >= maxCount) {
      break
    }
  }

  return uniqueKeywords
}

async function runStatement(db: D1DatabaseLike, query: string, values: unknown[] = []) {
  const statement = db.prepare(query)
  const runnable = values.length > 0 ? statement.bind(...values) : statement
  const result = await runnable.run()

  if (result.success === false) {
    throw new Error('D1 write operation failed.')
  }
}

async function ensureCreatorAliasesTable(db: D1DatabaseLike) {
  await runStatement(db, CREATE_CREATOR_ALIASES_TABLE_SQL)
}

async function ensureCharacterAliasesTable(db: D1DatabaseLike) {
  await runStatement(db, CREATE_CHARACTER_ALIASES_TABLE_SQL)
}

async function ensureKeywordAliasesTable(db: D1DatabaseLike) {
  await runStatement(db, CREATE_KEYWORD_ALIASES_TABLE_SQL)
}

async function ensureHomeFeaturedSearchKeywordsTable(db: D1DatabaseLike) {
  await runStatement(db, CREATE_HOME_FEATURED_SEARCH_KEYWORDS_TABLE_SQL)
}

export async function saveCreatorAliasesBatch(
  db: D1DatabaseLike,
  rows: Array<{ creatorName: string, aliases: string[] | string }>,
) {
  const mergedRows = new Map<string, string[]>()

  rows.forEach((row) => {
    const creatorName = normalizeCreatorName(row.creatorName)
    if (!creatorName) {
      return
    }

    const aliases = normalizeAliases(row.aliases)
    mergedRows.set(
      creatorName,
      normalizeAliases([...(mergedRows.get(creatorName) ?? []), ...aliases]),
    )
  })

  await ensureCreatorAliasesTable(db)

  for (const [creatorName, aliases] of mergedRows.entries()) {
    if (aliases.length === 0) {
      await runStatement(
        db,
        'DELETE FROM creator_aliases WHERE creator_name = ?',
        [creatorName],
      )
      continue
    }

    await runStatement(
      db,
      `
        INSERT INTO creator_aliases (creator_name, aliases)
        VALUES (?, ?)
        ON CONFLICT(creator_name) DO UPDATE SET aliases = excluded.aliases
      `,
      [creatorName, JSON.stringify(aliases)],
    )
  }
}

export async function saveCharacterAliasesBatch(
  db: D1DatabaseLike,
  rows: Array<{ characterName: string, aliases: string[] | string }>,
) {
  const mergedRows = new Map<string, { characterName: string, aliases: string[] }>()

  rows.forEach((row) => {
    const characterName = normalizeCharacterAliasName(row.characterName)
    if (!characterName) {
      return
    }

    const key = normalizeCharacterAliasKey(characterName)
    if (!key) {
      return
    }

    const aliases = normalizeCharacterAliases(row.aliases)
    const previous = mergedRows.get(key)
    mergedRows.set(key, {
      characterName: previous?.characterName ?? characterName,
      aliases: normalizeCharacterAliases([...(previous?.aliases ?? []), ...aliases]),
    })
  })

  await ensureCharacterAliasesTable(db)

  for (const row of mergedRows.values()) {
    if (row.aliases.length === 0) {
      await runStatement(
        db,
        'DELETE FROM character_aliases WHERE character_name = ?',
        [row.characterName],
      )
      continue
    }

    await runStatement(
      db,
      `
        INSERT INTO character_aliases (character_name, aliases)
        VALUES (?, ?)
        ON CONFLICT(character_name) DO UPDATE SET aliases = excluded.aliases
      `,
      [row.characterName, JSON.stringify(row.aliases)],
    )
  }
}

export async function saveKeywordAliasesBatch(
  db: D1DatabaseLike,
  rows: Array<{ baseKeyword: string, aliases: string[] | string }>,
) {
  const mergedRows = new Map<string, { baseKeyword: string, aliases: string[] }>()

  rows.forEach((row) => {
    const baseKeyword = normalizeKeywordBaseTerm(row.baseKeyword)
    if (!baseKeyword) {
      return
    }

    const key = normalizeKeywordAliasKey(baseKeyword)
    if (!key) {
      return
    }

    const aliases = normalizeKeywordAliases(row.aliases)
    const previous = mergedRows.get(key)
    mergedRows.set(key, {
      baseKeyword: previous?.baseKeyword ?? baseKeyword,
      aliases: normalizeKeywordAliases([...(previous?.aliases ?? []), ...aliases]),
    })
  })

  await ensureKeywordAliasesTable(db)

  for (const row of mergedRows.values()) {
    if (row.aliases.length === 0) {
      await runStatement(
        db,
        'DELETE FROM keyword_aliases WHERE base_keyword = ?',
        [row.baseKeyword],
      )
      continue
    }

    await runStatement(
      db,
      `
        INSERT INTO keyword_aliases (base_keyword, aliases)
        VALUES (?, ?)
        ON CONFLICT(base_keyword) DO UPDATE SET aliases = excluded.aliases
      `,
      [row.baseKeyword, JSON.stringify(row.aliases)],
    )
  }
}

export async function saveHomeFeaturedSearchKeywords(db: D1DatabaseLike, keywords: string[]) {
  const normalizedKeywords = dedupeKeywords(keywords, MAX_FEATURED_SEARCH_KEYWORDS)

  await ensureHomeFeaturedSearchKeywordsTable(db)
  await runStatement(db, 'DELETE FROM home_featured_search_keywords')

  for (const [index, keyword] of normalizedKeywords.entries()) {
    await runStatement(
      db,
      `
        INSERT INTO home_featured_search_keywords (keyword, sort_order)
        VALUES (?, ?)
      `,
      [keyword, index + 1],
    )
  }
}
