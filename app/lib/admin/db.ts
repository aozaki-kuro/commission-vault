import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export type CharacterStatus = 'active' | 'stale'

interface CharacterRow {
  id: number
  name: string
  status: CharacterStatus
  sortOrder: number
  commissionCount: number
}

interface CommissionRow {
  id: number
  characterId: number
  characterName: string
  fileName: string
  links: string[]
  design?: string | null
  description?: string | null
  hidden: boolean
}

export interface AdminData {
  characters: CharacterRow[]
  commissions: CommissionRow[]
}

type BetterSqlite3Database = Database.Database

const isDevelopment = process.env.NODE_ENV !== 'production'

let readOnlyDb: BetterSqlite3Database | null = null
let readWriteDb: BetterSqlite3Database | null = null

const createDatabase = (readonly: boolean) => {
  const databasePath = path.join(process.cwd(), 'data', 'commissions.db')
  if (!fs.existsSync(databasePath)) {
    throw new Error(
      `SQLite database not found at ${databasePath}. Run "bun run db:seed" to generate it.`,
    )
  }

  const db = new Database(databasePath, {
    readonly,
    fileMustExist: true,
  })

  db.pragma('busy_timeout = 5000')
  if (!readonly) {
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
  }

  return db
}

const getDatabase = (options?: { readonly?: boolean }) => {
  const useReadonly = options?.readonly ?? !isDevelopment

  if (useReadonly) {
    if (!readOnlyDb) {
      readOnlyDb = createDatabase(true)
    }
    return readOnlyDb
  }

  if (!isDevelopment) {
    throw new Error('Writable database operations are only allowed in development mode.')
  }

  if (!readWriteDb) {
    readWriteDb = createDatabase(false)
  }
  return readWriteDb
}

export const getAdminData = (): AdminData => {
  const db = getDatabase({ readonly: true })

  const rawCharacters = db
    .prepare(
      `
        SELECT
          characters.id as id,
          characters.name as name,
          characters.status as status,
          characters.sort_order as sortOrder,
          COUNT(commissions.id) as commissionCount
        FROM characters
        LEFT JOIN commissions ON commissions.character_id = characters.id
        GROUP BY characters.id
        ORDER BY characters.sort_order ASC
      `,
    )
    .all() as Array<{
    id: number
    name: string
    status: CharacterStatus
    sortOrder: number
    commissionCount: number
  }>

  const characters: CharacterRow[] = rawCharacters.map(row => ({
    ...row,
    commissionCount: Number(row.commissionCount ?? 0),
  }))

  const rawCommissions = db
    .prepare(
      `
        SELECT
          commissions.id as id,
          commissions.character_id as characterId,
          characters.name as characterName,
          commissions.file_name as fileName,
          commissions.links as links,
          commissions.design as design,
          commissions.description as description,
          commissions.hidden as hidden
        FROM commissions
        JOIN characters ON characters.id = commissions.character_id
        ORDER BY characters.sort_order ASC, commissions.file_name DESC
      `,
    )
    .all() as Array<{
    id: number
    characterId: number
    characterName: string
    fileName: string
    links: string
    design?: string | null
    description?: string | null
    hidden: number
  }>

  const commissions: CommissionRow[] = rawCommissions.map(row => ({
    id: row.id,
    characterId: row.characterId,
    characterName: row.characterName,
    fileName: row.fileName,
    links: JSON.parse(row.links) as string[],
    design: row.design ?? null,
    description: row.description ?? null,
    hidden: Boolean(row.hidden),
  }))

  return { characters, commissions }
}

const ensureWritable = () => {
  if (!isDevelopment) {
    throw new Error('Writable database operations are only available in development mode.')
  }
}

export const createCharacter = (input: { name: string; status: CharacterStatus }) => {
  ensureWritable()

  const name = input.name.trim()
  if (!name) {
    throw new Error('Character name is required.')
  }

  const db = getDatabase({ readonly: false })
  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM characters')
    .get() as { maxOrder: number }

  db.prepare(
    'INSERT INTO characters (name, status, sort_order) VALUES (@name, @status, @sortOrder)',
  ).run({
    name,
    status: input.status,
    sortOrder: Number(maxOrderRow?.maxOrder ?? 0) + 1,
  })
}

