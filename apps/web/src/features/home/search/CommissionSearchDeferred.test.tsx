// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCommissionSearch } = vi.hoisted(() => ({
  mockCommissionSearch: vi.fn(),
}))

vi.mock('@features/home/search/CommissionSearch', () => ({
  default: (props: Record<string, unknown>) => {
    mockCommissionSearch(props)
    const popularKeywords = (props.popularKeywords as string[] | undefined) ?? []
    const rotateLabel = (props.refreshPopularSearchLabel as string | undefined) ?? 'Refresh'
    const onRotate = props.onRotatePopularKeywords as (() => void) | undefined

    return (
      <div data-testid="commission-search">
        <div data-testid="commission-search-defer-flag">{String(props.deferIndexInit)}</div>
        {onRotate
          ? (
              <button type="button" onClick={onRotate}>
                {rotateLabel}
              </button>
            )
          : null}
        {popularKeywords.map(keyword => (
          <button key={keyword} type="button">
            {keyword}
          </button>
        ))}
      </div>
    )
  },
}))

describe('commissionSearchDeferred', () => {
  const appendedEntries: HTMLElement[] = []
  let fetchMock: ReturnType<typeof vi.fn>
  const appendSearchEntry = (searchSuggest: string) => {
    const element = document.createElement('article')
    element.dataset.commissionEntry = 'true'
    element.dataset.searchSuggest = searchSuggest
    element.dataset.searchText = searchSuggest.replaceAll('\n', ' ').toLowerCase()
    element.dataset.commissionSearchKey = `visible-${appendedEntries.length}`
    document.body.appendChild(element)
    appendedEntries.push(element)
  }

  const appendArchivedTemplateEntry = ({
    searchText,
    searchSuggest,
  }: {
    searchText: string
    searchSuggest: string
  }) => {
    const template = document.createElement('template')
    template.dataset.archivedSectionsTemplate = 'true'
    template.innerHTML = `
      <section>
        <article
          data-commission-entry="true"
          data-commission-search-key="archived-template"
          data-search-text="${searchText}"
          data-search-suggest="${searchSuggest}"
        ></article>
      </section>
    `
    document.body.appendChild(template)
    appendedEntries.push(template)
  }

  const appendActiveTemplateEntry = ({
    searchText,
    searchSuggest,
  }: {
    searchText: string
    searchSuggest: string
  }) => {
    const template = document.createElement('template')
    template.dataset.activeSectionsTemplate = 'true'
    template.innerHTML = `
      <section>
        <article
          data-commission-entry="true"
          data-commission-search-key="active-template"
          data-search-text="${searchText}"
          data-search-suggest="${searchSuggest}"
        ></article>
      </section>
    `
    document.body.appendChild(template)
    appendedEntries.push(template)
  }

  beforeEach(() => {
    mockCommissionSearch.mockClear()
    window.history.replaceState(null, '', '/')
    fetchMock = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    appendedEntries.splice(0).forEach(element => element.remove())
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('renders the real search immediately and keeps deferIndexInit disabled', async () => {
    const { default: CommissionSearchDeferred } = await loadDeferredModule()

    render(<CommissionSearchDeferred />)

    expect(screen.getByTestId('commission-search')).toBeInTheDocument()
    expect(screen.getByTestId('commission-search-defer-flag')).toHaveTextContent('false')
    expect(mockCommissionSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        deferIndexInit: false,
      }),
    )
  })

  it('passes template-backed active and archived entries to search in development', async () => {
    const { default: CommissionSearchDeferred } = await loadDeferredModule()

    appendSearchEntry('Keyword\tvisible')
    appendActiveTemplateEntry({
      searchText: 'activeword hidden',
      searchSuggest: 'Character\tActive',
    })
    appendArchivedTemplateEntry({
      searchText: 'archivedword hidden',
      searchSuggest: 'Character\tArchived',
    })

    render(<CommissionSearchDeferred />)

    await waitFor(() => {
      expect(mockCommissionSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          externalEntries: expect.arrayContaining([
            expect.objectContaining({
              domKey: 'active-template',
              searchText: 'activeword hidden',
            }),
            expect.objectContaining({
              domKey: 'archived-template',
              searchText: 'archivedword hidden',
            }),
          ]),
        }),
      )
    })
  })

  it('loads the full search index route and overrides the initial dom seed', async () => {
    const fetchedEntries = [
      {
        id: 0,
        domKey: 'visible-0',
        searchText: 'keyword visible',
        searchSuggest: 'Keyword\tvisible',
      },
      {
        id: 1,
        domKey: 'fetched-only',
        searchText: 'keyword fetched-only',
        searchSuggest: 'Keyword\tfetched-only',
      },
    ]
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(fetchedEntries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { default: CommissionSearchDeferred } = await loadDeferredModule()

    appendSearchEntry('Keyword\tvisible')

    render(<CommissionSearchDeferred />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/search/home-search-entries.json')
      expect(mockCommissionSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          externalEntries: fetchedEntries,
        }),
      )
    })
  })

  it('shows only one keyword alias variant in a popular batch', async () => {
    const { default: CommissionSearchDeferred } = await loadDeferredModule()

    appendSearchEntry(['Keyword\tmaid', 'Keyword\t女仆', 'Keyword\tkimono'].join('\n'))
    appendSearchEntry(['Keyword\tmaid', 'Keyword\t女仆', 'Keyword\tapron'].join('\n'))

    render(
      <CommissionSearchDeferred suggestionAliasGroups={[{ term: 'maid', aliases: ['女仆'] }]} />,
    )

    await waitFor(() => {
      const visibleKeywordVariants = ['maid', '女仆'].filter(term =>
        screen.queryByRole('button', { name: term }),
      )
      expect(visibleKeywordVariants).toHaveLength(1)
    })
  })

  it('prioritizes featured keywords first, then rotates into pooled keywords', async () => {
    const { default: CommissionSearchDeferred } = await loadDeferredModule()

    appendSearchEntry('Keyword\taa')
    appendSearchEntry('Keyword\tbb')
    appendSearchEntry('Keyword\tcc')
    appendSearchEntry('Keyword\tdd')
    appendSearchEntry('Keyword\tee')
    appendSearchEntry('Keyword\tff')
    appendSearchEntry('Keyword\tgg')

    render(
      <CommissionSearchDeferred
        featuredKeywords={['alpha', 'beta', 'gamma', 'delta', 'epsilon']}
      />,
    )

    expect(screen.getByRole('button', { name: 'alpha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'beta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'gamma' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'delta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'epsilon' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh popular keywords' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'alpha' })).not.toBeInTheDocument()
      const visiblePoolKeywords = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg'].filter(keyword =>
        screen.queryByRole('button', { name: keyword }),
      )
      expect(visiblePoolKeywords).toHaveLength(6)
    })
  })
})

async function loadDeferredModule() {
  vi.resetModules()
  return import('./CommissionSearchDeferred')
}
