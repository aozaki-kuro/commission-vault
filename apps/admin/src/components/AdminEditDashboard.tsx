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
}

export function AdminEditDashboard({
  characters,
  commissionSearchRows,
  creatorAliases,
}: AdminEditDashboardProps) {
  return (
    <section className="space-y-4">
      <CommissionManager
        characters={characters}
        commissionSearchRows={commissionSearchRows}
        creatorAliases={creatorAliases}
      />
    </section>
  )
}
