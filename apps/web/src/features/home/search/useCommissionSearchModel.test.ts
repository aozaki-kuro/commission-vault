// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  dispatchSearchQueryLocationChange,
  getDomSnapshotKeyForMode,
  resolveEffectiveDomSnapshotKey,
  subscribeToUrlQuerySnapshot,
} from './useCommissionSearchModel'

describe('getDomSnapshotKeyForMode', () => {
  it('changes character snapshot key when activeLoaded or archivedLoaded changes', () => {
    const before = getDomSnapshotKeyForMode({
      activeBatchCount: 0,
      activeLoaded: false,
      mode: 'character',
      archivedBatchCount: 0,
      archivedLoaded: false,
      archivedVisible: false,
      timelineLoaded: false,
    })
    const unrelatedTimelineChange = getDomSnapshotKeyForMode({
      activeBatchCount: 0,
      activeLoaded: false,
      mode: 'character',
      archivedBatchCount: 0,
      archivedLoaded: false,
      archivedVisible: false,
      timelineLoaded: true,
    })
    const activeBatchChange = getDomSnapshotKeyForMode({
      activeBatchCount: 1,
      activeLoaded: false,
      mode: 'character',
      archivedBatchCount: 0,
      archivedLoaded: false,
      archivedVisible: false,
      timelineLoaded: true,
    })
    const activeChange = getDomSnapshotKeyForMode({
      activeBatchCount: 1,
      activeLoaded: true,
      mode: 'character',
      archivedBatchCount: 0,
      archivedLoaded: false,
      archivedVisible: false,
      timelineLoaded: true,
    })
    const archivedVisibleChange = getDomSnapshotKeyForMode({
      activeBatchCount: 1,
      activeLoaded: true,
      mode: 'character',
      archivedBatchCount: 0,
      archivedLoaded: false,
      archivedVisible: true,
      timelineLoaded: true,
    })
    const archivedBatchChange = getDomSnapshotKeyForMode({
      activeBatchCount: 1,
      activeLoaded: true,
      mode: 'character',
      archivedBatchCount: 1,
      archivedLoaded: false,
      archivedVisible: true,
      timelineLoaded: true,
    })
    const archivedChange = getDomSnapshotKeyForMode({
      activeBatchCount: 1,
      activeLoaded: true,
      mode: 'character',
      archivedBatchCount: 2,
      archivedLoaded: true,
      archivedVisible: true,
      timelineLoaded: true,
    })

    expect(before).toBe(unrelatedTimelineChange)
    expect(activeBatchChange).not.toBe(before)
    expect(activeChange).not.toBe(activeBatchChange)
    expect(archivedVisibleChange).not.toBe(activeChange)
    expect(archivedBatchChange).not.toBe(archivedVisibleChange)
    expect(archivedChange).not.toBe(archivedBatchChange)
  })

  it('changes timeline snapshot key only when timelineLoaded changes', () => {
    const before = getDomSnapshotKeyForMode({
      activeBatchCount: 0,
      activeLoaded: false,
      mode: 'timeline',
      archivedBatchCount: 0,
      archivedLoaded: false,
      archivedVisible: false,
      timelineLoaded: false,
    })
    const unrelatedArchivedChange = getDomSnapshotKeyForMode({
      activeBatchCount: 2,
      activeLoaded: true,
      mode: 'timeline',
      archivedBatchCount: 3,
      archivedLoaded: true,
      archivedVisible: true,
      timelineLoaded: false,
    })
    const timelineChange = getDomSnapshotKeyForMode({
      activeBatchCount: 2,
      activeLoaded: true,
      mode: 'timeline',
      archivedBatchCount: 3,
      archivedLoaded: true,
      archivedVisible: true,
      timelineLoaded: true,
    })

    expect(before).toBe(unrelatedArchivedChange)
    expect(timelineChange).not.toBe(before)
  })
})

describe('resolveEffectiveDomSnapshotKey', () => {
  it('uses a stable key when dom context is skipped', () => {
    const first = resolveEffectiveDomSnapshotKey({
      domSnapshotKey: 'character:archived-hidden',
      skipDomContext: true,
    })
    const second = resolveEffectiveDomSnapshotKey({
      domSnapshotKey: 'character:archived-loaded',
      skipDomContext: true,
    })

    expect(first).toBe('skip-dom-context')
    expect(second).toBe(first)
  })
})

describe('subscribeToUrlQuerySnapshot', () => {
  it('notifies listeners for explicit location query updates', () => {
    const onStoreChange = vi.fn()
    const unsubscribe = subscribeToUrlQuerySnapshot(onStoreChange)

    dispatchSearchQueryLocationChange()

    expect(onStoreChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
