import { prefetchHomeCharacterBatches } from '#features/home/commission/batch/homeCharacterBatchClient'
import { normalizeHomeCharacterTargetId } from '#features/home/commission/batch/homeCharacterBatchManifest'
import {
  hasDeferredActiveCharacterTarget,
  readActiveCharactersLoadedBatchCount,
  resolveDeferredActiveCharacterBatch,
} from '#features/home/commission/loader/activeCharactersEvent'
import {
  hasArchivedCharacterTarget,
  readArchivedCharactersLoadedBatchCount,
  resolveDeferredArchivedCharacterBatch,
} from '#features/home/commission/loader/archivedCharactersEvent'

function resolveTargetSectionId(rawTargetId: string | null | undefined) {
  return normalizeHomeCharacterTargetId(rawTargetId) || null
}

export function prefetchDeferredActiveCharacterTarget(doc: Document, targetId: string | null | undefined) {
  if (!hasDeferredActiveCharacterTarget(doc, targetId))
    return

  const batchIndex = resolveDeferredActiveCharacterBatch(doc, targetId)
  if (batchIndex === null)
    return

  prefetchHomeCharacterBatches({
    doc,
    startBatchIndex: readActiveCharactersLoadedBatchCount(doc),
    status: 'active',
    targetBatchIndex: batchIndex,
  })
}

export function prefetchDeferredArchivedCharacterTarget(doc: Document, targetId: string | null | undefined) {
  const sectionId = resolveTargetSectionId(targetId)
  if (sectionId && doc.getElementById(sectionId))
    return
  if (!hasArchivedCharacterTarget(doc, targetId))
    return

  const batchIndex = resolveDeferredArchivedCharacterBatch(doc, targetId)
  if (batchIndex === null)
    return

  prefetchHomeCharacterBatches({
    doc,
    startBatchIndex: readArchivedCharactersLoadedBatchCount(doc),
    status: 'archived',
    targetBatchIndex: batchIndex,
  })
}
