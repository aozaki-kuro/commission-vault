import { queryAll } from './sqlite'

interface CharacterProps {
  DisplayName: string
}

interface CommissionStatus {
  active: CharacterProps[]
  stale: CharacterProps[]
}

const loadStatus = (): CommissionStatus => {
  const rows = queryAll<{ name: string; status: 'active' | 'stale' }>(
    `SELECT name, status
     FROM characters
     ORDER BY sort_order ASC`,
  )

  const active: CharacterProps[] = []
  const stale: CharacterProps[] = []

  rows.forEach(row => {
    const entry = { DisplayName: row.name }
    if (row.status === 'active') active.push(entry)
    else stale.push(entry)
  })

  return { active, stale }
}

export const characterStatus: CommissionStatus = loadStatus()
