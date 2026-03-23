import type { AdminCommissionSearchRow } from '@commission-index/domain'
import { describe, expect, it } from 'vitest'
import { findDuplicateCommissionHints } from './duplicateCommissionHints'

function buildCommissionRow(
  overrides: Partial<AdminCommissionSearchRow> & Pick<AdminCommissionSearchRow, 'id' | 'fileName'>,
): AdminCommissionSearchRow {
  return {
    characterId: 1,
    characterName: 'Sakura',
    description: null,
    design: null,
    keyword: null,
    ...overrides,
  }
}

describe('findDuplicateCommissionHints', () => {
  const commissions: AdminCommissionSearchRow[] = [
    buildCommissionRow({
      id: 1,
      fileName: '20250302_Artist',
      keyword: 'dress, smile',
    }),
    buildCommissionRow({
      id: 2,
      fileName: '20250302_OtherArtist',
      keyword: 'dress',
    }),
    buildCommissionRow({
      id: 3,
      fileName: '20250302_Artist (part 2)',
      keyword: 'dress, smile',
    }),
    buildCommissionRow({
      id: 4,
      characterId: 2,
      characterName: 'Rin',
      fileName: '20250302_Artist',
      keyword: 'dress, smile',
    }),
  ]

  it('returns no hints before the file name exists', () => {
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissions,
        fileName: '',
        keyword: 'dress',
      }),
    ).toEqual([])
  })

  it('keeps exact file-name collisions as duplicate hints', () => {
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissions,
        fileName: '20250302_Artist',
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commissionId: 1,
          reasons: ['Same file name'],
        }),
        expect.objectContaining({
          commissionId: 4,
          reasons: ['Same file name'],
        }),
      ]),
    )
  })

  it('does not warn for same character plus same date alone', () => {
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissions,
        fileName: '20250302_NewArtist',
        keyword: 'dress',
      }),
    ).toEqual([])
  })

  it('keeps near-duplicate hints only when character, date, and creator all match', () => {
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissions,
        fileName: '20250302_Artist',
        keyword: 'dress, smile',
      }),
    ).toMatchObject([
      {
        commissionId: 1,
        reasons: ['Same file name', 'Shared keyword: dress, smile'],
      },
      {
        commissionId: 4,
        reasons: ['Same file name', 'Shared keyword: dress, smile'],
      },
      {
        commissionId: 3,
        reasons: [
          'Same character',
          'Same date 20250302',
          'Same creator',
          'Shared keyword: dress, smile',
        ],
      },
    ])
  })

  it('excludes the current commission when editing', () => {
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissionId: 1,
        commissions,
        fileName: '20250302_Artist',
      }),
    ).toMatchObject([
      {
        commissionId: 4,
        reasons: ['Same file name'],
      },
      {
        commissionId: 3,
        reasons: ['Same character', 'Same date 20250302', 'Same creator'],
      },
    ])
  })
})
