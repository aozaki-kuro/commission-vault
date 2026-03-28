import type { AdminCommissionSearchRow } from '@commission-index/domain'
import {
  normalizeCreatorName,
  parseCommissionFileName,
  splitKeywordTerms,
} from '@commission-index/domain'

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

const VALID_DATE_PATTERN = /^\d{8}$/

function normalizeFileName(value: string) {
  return value.trim()
}

function getParsedFileName(value: string) {
  const normalized = normalizeFileName(value)
  if (!normalized) {
    return {
      creatorName: null as string | null,
      rawCreatorName: null as string | null,
      date: null as string | null,
    }
  }

  const { creator, date } = parseCommissionFileName(normalized)

  return {
    // 用于别名查找等需要忽略 part 后缀的场景
    creatorName: creator ? normalizeCreatorName(creator) : null,
    // 用于重复检测：保留 (part N) 以区分多 part 稿件
    rawCreatorName: creator ? creator.trim() : null,
    date: VALID_DATE_PATTERN.test(date) ? date : null,
  }
}

function getKeywordSet(value?: string | null) {
  return new Set(splitKeywordTerms(value))
}

function getSharedKeywords(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return []
  }

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
  const parsedQuery = getParsedFileName(normalizedFileName)
  const hasCharacterSelection = typeof characterId === 'number' && characterId > 0
  const queryKeywords = getKeywordSet(keyword)

  if (!normalizedFileName) {
    return []
  }

  return commissions
    .filter(candidate => candidate.id !== commissionId)
    .map((candidate) => {
      const reasons: string[] = []
      let score = 0
      let isLikelyDuplicate = false

      if (normalizedFileName && candidate.fileName === normalizedFileName) {
        score += 200
        reasons.push('Same file name')
        isLikelyDuplicate = true
      }

      const parsedCandidate = getParsedFileName(candidate.fileName)
      const sameDate = parsedQuery.date && parsedCandidate.date === parsedQuery.date
      const sameCharacter = hasCharacterSelection && candidate.characterId === characterId
      const sameCreator = Boolean(
        parsedQuery.rawCreatorName
        && parsedCandidate.rawCreatorName
        && parsedQuery.rawCreatorName === parsedCandidate.rawCreatorName,
      )

      if (!isLikelyDuplicate && sameCharacter && sameDate && sameCreator) {
        score += 150
        reasons.push('Same character')
        reasons.push(`Same date ${parsedQuery.date}`)
        reasons.push('Same creator')
        isLikelyDuplicate = true
      }

      if (isLikelyDuplicate) {
        const sharedKeywords = getSharedKeywords(queryKeywords, getKeywordSet(candidate.keyword))
        if (sharedKeywords.length > 0) {
          score += Math.min(20, sharedKeywords.length * 10)
          reasons.push(`Shared keyword: ${sharedKeywords.slice(0, 2).join(', ')}`)
        }
      }

      return {
        characterId: candidate.characterId,
        characterName: candidate.characterName,
        commissionId: candidate.id,
        fileName: candidate.fileName,
        reasons,
        score,
      } satisfies DuplicateCommissionHint
    })
    .filter(candidate => candidate.reasons.length > 0)
    .toSorted((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.fileName.localeCompare(left.fileName)
    })
    .slice(0, limit)
}
