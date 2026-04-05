import type {
  AdminCommissionSearchRow,
  CharacterStatus,
} from '@commission-index/domain'
import { AddCharacterForm } from './create/AddCharacterForm'
import { AddCommissionForm } from './create/AddCommissionForm'

interface CharacterOption {
  id: number
  name: string
  status: CharacterStatus
  sortOrder: number
}

interface AdminCreateDashboardProps {
  characters: CharacterOption[]
  commissionSearchRows: AdminCommissionSearchRow[]
}

export function AdminCreateDashboard({
  characters,
  commissionSearchRows,
}: AdminCreateDashboardProps) {
  return (
    <section className="space-y-8">
      <AddCharacterForm />
      <AddCommissionForm
        characters={characters}
        commissionSearchRows={commissionSearchRows}
      />
    </section>
  )
}
