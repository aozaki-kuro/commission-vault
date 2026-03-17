export interface CommissionEntity {
  id: number
  characterId: number
  fileName: string
  links: string[]
  design?: string | null
  description?: string | null
  keyword?: string | null
  hidden: boolean
}

export interface CharacterEntity {
  id: number
  name: string
  status: 'active' | 'stale'
  sortOrder: number
}
