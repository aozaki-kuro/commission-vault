import type { AdminCommissionSearchRow } from '#lib/admin/db'
import { parseCommissionFileName } from '#lib/commissions/index'
import { normalizeCreatorName } from '#lib/creatorAliases/shared'
import { splitKeywordTerms } from '#lib/keywordAliases/shared'

export interface DuplicateCommissionHint {
  commissionId: number
  characterId: number
  characterName: string
  fileName: string
  reasons: string[]
  score: number
}

interface FindDuplicateCommissionHintsInput {
  commissionId?: number
  characterId: number | null
  fileName: string
  keyword?: string
  commissions: AdminCommissionSearchRow[]
  limit?: number
}

const MIN_DUPLICATE_SCORE = 40
const VALID_DATE_PATTERN = /^\d{8}$/

function normalizeFileName(value: string) {
  return value.trim()
}

function getParsedFileName(value: string) {
  const normalized = normalizeFileName(value)
  if (!normalized) {
    return {
      creatorName: null as string | null,
      date: null as string | null,
    }
  }

  const { creator, date } = parseCommissionFileName(normalized)
  return {
    creatorName: creator ? normalizeCreatorName(creator) : null,
    date: VALID_DATE_PATTERN.test(date) ? date : null,
  }
}

function getKeywordSet(value?: string | null) {
  return new Set(splitKeywordTerms(value))
}

function getSharedKeywords(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0)
    return []

  const shared: string[] = []
  for (const keyword of left) {
    if (right.has(keyword)) {
      shared.push(keyword)
    }
  }

  return shared.toSorted((a, b) => a.localeCompare(b))
}

export function findDuplicateCommissionHints({
  commissionId,
  characterId,
  fileName,
  keyword,
  commissions,
  limit = 4,
}: FindDuplicateCommissionHintsInput): DuplicateCommissionHint[] {
  const normalizedFileName = normalizeFileName(fileName)
  const hasCharacterSelection = typeof characterId === 'number' && characterId > 0
  const queryKeywords = getKeywordSet(keyword)
  const parsedQuery = getParsedFileName(normalizedFileName)

  if (!normalizedFileName && !hasCharacterSelection && queryKeywords.size === 0) {
    return []
  }

  return commissions
    .filter(candidate => candidate.id !== commissionId)
    .map((candidate) => {
      const reasons: string[] = []
      let score = 0

      if (normalizedFileName && candidate.fileName === normalizedFileName) {
        score += 120
        reasons.push('Same file name')
      }

      const parsedCandidate = getParsedFileName(candidate.fileName)
      if (parsedQuery.date && parsedCandidate.date === parsedQuery.date) {
        score += 25
        reasons.push(`Same date ${parsedQuery.date}`)
      }

      if (hasCharacterSelection && candidate.characterId === characterId) {
        score += 25
        reasons.push('Same character')
      }

      if (
        parsedQuery.creatorName
        && parsedCandidate.creatorName
        && parsedQuery.creatorName === parsedCandidate.creatorName
      ) {
        score += 20
        reasons.push('Same creator')
      }

      const sharedKeywords = getSharedKeywords(queryKeywords, getKeywordSet(candidate.keyword))
      if (sharedKeywords.length > 0) {
        score += Math.min(20, sharedKeywords.length * 10)
        reasons.push(`Shared keyword: ${sharedKeywords.slice(0, 2).join(', ')}`)
      }

      return {
        commissionId: candidate.id,
        characterId: candidate.characterId,
        characterName: candidate.characterName,
        fileName: candidate.fileName,
        reasons,
        score,
      } satisfies DuplicateCommissionHint
    })
    .filter(candidate => candidate.score >= MIN_DUPLICATE_SCORE)
    .toSorted((left, right) => {
      if (right.score !== left.score)
        return right.score - left.score
      return right.fileName.localeCompare(left.fileName)
    })
    .slice(0, limit)
}
