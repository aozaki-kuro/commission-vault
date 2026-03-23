import type { BatchEntryPayload, BatchImagePayload, BatchInterestPayload, BatchLinkPayload } from './batchPayload'

export type HomeTimelineBatchImagePayload = BatchImagePayload
export type HomeTimelineBatchLinkPayload = BatchLinkPayload
export type HomeTimelineBatchInterestPayload = BatchInterestPayload
export type HomeTimelineBatchEntryPayload = BatchEntryPayload

export interface HomeTimelineBatchSectionPayload {
  yearKey: string
  sectionId: string
  titleId: string
  sectionHash: string
  totalCommissions: number
  entries: HomeTimelineBatchEntryPayload[]
}

export interface HomeTimelineBatchPayload {
  batchIndex: number
  sections: HomeTimelineBatchSectionPayload[]
}
