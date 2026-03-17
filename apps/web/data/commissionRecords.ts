import type { CharacterRecord, CharacterStatus } from '@commission-index/domain'
import process from 'node:process'
import { queryAll } from './sqlite'

interface CharacterRow {
  id: number
  name: string
  status: CharacterStatus
  sort_order: number
  file_name?: string | null
  links?: string | null
  design?: string | null
  description?: string | null
  keyword?: string | null
  hidden?: number | null
}

const isDevelopment = process.env.NODE_ENV === 'development'
let commissionKeywordColumnSupport: boolean | null = null

// 将数据库中的 JSON 字符串解析为链接数组，确保异常时返回空数组
function parseLinks(raw?: string | null): string[] {
  if (!raw)
    return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(link => String(link)) : []
  }
  catch {
    return []
  }
}

function hasCommissionKeywordColumn(): boolean {
  if (commissionKeywordColumnSupport !== null)
    return commissionKeywordColumnSupport
  const columns = queryAll<{ name: string }>('PRAGMA table_info(commissions)')
  commissionKeywordColumnSupport = columns.some(column => column.name === 'keyword')
  return commissionKeywordColumnSupport
}

// 将数据库行转换为具备排序信息的角色记录列表
function buildCharacterRecords(rows: CharacterRow[]): CharacterRecord[] {
  const characters = new Map<number, CharacterRecord>()

  rows.forEach((row) => {
    if (!characters.has(row.id)) {
      characters.set(row.id, {
        id: row.id,
        name: row.name,
        status: row.status,
        sortOrder: row.sort_order,
        commissions: [],
      })
    }

    if (!row.file_name)
      return

    const record = characters.get(row.id)!
    record.commissions.push({
      fileName: row.file_name,
      Links: parseLinks(row.links),
      Design: row.design ?? undefined,
      Description: row.description ?? undefined,
      Keyword: row.keyword ?? undefined,
      Hidden: Boolean(row.hidden ?? 0),
    })
  })

  return [...characters.values()].toSorted((a, b) => a.sortOrder - b.sortOrder)
}

// 从 SQLite 读取角色与委托信息（开发环境实时读取，生产走缓存）
function loadCharacterRecords(): CharacterRecord[] {
  const hasKeywordColumn = hasCommissionKeywordColumn()
  const keywordSelect = hasKeywordColumn ? 'commissions.keyword as keyword,' : 'NULL as keyword,'

  const rows = queryAll<CharacterRow>(
    `SELECT
       characters.id,
       characters.name,
       characters.status,
       characters.sort_order,
       commissions.file_name,
       commissions.links,
       commissions.design,
       commissions.description,
       ${keywordSelect}
       commissions.hidden
     FROM characters
     LEFT JOIN commissions ON commissions.character_id = characters.id
     ORDER BY characters.sort_order ASC, commissions.file_name DESC`,
  )

  return buildCharacterRecords(rows)
}

const staticCharacterRecords = loadCharacterRecords()

export function getCharacterRecords(): CharacterRecord[] {
  return isDevelopment ? loadCharacterRecords() : staticCharacterRecords
}

export { staticCharacterRecords as characterRecords }
export type { CharacterRecord, CharacterStatus } from '@commission-index/domain'
