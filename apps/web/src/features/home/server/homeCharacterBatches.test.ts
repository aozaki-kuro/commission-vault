import type { CharacterCommissions } from '#data/types'
import { getCharacterSectionId, getCharacterTitleId } from '#lib/characters/nav'
import { describe, expect, it } from 'vitest'
import {
  buildHomeCharacterBatchManifest,
  buildHomeCharacterBatchPlan,
} from './homeCharacterBatches'

function buildCharacterCommissions(character: string, date: string): CharacterCommissions {
  return {
    Character: character,
    Commissions: [
      {
        fileName: `${date}-artist`,
        Links: [],
      },
    ],
  }
}

describe('buildHomeCharacterBatchPlan', () => {
  it('keeps active deferred batches at single-character granularity', () => {
    const alpha = buildCharacterCommissions('Alpha', '20240101')
    const beta = buildCharacterCommissions('Beta', '20240102')
    const gamma = buildCharacterCommissions('Gamma', '20240103')

    const plan = buildHomeCharacterBatchPlan({
      activeChars: [{ DisplayName: 'Alpha' }, { DisplayName: 'Beta' }, { DisplayName: 'Gamma' }],
      archivedChars: [],
      commissionMap: new Map(
        [alpha, beta, gamma].map(
          entry => [entry.Character, entry] satisfies [string, CharacterCommissions],
        ),
      ),
    })

    expect(plan.active.initialCharacters).toEqual(['Alpha'])
    expect(plan.active.batches).toEqual([['Beta'], ['Gamma']])
    expect(plan.active.totalBatches).toBe(2)
    expect(plan.active.targetBatchById[getCharacterSectionId('Beta')]).toBe(0)
    expect(plan.active.targetBatchById[getCharacterTitleId('Beta')]).toBe(0)
    expect(plan.active.targetBatchById[`${getCharacterSectionId('Beta')}-20240102`]).toBe(0)
    expect(plan.active.targetBatchById[getCharacterSectionId('Gamma')]).toBe(1)
    expect(plan.active.targetBatchById[getCharacterTitleId('Gamma')]).toBe(1)
    expect(plan.active.targetBatchById[`${getCharacterSectionId('Gamma')}-20240103`]).toBe(1)
  })

  it('keeps archived batches at single-character granularity including the first batch', () => {
    const archivedOne = buildCharacterCommissions('Archived One', '20240201')
    const archivedTwo = buildCharacterCommissions('Archived Two', '20240202')
    const archivedThree = buildCharacterCommissions('Archived Three', '20240203')

    const plan = buildHomeCharacterBatchPlan({
      activeChars: [],
      archivedChars: [
        { DisplayName: 'Archived One' },
        { DisplayName: 'Archived Two' },
        { DisplayName: 'Archived Three' },
      ],
      commissionMap: new Map(
        [archivedOne, archivedTwo, archivedThree].map(
          entry => [entry.Character, entry] satisfies [string, CharacterCommissions],
        ),
      ),
    })

    expect(plan.archived.initialCharacters).toEqual([])
    expect(plan.archived.batches).toEqual([['Archived One'], ['Archived Two'], ['Archived Three']])
    expect(plan.archived.totalBatches).toBe(3)
    expect(plan.archived.targetBatchById[getCharacterSectionId('Archived One')]).toBe(0)
    expect(plan.archived.targetBatchById[getCharacterSectionId('Archived Two')]).toBe(1)
    expect(plan.archived.targetBatchById[getCharacterSectionId('Archived Three')]).toBe(2)
  })
})

describe('buildHomeCharacterBatchManifest', () => {
  it('preserves the first active section as the only eagerly rendered section', () => {
    const plan = buildHomeCharacterBatchPlan({
      activeChars: [{ DisplayName: 'Alpha' }, { DisplayName: 'Beta' }],
      archivedChars: [{ DisplayName: 'Archived One' }],
      commissionMap: new Map(
        [
          buildCharacterCommissions('Alpha', '20240101'),
          buildCharacterCommissions('Beta', '20240102'),
          buildCharacterCommissions('Archived One', '20240201'),
        ].map(entry => [entry.Character, entry] satisfies [string, CharacterCommissions]),
      ),
    })

    const manifest = buildHomeCharacterBatchManifest({
      locale: 'en',
      plan,
    })

    expect(manifest.active.initialSectionIds).toEqual([getCharacterSectionId('Alpha')])
    expect(manifest.active.totalBatches).toBe(1)
    expect(manifest.archived.initialSectionIds).toEqual([])
    expect(manifest.archived.totalBatches).toBe(1)
  })
})
