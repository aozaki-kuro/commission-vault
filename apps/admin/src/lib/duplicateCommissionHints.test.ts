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
    ])
  })

  it('does not warn when the only difference is a (part N) suffix', () => {
    // 20250302_Artist 和 20250302_Artist (part 2) 是同一组稿的不同 part，不应触发重复提示
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissions,
        fileName: '20250302_Artist',
        keyword: 'dress, smile',
      }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commissionId: 3 }),
      ]),
    )
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
    ])
    // part 2 稿不应出现在编辑 part 1 时的重复提示中
    expect(
      findDuplicateCommissionHints({
        characterId: 1,
        commissionId: 1,
        commissions,
        fileName: '20250302_Artist',
      }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commissionId: 3 }),
      ]),
    )
  })
})
