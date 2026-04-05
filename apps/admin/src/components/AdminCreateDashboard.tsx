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
      <div className="motion-safe:animate-[tabFade_300ms_cubic-bezier(0.25,1,0.5,1)_both]">
        <AddCharacterForm />
      </div>
      <div
        className="motion-safe:animate-[tabFade_300ms_cubic-bezier(0.25,1,0.5,1)_both]"
        style={{ animationDelay: '80ms' }}
      >
        <AddCommissionForm
          characters={characters}
          commissionSearchRows={commissionSearchRows}
        />
      </div>
    </section>
  )
}
