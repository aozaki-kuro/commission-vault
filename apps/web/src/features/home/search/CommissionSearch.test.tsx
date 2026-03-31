import type { CommissionSearchEntrySource } from './CommissionSearch'
import { clearHomeCharacterBatchRequestCacheForTests } from '@features/home/commission/batch/homeCharacterBatchClient'
import { clearHomeCharacterBatchManifestCacheForTests } from '@features/home/commission/batch/homeCharacterBatchManifest'
import { ACTIVE_CHARACTERS_LOAD_REQUEST_EVENT } from '@features/home/commission/loader/activeCharactersEvent'
import {
  ARCHIVED_CHARACTERS_COLLAPSE_REQUEST_EVENT,
  ARCHIVED_CHARACTERS_LOAD_REQUEST_EVENT,
  ARCHIVED_CHARACTERS_LOADED_EVENT,
  ARCHIVED_CHARACTERS_SHOW_REQUEST_EVENT,
  ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT,
} from '@features/home/commission/loader/archivedCharactersEvent'
import { ANALYTICS_EVENTS } from '@lib/analytics/events'
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import CommissionSearch from './CommissionSearch'

const { mockTrackRybbitEvent } = vi.hoisted(() => ({
  mockTrackRybbitEvent: vi.fn(),
}))

vi.mock('@lib/analytics/track', () => ({
  trackRybbitEvent: (...args: unknown[]) => mockTrackRybbitEvent(...args),
}))

function renderSearch(externalEntries: CommissionSearchEntrySource[]) {
  return render(<CommissionSearch disableDomFiltering externalEntries={externalEntries} />)
}

function renderSearchWithProps(externalEntries: CommissionSearchEntrySource[], props: Partial<NonNullable<Parameters<typeof CommissionSearch>[0]>> = {}) {
  return render(<CommissionSearch disableDomFiltering externalEntries={externalEntries} {...props} />)
}

function renderSearchWithDomFiltering(externalEntries: CommissionSearchEntrySource[]) {
  return render(<CommissionSearch externalEntries={externalEntries} />)
}

