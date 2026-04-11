// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initSearchController } from './commissionSearchController'

vi.mock('@features/home/commission/batch/homeCharacterBatchClient', () => ({
  getHomeCharacterBatchTotalCount: () => 0,
  prefetchHomeCharacterBatches: vi.fn(),
}))

vi.mock('@features/home/commission/loader/activeCharactersEvent', () => ({
  readActiveCharactersLoadedBatchCount: () => 0,
  requestActiveCharactersLoad: vi.fn(),
}))

vi.mock('@features/home/commission/loader/archivedCharactersEvent', () => ({
  readArchivedCharactersLoadedBatchCount: () => 0,
  requestArchivedCharactersLoad: vi.fn(),
  requestArchivedCharactersVisibility: vi.fn(),
}))

vi.mock('@features/home/commission/loader/timelineViewEvent', () => ({
  requestTimelineViewLoad: vi.fn(),
}))

vi.mock('@features/home/search/commissionSearchDeferred', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./commissionSearchDeferred')>()
  return {
    ...actual,
    buildPopularKeywordPoolFromEntries: () => [],
    buildSearchEntriesFromDom: () => [],
    ensureHomeSearchEntriesPromise: () => Promise.resolve([]),
    getCachedHomeSearchEntries: () => null,
  }
})

vi.mock('@features/home/search/commissionSearchPanelState', () => ({
  readPanelLoadedState: () => ({
    activeLoaded: true,
    activeBatchCount: 0,
    archivedLoaded: true,
    archivedVisible: false,
    archivedBatchCount: 0,
    timelineLoaded: true,
  }),
  subscribePanelState: () => () => {},
}))

function mountSearchRoot() {
  document.body.innerHTML = `
    <section
      id="commission-search"
      data-featured-keywords="[]"
      data-suggestion-alias-groups="[]"
    >
      <div role="combobox">
        <input id="commission-search-input" value="" />
        <ul id="search-suggestion-list"></ul>
      </div>
      <button id="search-help-trigger"></button>
      <button id="search-copy-url"></button>
      <button id="search-clear"></button>
      <div id="search-popular-keywords"></div>
      <ul id="search-keyword-list"></ul>
      <p id="search-live-region"></p>
    </section>
  `

  return document.getElementById('commission-search')!
}

describe('initSearchController', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0)
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    document.body.innerHTML = ''
    window.history.replaceState(null, '', '/')
  })

  it('hydrates the input from the q URL parameter', async () => {
    window.history.replaceState(null, '', '/?q=isj+20250322')
    const root = mountSearchRoot()

    const cleanup = initSearchController(root)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(document.querySelector<HTMLInputElement>('#commission-search-input')?.value)
      .toBe('isj 20250322')

    cleanup?.()
  })
})
