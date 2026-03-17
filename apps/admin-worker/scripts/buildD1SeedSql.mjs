import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Database } from 'bun:sqlite'

const cwd = process.cwd()
const sourceDbPath = path.resolve(cwd, '../web/data/commissions.db')
const outputPath = path.resolve(cwd, process.argv[2] ?? './.wrangler/tmp/admin-seed.sql')

const db = new Database(sourceDbPath, { readonly: true })

function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL'
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  return `'${String(value).replaceAll('\'', '\'\'')}'`
}

function buildInsertStatements(tableName, columns, rows) {
  return rows.map((row) => {
    const values = columns.map(column => sqlLiteral(row[column])).join(', ')
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});`
  })
}

const characters = db.query(`
  SELECT
    id,
    name,
    status,
    sort_order as sort_order
  FROM characters
  ORDER BY id ASC
`).all()

const commissions = db.query(`
  SELECT
    id,
    character_id as character_id,
    file_name as file_name,
    links,
    design,
    description,
    hidden,
    keyword
  FROM commissions
  ORDER BY id ASC
`).all()

const creatorAliases = db.query(`
  SELECT
    creator_name as creator_name,
    aliases
  FROM creator_aliases
  ORDER BY creator_name ASC
`).all()

const characterAliases = db.query(`
  SELECT
    character_name as character_name,
    aliases
  FROM character_aliases
  ORDER BY character_name ASC
`).all()

const keywordAliases = db.query(`
  SELECT
    base_keyword as base_keyword,
    aliases
  FROM keyword_aliases
  ORDER BY base_keyword ASC
`).all()

const featuredKeywords = db.query(`
  SELECT
    keyword,
    sort_order as sort_order
  FROM home_featured_search_keywords
  ORDER BY sort_order ASC, keyword ASC
`).all()

db.close()

const lines = [
  '-- Generated from apps/web/data/commissions.db. Do not edit by hand.',
  'PRAGMA defer_foreign_keys = on;',
  'DELETE FROM home_featured_search_keywords;',
  'DELETE FROM keyword_aliases;',
  'DELETE FROM character_aliases;',
  'DELETE FROM creator_aliases;',
  'DELETE FROM commissions;',
  'DELETE FROM characters;',
  ...buildInsertStatements('characters', ['id', 'name', 'status', 'sort_order'], characters),
  ...buildInsertStatements(
    'commissions',
    ['id', 'character_id', 'file_name', 'links', 'design', 'description', 'hidden', 'keyword'],
    commissions,
  ),
  ...buildInsertStatements('creator_aliases', ['creator_name', 'aliases'], creatorAliases),
  ...buildInsertStatements('character_aliases', ['character_name', 'aliases'], characterAliases),
  ...buildInsertStatements('keyword_aliases', ['base_keyword', 'aliases'], keywordAliases),
  ...buildInsertStatements(
    'home_featured_search_keywords',
    ['keyword', 'sort_order'],
    featuredKeywords,
  ),
]

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')

console.log(
  `Wrote D1 seed SQL to ${outputPath} (${characters.length} characters, ${commissions.length} commissions, ${creatorAliases.length} creator aliases, ${characterAliases.length} character aliases, ${keywordAliases.length} keyword aliases, ${featuredKeywords.length} featured keywords).`,
)
