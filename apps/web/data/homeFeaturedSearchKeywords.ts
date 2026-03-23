import process from 'node:process'
import { dedupeKeywords } from '#lib/search/popularKeywords'
import { getGeneratedFactSourceContent } from './generatedFactSource'

const DEFAULT_FEATURED_LIMIT = 6
const isDevelopment = process.env.NODE_ENV === 'development'
const cachedFeaturedKeywordsByLimit = new Map<number, string[]>()

export function getHomeFeaturedSearchKeywords(limit = DEFAULT_FEATURED_LIMIT) {
  if (limit <= 0)
    return []
  if (!isDevelopment) {
    const cached = cachedFeaturedKeywordsByLimit.get(limit)
    if (cached)
      return cached
  }

  const keywords = dedupeKeywords(
    getGeneratedFactSourceContent().featuredSearchKeywords,
    limit,
  )

  if (!isDevelopment) {
    cachedFeaturedKeywordsByLimit.set(limit, keywords)
  }

  return keywords
}
