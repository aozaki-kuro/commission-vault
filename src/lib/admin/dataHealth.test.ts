import { describe, expect, it } from 'vitest'
import { buildAdminDataHealthSummary } from './dataHealth'

describe('buildAdminDataHealthSummary', () => {
  it('summarizes missing images, orphans, unused aliases, and stale featured keywords', () => {
    const summary = buildAdminDataHealthSummary({
      adminData: {
        commissions: [
          { fileName: '20250301_artist-a' },
          { fileName: '20250302_artist-b' },
        ],
      },
      aliasesData: {
        characterAliases: [
          { characterName: 'Kanaut Nishe', aliases: [], commissionCount: 0 },
        ],
        creatorAliases: [
          { creatorName: 'Artist A', aliases: [], commissionCount: 1 },
        ],
        keywordAliases: [
          { baseKeyword: 'maid', aliases: [], commissionCount: 0 },
        ],
      },
      suggestionData: {
        featuredKeywords: ['maid', 'ghost'],
        keywordOptions: ['maid', 'kimono'],
      },
      resolveImageStem: (fileName) => {
        if (fileName === '20250301_artist-a')
          return '20250301_artist-a'
        return null
      },
      sourceImageStems: ['20250301_artist-a', '20240101_orphan'],
      sampleSize: 3,
    })

    expect(summary.totalIssues).toBe(5)
    expect(summary.groups).toEqual([
      {
        id: 'missing-source-images',
        label: 'Missing source images',
        count: 1,
        samples: ['20250302_artist-b'],
      },
      {
        id: 'orphan-source-images',
        label: 'Orphan source images',
        count: 1,
        samples: ['20240101_orphan'],
      },
      {
        id: 'unused-aliases',
        label: 'Unused alias rows',
        count: 2,
        samples: ['Character: Kanaut Nishe', 'Keyword: maid'],
      },
      {
        id: 'stale-featured-keywords',
        label: 'Featured keywords without matches',
        count: 1,
        samples: ['ghost'],
      },
    ])
  })
})
