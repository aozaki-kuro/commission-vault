import type { APIRoute } from 'astro'
import { getCharacterAliases } from '@data/characterAliases'
import { getKeywordAliases } from '@data/keywordAliases'
import { normalizeHomeLocale } from '@features/home/i18n/homeLocale'
import { buildHomeTimelineBatchManifest, buildHomeTimelineBatchPlan } from '@features/home/server/homeTimelineBatches'
import { normalizeCharacterAliasKey } from '@lib/characterAliases'
import { buildSitePayload } from '@lib/home/buildSitePayload'
import { normalizeKeywordAliasKey } from '@lib/keywordAliases'
import { buildCreatorAliasesMap } from '@lib/sitePayload'
import { hashString } from '@lib/utils/hash'

export const GET: APIRoute = async () => {
  const locale = normalizeHomeLocale(undefined)
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
  const creatorAliasesMap = buildCreatorAliasesMap(payload.creatorAliases)

  const aliasContextHash = hashString(JSON.stringify([
    [...characterAliasesMap],
    [...creatorAliasesMap],
    [...keywordAliasesMap],
  ]))

  const plan = buildHomeTimelineBatchPlan({ groups: payload.timelineGroups })
  const manifest = buildHomeTimelineBatchManifest({
    contextHash: aliasContextHash,
    locale,
    plan,
  })

  return new Response(`${JSON.stringify(manifest)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
