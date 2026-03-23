export type UnpublishedInterestIconState = 'default' | 'recorded'

interface UnpublishedInterestIconMarkupOptions {
  state: UnpublishedInterestIconState
  hidden?: boolean
}

interface IconPathAttributes {
  d: string
  fill?: string
  stroke?: string
}

const ICON_CLASS = 'size-4 shrink-0'
const ICON_PATHS_BY_STATE: Record<UnpublishedInterestIconState, IconPathAttributes[]> = {
  default: [
    {
      d: 'M0 0h24v24H0z',
      fill: 'none',
      stroke: 'none',
    },
    {
      d: 'M12 20l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.96 6.053',
    },
    {
      d: 'M16 19h6',
    },
    {
      d: 'M19 16v6',
    },
  ],
  recorded: [
    {
      d: 'M0 0h24v24H0z',
      fill: 'none',
      stroke: 'none',
    },
    {
      d: 'M19.5 12.572l-3 2.928m-5.5 3.5a8916.99 8916.99 0 0 0 -6.5 -6.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
    },
    {
      d: 'M15 19l2 2l4 -4',
    },
  ],
}

function normalizeIconMarkup({
  hidden = false,
  state,
}: UnpublishedInterestIconMarkupOptions) {
  const className = `
    ${hidden ? 'hidden' : ''}
    ${ICON_CLASS}
  `
  const paths = ICON_PATHS_BY_STATE[state]
    .map(({ d, fill, stroke }) => {
      const attrs = [`d="${d}"`]

      if (fill) {
        attrs.push(`fill="${fill}"`)
      }

      if (stroke) {
        attrs.push(`stroke="${stroke}"`)
      }

      return `<path ${attrs.join(' ')} />`
    })
    .join('')

  return `
    <svg
      data-commission-interest-icon="${state}"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="${className}"
    >${paths}</svg>
  `
}

export function getUnpublishedInterestIconMarkup(options: UnpublishedInterestIconMarkupOptions) {
  return normalizeIconMarkup(options)
}

export function createUnpublishedInterestIconElement({
  doc = document,
  hidden = false,
  state,
}: UnpublishedInterestIconMarkupOptions & { doc?: Document }) {
  const template = doc.createElement('template')
  template.innerHTML = getUnpublishedInterestIconMarkup({ state, hidden }).trim()
  const icon = template.content.firstElementChild

  if (!(icon instanceof SVGSVGElement)) {
    throw new TypeError(`Invalid unpublished interest icon markup for state "${state}"`)
  }

  return icon
}
