import type {
  HomeTimelineBatchPayload,
  HomeTimelineBatchSectionPayload,
} from '@features/home/commission/batch/homeTimelineBatchPayload'
import {
  renderEntry,
  SECTION_CLASS,
  TITLE_LINK_CLASS,
} from './batchRender'

const TITLE_WRAPPER_CLASS = 'mb-2 pt-6 md:pt-8'
const TITLE_CLASS = 'group relative'

function renderSection(section: HomeTimelineBatchSectionPayload) {
  const root = document.createElement('section')
  root.id = section.sectionId
  root.dataset.characterSection = 'true'
  root.dataset.totalCommissions = String(section.totalCommissions)
  root.className = SECTION_CLASS

  const titleWrapper = document.createElement('div')
  titleWrapper.id = section.titleId
  titleWrapper.className = TITLE_WRAPPER_CLASS

  const title = document.createElement('h2')
  title.className = TITLE_CLASS
  title.style.animation = 'reveal-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both'
  title.append(document.createTextNode(section.yearKey))

  const anchor = document.createElement('a')
  anchor.href = section.sectionHash
  anchor.className = TITLE_LINK_CLASS
  anchor.textContent = '#'
  title.append(anchor)

  titleWrapper.append(title)
  root.append(titleWrapper)

  section.entries.forEach((entry) => {
    root.append(renderEntry(entry))
  })

  return root
}

export function renderHomeTimelineBatchPayload(payload: HomeTimelineBatchPayload) {
  const fragment = document.createDocumentFragment()
  payload.sections.forEach((section) => {
    fragment.append(renderSection(section))
  })
  return fragment
}
