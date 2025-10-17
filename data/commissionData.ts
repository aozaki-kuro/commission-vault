import { filterHiddenCommissions, sortCommissionsByDate } from '#lib/commissions'
import { Commission, Props } from '#data/types'
import { queryAll } from './sqlite'

interface CharacterRow {
  id: number
  name: string
  status: 'active' | 'stale'
  sort_order: number
  file_name?: string | null
  links?: string | null
  design?: string | null
  description?: string | null
  hidden?: number | null
}

interface CharacterAccumulator {
  Character: string
  Status: 'active' | 'stale'
  sortOrder: number
  Commissions: Commission[]
}

const loadCommissionData = (): Props => {
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
       commissions.hidden
     FROM characters
     LEFT JOIN commissions ON commissions.character_id = characters.id
     ORDER BY characters.sort_order ASC, commissions.file_name DESC`,
  )

  const characterMap = new Map<number, CharacterAccumulator>()

  rows.forEach(row => {
    let accumulator = characterMap.get(row.id)

    if (!accumulator) {
      accumulator = {
        Character: row.name,
        Status: row.status,
        sortOrder: row.sort_order,
        Commissions: [],
      }
      characterMap.set(row.id, accumulator)
    }

    if (!row.file_name) return

    let links: string[] = []
    if (row.links) {
      try {
        const parsed = JSON.parse(row.links)
        if (Array.isArray(parsed)) {
          links = parsed.map(link => String(link))
        }
      } catch {
        links = []
      }
    }

    accumulator.Commissions.push({
      fileName: row.file_name,
      Links: links,
      Design: row.design ?? undefined,
      Description: row.description ?? undefined,
      Hidden: Boolean(row.hidden ?? 0),
    })
  })

  const characters: Props = [...characterMap.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(character => ({
      Character: character.Character,
      Commissions: character.Commissions.sort(sortCommissionsByDate),
    }))

  return filterHiddenCommissions(characters)
}

const commissions: Props = loadCommissionData()

export const commissionData: Props = commissions
export const commissionDataMap = new Map(
  commissionData.map(character => [character.Character, character]),
)
