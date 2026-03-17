export interface Commission {
  fileName: string
  Links: string[]
  Design?: string
  Description?: string
  Keyword?: string
  Hidden?: boolean
}

export interface CharacterCommissions {
  Character: string
  Commissions: Commission[]
}

export type CommissionCollection = CharacterCommissions[]
export type Props = CommissionCollection

export type CharacterStatus = 'active' | 'stale'

export interface CharacterRecord {
  id: number
  name: string
  status: CharacterStatus
  sortOrder: number
  commissions: Commission[]
}
