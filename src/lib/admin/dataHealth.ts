import type {
  AdminAliasesData,
  AdminData,
  HomeSuggestionAdminData,
} from '#lib/admin/db'
import {
  getAdminAliasesData,
  getAdminData,
  getHomeSuggestionAdminData,
} from '#lib/admin/db'
import {
  listSourceImageStems,
  resolveSourceImageStem,
} from '#lib/images/sourceImageRegistry'

export interface AdminDataHealthGroup {
  id: 'missing-source-images' | 'orphan-source-images' | 'unused-aliases' | 'stale-featured-keywords'
  label: string
  count: number
  samples: string[]
}

export interface AdminDataHealthSummary {
  groups: AdminDataHealthGroup[]
  totalIssues: number
}

interface BuildAdminDataHealthSummaryInput {
  adminData: {
    commissions: Array<Pick<AdminData['commissions'][number], 'fileName'>>
  }
  aliasesData: AdminAliasesData
  suggestionData: HomeSuggestionAdminData
  resolveImageStem: (fileName: string) => string | null
  sourceImageStems: string[]
  sampleSize?: number
}

const DEFAULT_SAMPLE_SIZE = 5

function normalizeTerm(value: string) {
  return value.trim().toLowerCase()
}

function takeSamples(values: string[], sampleSize: number) {
  return values.slice(0, sampleSize)
}

export function buildAdminDataHealthSummary({
  adminData,
  aliasesData,
  suggestionData,
  resolveImageStem,
  sourceImageStems,
  sampleSize = DEFAULT_SAMPLE_SIZE,
}: BuildAdminDataHealthSummaryInput): AdminDataHealthSummary {
  const resolvedStems = adminData.commissions
    .map(commission => resolveImageStem(commission.fileName))
    .filter((stem): stem is string => Boolean(stem))
  const usedStemSet = new Set(resolvedStems)
  const missingSourceImages = adminData.commissions
    .map(commission => commission.fileName)
    .filter(fileName => !resolveImageStem(fileName))
    .toSorted((left, right) => right.localeCompare(left))
  const orphanSourceImages = sourceImageStems
    .filter(stem => !usedStemSet.has(stem))
    .toSorted((left, right) => right.localeCompare(left))
  const unusedAliases = [
    ...aliasesData.characterAliases
      .filter(row => row.commissionCount === 0)
      .map(row => `Character: ${row.characterName}`),
    ...aliasesData.creatorAliases
      .filter(row => row.commissionCount === 0)
      .map(row => `Creator: ${row.creatorName}`),
    ...aliasesData.keywordAliases
      .filter(row => row.commissionCount === 0)
      .map(row => `Keyword: ${row.baseKeyword}`),
  ].toSorted((left, right) => left.localeCompare(right))
  const keywordOptionSet = new Set(
    suggestionData.keywordOptions.map(normalizeTerm).filter(Boolean),
  )
  const staleFeaturedKeywords = suggestionData.featuredKeywords
    .filter((keyword) => {
      const normalized = normalizeTerm(keyword)
      return normalized && !keywordOptionSet.has(normalized)
    })
    .toSorted((left, right) => left.localeCompare(right))

  const groups: AdminDataHealthGroup[] = [
    {
      id: 'missing-source-images',
      label: 'Missing source images',
      count: missingSourceImages.length,
      samples: takeSamples(missingSourceImages, sampleSize),
    },
    {
      id: 'orphan-source-images',
      label: 'Orphan source images',
      count: orphanSourceImages.length,
      samples: takeSamples(orphanSourceImages, sampleSize),
    },
    {
      id: 'unused-aliases',
      label: 'Unused alias rows',
      count: unusedAliases.length,
      samples: takeSamples(unusedAliases, sampleSize),
    },
    {
      id: 'stale-featured-keywords',
      label: 'Featured keywords without matches',
      count: staleFeaturedKeywords.length,
      samples: takeSamples(staleFeaturedKeywords, sampleSize),
    },
  ]

  return {
    groups,
    totalIssues: groups.reduce((total, group) => total + group.count, 0),
  }
}

export function getAdminDataHealthSummary(sampleSize = DEFAULT_SAMPLE_SIZE) {
  return buildAdminDataHealthSummary({
    adminData: getAdminData(),
    aliasesData: getAdminAliasesData(),
    suggestionData: getHomeSuggestionAdminData(),
    resolveImageStem: fileName => resolveSourceImageStem(fileName),
    sourceImageStems: listSourceImageStems(),
    sampleSize,
  })
}
