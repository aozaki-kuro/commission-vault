import type { APIRoute } from 'astro'
import { getCharacterAliases } from '#data/characterAliases'
import { getKeywordAliases } from '#data/keywordAliases'
import { HOME_LOCALES, normalizeHomeLocale } from '#features/home/i18n/homeLocale'
import { buildHomeTimelineBatchPlan } from '#features/home/server/homeTimelineBatches'
import { buildHomeTimelineBatchPayload } from '#features/home/server/homeTimelineBatchPayload'
import { normalizeCharacterAliasKey } from '#lib/characterAliases'
import { buildSitePayload } from '#lib/home/buildSitePayload'
import { normalizeKeywordAliasKey } from '#lib/keywordAliases'
import { buildCreatorAliasesMap } from '#lib/sitePayload'

function getBatchPlan() {
  const payload = buildSitePayload()
  const characterAliases = getCharacterAliases()
  const keywordAliases = getKeywordAliases()

  const characterAliasesMap = new Map(
    characterAliases
      .map((row) => {
        const key = normalizeCharacterAliasKey(row.characterName)
        if (!key)
          return null
        return [key, row.aliases] as const
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry)),
  )
  const keywordAliasesMap = new Map(
    keywordAliases
      .map((row) => {
        const key = normalizeKeywordAliasKey(row.baseKeyword)
        if (!key)
          return null
        return [key, row.aliases] as const
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry)),
  )

  return {
    characterAliasesMap,
    creatorAliasesMap: buildCreatorAliasesMap(payload.creatorAliases),
    keywordAliasesMap,
    plan: buildHomeTimelineBatchPlan({
      groups: payload.timelineGroups,
    }),
  }
}

export function getStaticPaths() {
  const { plan } = getBatchPlan()
  const paths: Array<{
    params: { batch: string, locale: string }
  }> = []

  for (const locale of HOME_LOCALES) {
    for (let batchIndex = 0; batchIndex < plan.totalBatches; batchIndex += 1) {
      paths.push({
        params: {
          batch: String(batchIndex),
          locale,
        },
      })
    }
  }

  return paths
}

export const GET: APIRoute = async ({ params }) => {
  const locale = normalizeHomeLocale(params.locale)
  const batchIndex = Number(params.batch)
  if (!Number.isInteger(batchIndex) || batchIndex < 0) {
    return new Response(null, { status: 404 })
  }

  const { characterAliasesMap, creatorAliasesMap, keywordAliasesMap, plan } = getBatchPlan()
  const groups = plan.batches[batchIndex]
  if (!groups) {
    return new Response(null, { status: 404 })
  }

  const payload = await buildHomeTimelineBatchPayload({
    batchIndex,
    characterAliasesMap,
    creatorAliasesMap,
    groups,
    keywordAliasesMap,
    locale,
  })

  return new Response(`${JSON.stringify(payload)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
