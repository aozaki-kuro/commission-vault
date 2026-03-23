import type {
  HomeCharacterBatchPayload,
  HomeCharacterBatchSectionPayload,
} from '#features/home/commission/batch/homeCharacterBatchPayload'
import {
  renderEntry,
  SECTION_CLASS,
  TITLE_LINK_CLASS,
} from './batchRender'

const TITLE_CLASS = 'group relative mb-2 pt-6 md:pt-8'
const EMPTY_STATE_CLASS = 'my-4'

function renderSection(section: HomeCharacterBatchSectionPayload) {
  const root = document.createElement('div')
  root.id = section.sectionId
  root.dataset.characterSection = 'true'
  root.dataset.characterStatus = section.status
  root.dataset.totalCommissions = String(section.totalCommissions)
  root.className = SECTION_CLASS

  const title = document.createElement('h2')
  title.id = section.titleId
  title.className = TITLE_CLASS
  title.style.animation = 'reveal-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both'
  title.append(document.createTextNode(section.displayName))

  const anchor = document.createElement('a')
  anchor.href = section.sectionHash
  anchor.className = TITLE_LINK_CLASS
  anchor.textContent = '#'
  title.append(anchor)
  root.append(title)

  if (section.entries.length === 0) {
    const emptyState = document.createElement('p')
    emptyState.className = EMPTY_STATE_CLASS
    emptyState.textContent = section.toBeAnnouncedText
    root.append(emptyState)
    return root
  }

  section.entries.forEach((entry) => {
    root.append(renderEntry(entry))
  })

  return root
}

export function renderHomeCharacterBatchPayload(payload: HomeCharacterBatchPayload) {
  const fragment = document.createDocumentFragment()
  payload.sections.forEach((section) => {
    fragment.append(renderSection(section))
  })
  return fragment
}
