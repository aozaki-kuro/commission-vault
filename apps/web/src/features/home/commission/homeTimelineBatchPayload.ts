export interface HomeTimelineBatchImagePayload {
  src: string
  srcSet: string
  sizes: string
  width: number
  height: number
}

export interface HomeTimelineBatchLinkPayload {
  label: string
  url: string
}

export interface HomeTimelineBatchInterestPayload {
  key: string
  label: string
  title: string
  recordedLabel: string
  recordedTitle: string
}

export interface HomeTimelineBatchEntryPayload {
  id: string
  sectionId: string
  searchKey: string
  searchText: string
  searchSuggest: string
  altText: string
  image: HomeTimelineBatchImagePayload | null
  sourceImageNotFoundText: string
  timeLabel: string
  primaryText: string
  secondaryText: string | null
  links: HomeTimelineBatchLinkPayload[]
  interest: HomeTimelineBatchInterestPayload | null
}

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
