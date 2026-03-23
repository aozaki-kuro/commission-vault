import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CreatorAliasRow,
} from '@commission-index/domain'
import { CommissionManager } from './edit/CommissionManager'

interface AdminEditDashboardProps {
  characters: CharacterRow[]
  commissionSearchRows: AdminCommissionSearchRow[]
  creatorAliases: CreatorAliasRow[]
  dataVersion: number
}

export function AdminEditDashboard({
  characters,
  commissionSearchRows,
  creatorAliases,
  dataVersion,
}: AdminEditDashboardProps) {
  return (
    <section className="space-y-4">
      <CommissionManager
        key={dataVersion}
        characters={characters}
        commissionSearchRows={commissionSearchRows}
        creatorAliases={creatorAliases}
      />
    </section>
  )
}