export const updateCharacter = (input: { id: number; name: string; status: CharacterStatus }) => {
  ensureWritable()

  const trimmed = input.name.trim()
  if (!trimmed) {
    throw new Error('Character name is required.')
  }

  const db = getDatabase({ readonly: false })
  db.prepare('UPDATE characters SET name = @name, status = @status WHERE id = @id').run({
    id: input.id,
    name: trimmed,
    status: input.status,
  })
}

interface CharacterOrderPayload {
  active: number[]
  stale: number[]
}

export const updateCharactersOrder = ({ active, stale }: CharacterOrderPayload) => {
  ensureWritable()

  if (
    !Array.isArray(active) ||
    !Array.isArray(stale) ||
    active.some(id => typeof id !== 'number') ||
    stale.some(id => typeof id !== 'number')
  ) {
    throw new Error('Invalid character order payload.')
  }

  const db = getDatabase({ readonly: false })
  const updateStatement = db.prepare(
    'UPDATE characters SET sort_order = @sortOrder, status = @status WHERE id = @id',
  )

  const transaction = db.transaction(() => {
    const combined = [
      ...active.map<[number, CharacterStatus]>(id => [id, 'active']),
      ...stale.map<[number, CharacterStatus]>(id => [id, 'stale']),
    ]

    combined.forEach(([id, status], index) => {
      updateStatement.run({ id, sortOrder: index + 1, status })
    })
  })

  transaction()
}

export const createCommission = (input: {
  characterId: number
  fileName: string
  links: string[]
  design?: string | null
  description?: string | null
  hidden?: boolean
}): { characterName: string } => {
  ensureWritable()

  const db = getDatabase({ readonly: false })
  const characterRecord = db
    .prepare('SELECT id, name FROM characters WHERE id = @id')
    .get({ id: input.characterId }) as { id: number; name: string } | undefined

  if (!characterRecord) {
    throw new Error('Selected character does not exist.')
  }

  db.prepare(
    `
      INSERT INTO commissions (
        character_id,
        file_name,
        links,
        design,
        description,
        hidden
      ) VALUES (
        @characterId,
        @fileName,
        @links,
        @design,
        @description,
        @hidden
      )
    `,
  ).run({
    characterId: characterRecord.id,
    fileName: input.fileName.trim(),
    links: JSON.stringify(input.links),
    design: input.design ?? null,
    description: input.description ?? null,
    hidden: input.hidden ? 1 : 0,
  })

  return { characterName: characterRecord.name }
}

export const updateCommission = (input: {
  id: number
  characterId: number
  fileName: string
  links: string[]
  design?: string | null
  description?: string | null
  hidden?: boolean
}) => {
  ensureWritable()

  const db = getDatabase({ readonly: false })
  const characterRecord = db
    .prepare('SELECT id FROM characters WHERE id = @id')
    .get({ id: input.characterId }) as { id: number } | undefined

  if (!characterRecord) {
    throw new Error('Selected character does not exist.')
  }

  db.prepare(
    `
      UPDATE commissions
      SET
        character_id = @characterId,
        file_name = @fileName,
        links = @links,
        design = @design,
        description = @description,
        hidden = @hidden
      WHERE id = @id
    `,
  ).run({
    id: input.id,
    characterId: characterRecord.id,
    fileName: input.fileName.trim(),
    links: JSON.stringify(input.links),
    design: input.design ?? null,
    description: input.description ?? null,
    hidden: input.hidden ? 1 : 0,
  })
}

export type { CharacterRow, CommissionRow }

export const deleteCommission = (id: number) => {
  ensureWritable()

  const db = getDatabase({ readonly: false })
  db.prepare('DELETE FROM commissions WHERE id = @id').run({ id })
}
