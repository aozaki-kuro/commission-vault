import { describe, expect, it } from 'vitest'
import { findDuplicateCommissionHints } from './duplicateCommissionHints'

describe('findDuplicateCommissionHints', () => {
  it('prefers exact file-name matches and combines multiple signals', () => {
    const hints = findDuplicateCommissionHints({
      characterId: 1,
      fileName: '20250302_Artist A',
      keyword: 'maid, kimono',
      commissions: [
        {
          id: 1,
          characterId: 1,
          characterName: 'Kanaut Nishe',
          fileName: '20250302_Artist A',
          keyword: 'maid',
        },
        {
          id: 2,
          characterId: 1,
          characterName: 'Kanaut Nishe',
          fileName: '20250302_Artist B',
          keyword: 'kimono',
        },
        {
          id: 3,
          characterId: 2,
          characterName: 'Lucia',
          fileName: '20240101_Artist C',
          keyword: 'night',
        },
      ],
    })

    expect(hints).toHaveLength(2)
    expect(hints[0]).toMatchObject({
      commissionId: 1,
      fileName: '20250302_Artist A',
    })
    expect(hints[0]?.reasons).toContain('Same file name')
    expect(hints[1]?.reasons).toEqual(
      expect.arrayContaining(['Same date 20250302', 'Same character', 'Shared keyword: kimono']),
    )
  })

  it('excludes the currently edited commission id', () => {
    const hints = findDuplicateCommissionHints({
      commissionId: 9,
      characterId: 2,
      fileName: '20250302_Artist A',
      commissions: [
        {
          id: 9,
          characterId: 2,
          characterName: 'Lucia',
          fileName: '20250302_Artist A',
        },
      ],
    })

    expect(hints).toEqual([])
  })
})
