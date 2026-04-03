import type { APIRoute } from 'astro'
import { getCharacterAliases } from '@data/characterAliases'
import { getKeywordAliases } from '@data/keywordAliases'
import { HOME_LOCALES, normalizeHomeLocale } from '@features/home/i18n/homeLocale'
import { buildHomeCharacterBatchManifest, buildHomeCharacterBatchPlan } from '@features/home/server/homeCharacterBatches'
import { normalizeCharacterAliasKey } from '@lib/characterAliases'
import { buildSitePayload } from '@lib/home/buildSitePayload'
import { normalizeKeywordAliasKey } from '@lib/keywordAliases'
import { buildCommissionDataMap, buildCreatorAliasesMap } from '@lib/sitePayload'
import { hashString } from '@lib/utils/hash'

export function getStaticPaths() {
  return HOME_LOCALES.map(locale => ({ params: { locale } }))
}

export const GET: APIRoute = async ({ params }) => {
  const locale = normalizeHomeLocale(params.locale)
  const payload = buildSitePayload()
  const commissionMap = buildCommissionDataMap(payload.commissionData)
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
  const creatorAliasesMap = buildCreatorAliasesMap(payload.creatorAliases)

  const aliasContextHash = hashString(JSON.stringify([
    [...characterAliasesMap],
    [...creatorAliasesMap],
    [...keywordAliasesMap],
  ]))

  const plan = buildHomeCharacterBatchPlan({
    activeChars: payload.characterStatus.active,
    archivedChars: payload.characterStatus.archived,
    commissionMap,
  })
  const manifest = buildHomeCharacterBatchManifest({
    commissionMap,
    contextHash: aliasContextHash,
    locale,
    plan,
  })

  return new Response(`${JSON.stringify(manifest)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
