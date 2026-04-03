import type { HomeTimelineBatchManifest } from '@features/home/server/homeTimelineBatches'
import { normalizeBatchTargetId } from './batchManifest'

const MANIFEST_SELECTOR = 'script[data-home-timeline-batch-manifest="true"]'
const TIMELINE_PANEL_SELECTOR = '[data-commission-view-panel="timeline"]'

let manifestCache = new WeakMap<Document, HomeTimelineBatchManifest | null>()

export function hasConnectedTimelinePanelTargetId(doc: Document, targetId: string) {
  const element = doc.getElementById(targetId)
  return element?.isConnected === true && element.closest(TIMELINE_PANEL_SELECTOR) !== null
}

export { normalizeBatchTargetId as normalizeHomeTimelineTargetId }

export function readHomeTimelineBatchManifest(doc?: Document): HomeTimelineBatchManifest | null {
  const resolvedDocument = doc ?? (typeof document !== 'undefined' ? document : null)
  if (!resolvedDocument)
    return null

  if (manifestCache.has(resolvedDocument)) {
    return manifestCache.get(resolvedDocument) ?? null
  }

  const script = resolvedDocument.querySelector<HTMLScriptElement>(MANIFEST_SELECTOR)
  if (!script?.textContent) {
    manifestCache.set(resolvedDocument, null)
    return null
  }

  try {
    const manifest = JSON.parse(script.textContent) as HomeTimelineBatchManifest
    manifestCache.set(resolvedDocument, manifest)
    return manifest
  }
  catch {
    manifestCache.set(resolvedDocument, null)
    return null
  }
}

export function clearHomeTimelineBatchManifestCacheForTests(doc?: Document) {
  if (doc) {
    manifestCache.delete(doc)
    return
  }

  manifestCache = new WeakMap<Document, HomeTimelineBatchManifest | null>()
}

export function hasDeferredHomeTimelineTarget({
  doc,
  rawTargetId,
}: {
  doc: Document
  rawTargetId: string | null | undefined
}) {
  const targetId = normalizeBatchTargetId(rawTargetId)
  if (!targetId)
    return false
  if (hasConnectedTimelinePanelTargetId(doc, targetId))
    return false

  const manifest = readHomeTimelineBatchManifest(doc)
  return manifest ? targetId in manifest.targetBatchById : false
}

export function resolveHomeTimelineTargetBatch({
  doc,
  rawTargetId,
}: {
  doc: Document
  rawTargetId: string | null | undefined
}) {
  const targetId = normalizeBatchTargetId(rawTargetId)
  if (!targetId)
    return null
  if (hasConnectedTimelinePanelTargetId(doc, targetId))
    return null

  const manifest = readHomeTimelineBatchManifest(doc)
  if (!manifest)
    return null

  const batchIndex = manifest.targetBatchById[targetId]
  return Number.isInteger(batchIndex) ? batchIndex : null
}

export async function fetchFreshHomeTimelineBatchManifest(doc?: Document): Promise<HomeTimelineBatchManifest | null> {
  try {
    const locale = readHomeTimelineBatchManifest(doc)?.locale ?? 'en'
    const response = await fetch(`/search/home-timeline-manifest/${locale}.json?_t=${Date.now()}`)
    if (!response.ok)
      return null
    return (await response.json()) as HomeTimelineBatchManifest
  }
  catch {
    return null
  }
}