describe('commissionSearch', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
        writable: true,
      })
    }
  })

  afterEach(() => {
    clearHomeCharacterBatchRequestCacheForTests()
    clearHomeCharacterBatchManifestCacheForTests(document)
    document.body.innerHTML = ''
  })

  it('applies suggestion from command list', async () => {
    mockTrackRybbitEvent.mockClear()
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'test-character::20240101_sample',
        searchText: 'alice sample tag',
        searchSuggest: 'Character\tAlice\nKeyword\ttag',
      },
    ]

    try {
      renderSearch(entries)

      const input = screen.getByLabelText('Search commissions') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.input(input, { target: { value: 'ali' } })

      await waitFor(() => {
        const controlsId = input.getAttribute('aria-controls')
        expect(controlsId).toBeTruthy()
        expect(document.getElementById(controlsId!)).toBeInTheDocument()
        expect(input).toHaveAttribute('aria-expanded', 'true')
      })

      fireEvent.click(screen.getByText('Alice'))

      expect(input.value).toContain('Alice')
      expect(
        dispatchEventSpy.mock.calls.some(
          ([event]) =>
            event instanceof Event && event.type === ARCHIVED_CHARACTERS_COLLAPSE_REQUEST_EVENT,
        ),
      ).toBe(false)
      await waitFor(() => {
        expect(mockTrackRybbitEvent).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.searchUsed,
          expect.objectContaining({
            source: 'input',
          }),
        )
      })
      const searchEventPayload = mockTrackRybbitEvent.mock.calls.find(
        ([eventName]) => eventName === ANALYTICS_EVENTS.searchUsed,
      )?.[1] as Record<string, unknown> | undefined
      expect(searchEventPayload).toBeDefined()
      expect(searchEventPayload).not.toHaveProperty('result_count')
      expect(searchEventPayload).not.toHaveProperty('query_length')
      expect(searchEventPayload).not.toHaveProperty('trackable_query_length')
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })

  it('requests deferred active sections when character search starts with dom filtering', async () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    document.body.innerHTML = `
      <div
        data-commission-view-panel="character"
        data-commission-view-active="true"
        data-active-sections-loaded="false"
        data-archived-loaded="false"
        data-archived-visibility="hidden"
      ></div>
    `

    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'section-alpha::20240101_alice',
        searchText: 'alice sample',
        searchSuggest: 'Character\tAlice',
      },
    ]

    try {
      renderSearchWithDomFiltering(entries)

      fireEvent.input(screen.getByLabelText('Search commissions'), {
        target: { value: 'ali' },
      })

      await waitFor(() => {
        expect(
          dispatchEventSpy.mock.calls.some(
            ([event]) =>
              event instanceof Event && event.type === ACTIVE_CHARACTERS_LOAD_REQUEST_EVENT,
          ),
        ).toBe(true)
      })
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })

  it('keeps popular keyword chips visible and applies selected keyword', async () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'test-character::20240101_kanaut',
        searchText: 'kanaut nishe sample',
        searchSuggest: 'Creator\tKanaut Nishe\nKeyword\tsample',
      },
    ]

    try {
      renderSearchWithProps(entries, {
        popularKeywords: ['Kanaut Nishe', 'sample'],
        refreshPopularSearchLabel: 'Refresh popular keywords',
        onRotatePopularKeywords: vi.fn(),
      })

      expect(screen.getByRole('button', { name: 'Refresh popular keywords' })).toBeInTheDocument()

      const input = screen.getByLabelText('Search commissions') as HTMLInputElement
      fireEvent.click(screen.getByRole('button', { name: 'Kanaut Nishe' }))

      await waitFor(() => {
        expect(input.value).toBe('"Kanaut Nishe" ')
      })
      expect(
        dispatchEventSpy.mock.calls.some(
          ([event]) =>
            event instanceof Event && event.type === ARCHIVED_CHARACTERS_COLLAPSE_REQUEST_EVENT,
        ),
      ).toBe(false)
      expect(document.querySelector('[cmdk-list]')).not.toBeInTheDocument()

      expect(screen.getByRole('button', { name: 'Kanaut Nishe' })).toBeInTheDocument()
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })

  it('does not refocus input when selecting popular keyword on coarse pointers', async () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    try {
      const entries: CommissionSearchEntrySource[] = [
        {
          id: 1,
          domKey: 'test-character::20240101_kanaut',
          searchText: 'kanaut nishe sample',
          searchSuggest: 'Creator\tKanaut Nishe\nKeyword\tsample',
        },
      ]

      renderSearchWithProps(entries, {
        popularKeywords: ['Kanaut Nishe'],
      })

      const input = screen.getByLabelText('Search commissions') as HTMLInputElement
      fireEvent.click(screen.getByRole('button', { name: 'Kanaut Nishe' }))

      await waitFor(() => {
        expect(input.value).toBe('"Kanaut Nishe" ')
      })
      expect(input).not.toHaveFocus()
    }
    finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('refocuses input after clearing query on desktop pointers', async () => {
    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'test-character::20240101_alpha',
        searchText: 'alpha sample',
      },
    ]

    renderSearch(entries)

    const input = screen.getByLabelText('Search commissions') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'alpha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    await waitFor(() => {
      expect(input.value).toBe('')
    })
    expect(input).toHaveFocus()
  })

  it('does not refocus input after clearing query on coarse pointers', async () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    try {
      const entries: CommissionSearchEntrySource[] = [
        {
          id: 1,
          domKey: 'test-character::20240101_alpha',
          searchText: 'alpha sample',
        },
      ]

      renderSearch(entries)

      const input = screen.getByLabelText('Search commissions') as HTMLInputElement
      fireEvent.input(input, { target: { value: 'alpha' } })
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

      await waitFor(() => {
        expect(input.value).toBe('')
      })
      expect(input).not.toHaveFocus()
    }
    finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('keeps the archived divider hidden after clearing search while archived sections stay collapsed', async () => {
    document.body.innerHTML = `
      <div
        data-commission-view-panel="character"
        data-commission-view-active="true"
        data-active-sections-loaded="true"
        data-archived-loaded="false"
        data-archived-visibility="hidden"
        data-archived-batches-loaded-count="0"
      >
        <section id="active" data-character-section="true" data-character-status="active">
          <div data-commission-entry="true" data-character-section-id="active" data-commission-search-key="active::20240101_alpha"></div>
        </section>
        <div data-archived-sections-placeholder="true">Archived Characters</div>
        <div data-archived-divider="true" class="hidden"><hr /></div>
      </div>
    `

    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'active::20240101_alpha',
        searchText: 'alpha',
      },
      {
        id: 2,
        domKey: 'archived::20240102_beta',
        searchText: 'beta',
      },
    ]

    renderSearchWithDomFiltering(entries)

    const input = screen.getByLabelText('Search commissions') as HTMLInputElement
    const archivedDivider = document.querySelector<HTMLElement>('[data-archived-divider="true"]')
    expect(archivedDivider).toHaveClass('hidden')

    fireEvent.input(input, { target: { value: 'alpha' } })

    await waitFor(() => {
      expect(screen.getByText('Search results: 1 of 1 commissions shown.')).toBeInTheDocument()
    })
    expect(archivedDivider).toHaveClass('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    await waitFor(() => {
      expect(input.value).toBe('')
    })
    expect(archivedDivider).toHaveClass('hidden')
  })

  it('shows shared alias suffix for keyword and character suggestions', async () => {
    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'test-character::20240101_nanashi',
        searchText: 'nanashi sample',
        searchSuggest: 'Character\tNanashi\nCreator\tNanashi\nKeyword\tsample',
      },
      {
        id: 2,
        domKey: 'test-character::20240102_aitsuki',
        searchText: 'aitsuki nakuru sample',
        searchSuggest: 'Character\tAitsuki Nakuru\nKeyword\tAitsuki Nakuru',
      },
    ]

    renderSearchWithProps(entries, {
      suggestionAliasGroups: [
        { term: 'Nanashi', aliases: ['七市'] },
        { term: 'Aitsuki Nakuru', aliases: ['あいつき なくる'] },
        { term: 'Aitsuki Nakuru', aliases: ['should-not-show'] },
      ],
    })

    const input = screen.getByLabelText('Search commissions') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'nana' } })

    await waitFor(() => {
      expect(screen.getByText('(七市)')).toBeInTheDocument()
    })

    fireEvent.input(input, { target: { value: 'aitsuki' } })

    await waitFor(() => {
      expect(screen.getByText('(あいつき なくる)')).toBeInTheDocument()
    })
    expect(screen.queryByText('should-not-show')).not.toBeInTheDocument()
  })

  it('keeps archived entries searchable before load and reindexes after archived loaded event', async () => {
    document.body.innerHTML = `
      <div data-commission-view-panel="character" data-commission-view-active="true" data-archived-loaded="false">
        <section id="active" data-character-section="true" data-character-status="active">
          <div data-commission-entry="true" data-character-section-id="active" data-commission-search-key="active::20240101_alpha"></div>
        </section>
      </div>
    `

    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'active::20240101_alpha',
        searchText: 'alpha',
      },
      {
        id: 2,
        domKey: 'archived::20240102_archived',
        searchText: 'archivedword',
      },
    ]

    renderSearchWithDomFiltering(entries)

    const input = screen.getByLabelText('Search commissions') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'archivedword' } })

    await waitFor(() => {
      expect(
        screen.getAllByText(/Search results: 0 of 1 commissions shown\./).length,
      ).toBeGreaterThan(0)
    })
    expect(screen.getByText('1 archived match hidden.')).toBeInTheDocument()
    expect(screen.getByText('Load')).toBeInTheDocument()

    const panel = document.querySelector<HTMLElement>('[data-commission-view-panel="character"]')
    panel?.setAttribute('data-archived-loaded', 'true')
    const archivedSection = document.createElement('section')
    archivedSection.id = 'archived'
    archivedSection.dataset.characterSection = 'true'
    archivedSection.dataset.characterStatus = 'archived'
    archivedSection.innerHTML
      = '<div data-commission-entry="true" data-character-section-id="archived" data-commission-search-key="archived::20240102_archived"></div>'
    panel?.append(archivedSection)
    window.dispatchEvent(
      new CustomEvent(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, {
        detail: { visibility: 'visible', loaded: true },
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('Search results: 1 of 2 commissions shown.')).toBeInTheDocument()
    })
    expect(screen.queryByText('1 archived match hidden.')).not.toBeInTheDocument()
  })

  it('reapplies the active search filter as soon as archived batches mount', async () => {
    document.body.innerHTML = `
      <div
        data-commission-view-panel="character"
        data-commission-view-active="true"
        data-active-sections-loaded="true"
        data-archived-loaded="false"
        data-archived-visibility="hidden"
        data-archived-batches-loaded-count="0"
      >
        <section id="active" data-character-section="true" data-character-status="active">
          <div data-commission-entry="true" data-character-section-id="active" data-commission-search-key="active::20240101_alpha"></div>
        </section>
      </div>
    `

    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'active::20240101_alpha',
        searchText: 'alpha',
      },
      {
        id: 2,
        domKey: 'archived::20240102_beta',
        searchText: 'beta',
      },
    ]

    renderSearchWithDomFiltering(entries)

    const input = screen.getByLabelText('Search commissions') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'alpha' } })

    await waitFor(() => {
      expect(screen.getByText('Search results: 1 of 1 commissions shown.')).toBeInTheDocument()
    })

    const panel = document.querySelector<HTMLElement>('[data-commission-view-panel="character"]')
    panel?.setAttribute('data-archived-visibility', 'visible')
    panel?.setAttribute('data-archived-batches-loaded-count', '1')

    window.dispatchEvent(
      new CustomEvent(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, {
        detail: { visibility: 'visible', loaded: false },
      }),
    )

    const archivedSection = document.createElement('section')
    archivedSection.id = 'archived'
    archivedSection.dataset.characterSection = 'true'
    archivedSection.dataset.characterStatus = 'archived'
    archivedSection.innerHTML
      = '<div data-commission-entry="true" data-character-section-id="archived" data-commission-search-key="archived::20240102_beta"></div>'
    panel?.append(archivedSection)

    window.dispatchEvent(new Event(ARCHIVED_CHARACTERS_LOADED_EVENT))

    await waitFor(() => {
      expect(archivedSection.classList.contains('hidden')).toBe(true)
      expect(
        archivedSection
          .querySelector<HTMLElement>('[data-commission-entry="true"]')
          ?.classList
          .contains('hidden'),
      ).toBe(true)
    })
  })

  it('requests archived loading from the inline notice item on click', async () => {
    document.body.innerHTML = `
      <div data-commission-view-panel="character" data-commission-view-active="true" data-archived-loaded="false">
        <section id="active" data-character-section="true" data-character-status="active">
          <div data-commission-entry="true" data-character-section-id="active" data-commission-search-key="active::20240101_alpha"></div>
        </section>
      </div>
    `

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const entries: CommissionSearchEntrySource[] = [
      {
        id: 1,
        domKey: 'active::20240101_alpha',
        searchText: 'alpha',
      },
      {
        id: 2,
        domKey: 'archived::20240102_archived',
        searchText: 'archivedword',
      },
    ]

    try {
      renderSearchWithDomFiltering(entries)

      const input = screen.getByLabelText('Search commissions') as HTMLInputElement
      fireEvent.input(input, { target: { value: 'archivedword' } })

      const itemLabel = await screen.findByText('Load')
      fireEvent.click(itemLabel)

      expect(
        dispatchEventSpy.mock.calls.some(
          ([event]) => event instanceof Event && event.type === ARCHIVED_CHARACTERS_LOAD_REQUEST_EVENT,
        ),
      ).toBe(true)
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })

  it('auto-requests archived show when query only matches archived entries', async () => {
    document.body.innerHTML = `
      <div
        data-commission-view-panel="character"
        data-commission-view-active="true"
        data-archived-loaded="false"
        data-archived-visibility="hidden"
      >
        <section id="active-char" data-character-section="true" data-character-status="active">
          <div
            data-commission-entry="true"
            data-character-section-id="active-char"
            data-commission-search-key="active-char::20240101_alpha"
            data-search-text="alpha active"
          ></div>
        </section>
      </div>
    `

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const entries: CommissionSearchEntrySource[] = [
      { id: 1, domKey: 'active-char::20240101_alpha', searchText: 'alpha active' },
      { id: 2, domKey: 'archived-char::20240102_beta', searchText: 'betaword archived' },
    ]

    try {
      renderSearchWithDomFiltering(entries)

      fireEvent.input(screen.getByLabelText('Search commissions'), {
        target: { value: 'betaword' },
      })

      await waitFor(() => {
        expect(
          dispatchEventSpy.mock.calls.some(
            ([event]) =>
              event instanceof Event && event.type === ARCHIVED_CHARACTERS_SHOW_REQUEST_EVENT,
          ),
        ).toBe(true)
      })
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })

  it('does not auto-request archived show when query also matches active entries', async () => {
    document.body.innerHTML = `
      <div
        data-commission-view-panel="character"
        data-commission-view-active="true"
        data-archived-loaded="false"
        data-archived-visibility="hidden"
      >
        <section id="active-char" data-character-section="true" data-character-status="active">
          <div
            data-commission-entry="true"
            data-character-section-id="active-char"
            data-commission-search-key="active-char::20240101_alpha"
            data-search-text="sharedterm active"
          ></div>
        </section>
      </div>
    `

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const entries: CommissionSearchEntrySource[] = [
      { id: 1, domKey: 'active-char::20240101_alpha', searchText: 'sharedterm active' },
      { id: 2, domKey: 'archived-char::20240102_beta', searchText: 'sharedterm archived' },
    ]

    try {
      renderSearchWithDomFiltering(entries)

      fireEvent.input(screen.getByLabelText('Search commissions'), {
        target: { value: 'sharedterm' },
      })

      // Wait for the search to settle, then assert no auto-show
      await waitFor(() => {
        expect(screen.getByLabelText('Search commissions')).toHaveValue('sharedterm')
      })

      // Give any async effects time to fire
      await new Promise(r => setTimeout(r, 50))

      expect(
        dispatchEventSpy.mock.calls.some(
          ([event]) =>
            event instanceof Event && event.type === ARCHIVED_CHARACTERS_SHOW_REQUEST_EVENT,
        ),
      ).toBe(false)
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })

  it('does not auto-request archived show when archived section is already visible', async () => {
    document.body.innerHTML = `
      <div
        data-commission-view-panel="character"
        data-commission-view-active="true"
        data-archived-loaded="false"
        data-archived-visibility="visible"
      >
        <section id="active-char" data-character-section="true" data-character-status="active">
          <div
            data-commission-entry="true"
            data-character-section-id="active-char"
            data-commission-search-key="active-char::20240101_alpha"
            data-search-text="alpha active"
          ></div>
        </section>
      </div>
    `

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const entries: CommissionSearchEntrySource[] = [
      { id: 1, domKey: 'active-char::20240101_alpha', searchText: 'alpha active' },
      { id: 2, domKey: 'archived-char::20240102_beta', searchText: 'betaword archived' },
    ]

    try {
      renderSearchWithDomFiltering(entries)

      fireEvent.input(screen.getByLabelText('Search commissions'), {
        target: { value: 'betaword' },
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Search commissions')).toHaveValue('betaword')
      })

      await new Promise(r => setTimeout(r, 50))

      expect(
        dispatchEventSpy.mock.calls.some(
          ([event]) =>
            event instanceof Event && event.type === ARCHIVED_CHARACTERS_SHOW_REQUEST_EVENT,
        ),
      ).toBe(false)
    }
    finally {
      dispatchEventSpy.mockRestore()
    }
  })
})
