// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearHomeTimelineBatchRequestCacheForTests,
  fetchHomeTimelineBatch,
} from './homeTimelineBatchClient'
import { clearHomeTimelineBatchManifestCacheForTests } from './homeTimelineBatchManifest'

function renderManifest() {
  document.body.innerHTML = `
    <script type="application/json" data-home-timeline-batch-manifest="true">
      {"locale":"en","initialSectionIds":["timeline-year-2026"],"totalBatches":2,"targetBatchById":{}}
    </script>
  `
  clearHomeTimelineBatchManifestCacheForTests(document)
}

describe('fetchHomeTimelineBatch', () => {
  afterEach(() => {
    clearHomeTimelineBatchRequestCacheForTests()
    clearHomeTimelineBatchManifestCacheForTests(document)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('drops failed timeline batch requests from cache so a later retry can refetch', async () => {
    renderManifest()

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 504 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sections: [] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
      )
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      fetchHomeTimelineBatch({
        batchIndex: 1,
        doc: document,
      }),
    ).rejects.toThrow('Failed to load timeline batch 1: 504')

    await expect(
      fetchHomeTimelineBatch({
        batchIndex: 1,
        doc: document,
      }),
    ).resolves.toEqual({ sections: [] })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
