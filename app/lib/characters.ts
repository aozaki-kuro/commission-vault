import { characterStatus } from '#data/commissionStatus'

/**
 * Check if a character is currently active.
 */
export const isCharacterActive = (character: string): boolean =>
  characterStatus.active.some(char => char.DisplayName === character)

/**
 * Retrieve all characters, active and stale.
 */
export const getAllCharacters = () => [...characterStatus.active, ...characterStatus.stale]
