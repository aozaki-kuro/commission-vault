import activeCommissions from '#data/Active'
import staleCommissions from '#data/Stale'

import { filterHiddenCommissions, sortCommissionsByDate } from '#lib/commissions'

import { Props } from '#data/types'

const rawData: Props = filterHiddenCommissions([...activeCommissions, ...staleCommissions])

export const commissionData: Props = rawData.map(character => ({
  ...character,
  Commissions: character.Commissions.slice().sort(sortCommissionsByDate),
}))

export const commissionDataMap = new Map(commissionData.map(data => [data.Character, data]))
