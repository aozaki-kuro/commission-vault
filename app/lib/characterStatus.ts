import 'server-only'

import { characterStatus } from '#data/commissionStatus'

interface CharacterEntry {
  DisplayName: string
}

export const getCharacterStatus = () => characterStatus

export const isCharacterActive = (character: string): boolean =>
  characterStatus.active.some(char => char.DisplayName === character)

export const getAllCharacters = (): CharacterEntry[] => [
  ...characterStatus.active,
  ...characterStatus.stale,
]
