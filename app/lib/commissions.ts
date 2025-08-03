import { Commission, Props } from '#data/types'
import { getBaseFileName } from './strings'

/**
 * Filter out hidden commissions to speed up builds.
 */
export const filterHiddenCommissions = (data: Props): Props =>
  data.map(characterData => ({
    ...characterData,
    Commissions: characterData.Commissions.filter(c => !c.Hidden),
  }))

/**
 * Merge parts/previews, keeping the latest version.
 */
export function mergePartsAndPreviews(commissions: Commission[]): Map<string, Commission> {
  const commissionMap = new Map<string, Commission>()

  commissions.forEach(commission => {
    const baseFileName = getBaseFileName(commission.fileName)
    const existing = commissionMap.get(baseFileName)

    if (!existing || commission.fileName > existing.fileName) {
      commissionMap.set(baseFileName, commission)
    }
  })

  return commissionMap
}

/**
 * Sort commissions by date (desc).
 */
export function sortCommissionsByDate(a: Commission, b: Commission): number {
  return b.fileName.localeCompare(a.fileName)
}

/**
 * Extract metadata from a commission file name.
 */
export function parseCommissionFileName(fileName: string) {
  const date = fileName.slice(0, 8)
  const year = date.slice(0, 4)
  const creator = fileName.slice(9)
  return { date, year, creator }
}
