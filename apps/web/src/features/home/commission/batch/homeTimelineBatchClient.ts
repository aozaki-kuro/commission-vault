import type { HomeTimelineBatchPayload } from '@features/home/commission/batch/homeTimelineBatchPayload'
import { readHomeTimelineBatchManifest } from '@features/home/commission/batch/homeTimelineBatchManifest'
import { renderHomeTimelineBatchPayload } from '@features/home/commission/batch/homeTimelineBatchRender'
import { buildHomeTimelineBatchUrl } from '@features/home/server/homeTimelineBatches'

const batchRequestCache = new Map<string, Promise<HomeTimelineBatchPayload>>()
const LEGACY_TIMELINE_TEMPLATE_SELECTOR = 'template'
const LEGACY_TIMELINE_ROOT_TEMPLATE_SELECTOR = 'template[data-timeline-sections-template="true"]'

export async function fetchHomeTimelineBatch({
  batchIndex,
  doc,
}: {
  batchIndex: number
  doc: Document
}) {
  const manifest = readHomeTimelineBatchManifest(doc)
  if (!manifest)
    return null

  const url = buildHomeTimelineBatchUrl({
    batchIndex,
    locale: manifest.locale,
  })

  let request = batchRequestCache.get(url)
  if (!request) {
    request = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load timeline batch ${batchIndex}: ${response.status}`)
        }

        return (await response.json()) as HomeTimelineBatchPayload
      })
      .catch((error) => {
        batchRequestCache.delete(url)
        throw error
      })
    batchRequestCache.set(url, request)
  }

  return request
}

export function clearHomeTimelineBatchRequestCacheForTests() {
  batchRequestCache.clear()
}

export function mountHomeTimelineBatch({
  container,
  payload,
}: {
  container: HTMLElement
  payload: HomeTimelineBatchPayload
}) {
  container.append(renderHomeTimelineBatchPayload(payload))
}

export function mountLegacyHomeTimelineBatch({
  batchIndex,
  container,
  panel,
}: {
  batchIndex: number
  container: HTMLElement
  panel: HTMLElement
}) {
  const template = panel.querySelector<HTMLTemplateElement>(
    `${LEGACY_TIMELINE_TEMPLATE_SELECTOR}[data-timeline-batch-index="${batchIndex}"]`,
  )
  if (template) {
    container.append(template.content.cloneNode(true))
    template.remove()
    return true
  }

  if (batchIndex !== 0) {
    return false
  }

  const legacyTemplate = panel.querySelector<HTMLTemplateElement>(LEGACY_TIMELINE_ROOT_TEMPLATE_SELECTOR)
  if (!legacyTemplate) {
    return false
  }

  container.append(legacyTemplate.content.cloneNode(true))
  legacyTemplate.remove()
  return true
}
