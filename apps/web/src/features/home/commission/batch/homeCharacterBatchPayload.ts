import type { HomeCharacterBatchStatus } from '@features/home/server/homeCharacterBatches'
import type { BatchEntryPayload, BatchImagePayload, BatchInterestPayload, BatchLinkPayload } from './batchPayload'

export type HomeCharacterBatchImagePayload = BatchImagePayload
export type HomeCharacterBatchLinkPayload = BatchLinkPayload
export type HomeCharacterBatchInterestPayload = BatchInterestPayload
export type HomeCharacterBatchEntryPayload = BatchEntryPayload

export interface HomeCharacterBatchSectionPayload {
  displayName: string
  status: HomeCharacterBatchStatus
  sectionId: string
  titleId: string
  sectionHash: string
  totalCommissions: number
  toBeAnnouncedText: string
  entries: HomeCharacterBatchEntryPayload[]
}

export interface HomeCharacterBatchPayload {
  batchIndex: number
  sections: HomeCharacterBatchSectionPayload[]
  status: HomeCharacterBatchStatus
}
