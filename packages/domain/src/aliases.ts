export interface CreatorAliasEntry {
  creatorName: string
  aliases: string[]
}

export interface CharacterAliasEntry {
  characterName: string
  aliases: string[]
}

export interface KeywordAliasEntry {
  baseKeyword: string
  aliases: string[]
}

export interface CreatorAliasRow extends CreatorAliasEntry {
  commissionCount: number
}

export interface CharacterAliasRow extends CharacterAliasEntry {
  commissionCount: number
}

export interface KeywordAliasRow extends KeywordAliasEntry {
  commissionCount: number
}
