import type { AdminSectionDefinition, AdminSectionKey } from '../app/sections'
import {
  adminInsetCardStyles,
  adminSurfaceStyles,
  getStatusBadgeStyles,
} from '../app/ui'

interface PlaceholderPlan {
  sourceOfTruth: string
  dependency: string
  steps: string[]
}

const placeholderPlans: Record<Exclude<AdminSectionKey, 'overview'>, PlaceholderPlan> = {
  create: {
    sourceOfTruth: 'Legacy AddCharacterForm and AddCommissionForm in apps/web remain the visual and behavioral source.',
    dependency: 'Bootstrap payload and create actions need a worker-backed API client before the forms can move.',
    steps: [
      'Port bootstrap fetch and retry behavior into apps/admin.',
      'Move create actions off the Astro dev-only action wrappers.',
      'Verify form layout and upload affordances with Playwright before marking this route migrated.',
    ],
  },
  edit: {
    sourceOfTruth: 'Legacy CommissionManager, reload scroll restore, and refresh-assets affordance still live in apps/web.',
    dependency: 'Edit requires bootstrap, CRUD endpoints, and image refresh flows to be stable on the worker.',
    steps: [
      'Port CommissionManager and its hook graph without changing layout contracts.',
      'Migrate the refresh-assets button to a real worker endpoint or remove it after the new pipeline exists.',
      'Re-run regression on search, reorder, rename, and delete flows once ported.',
    ],
  },
  aliases: {
    sourceOfTruth: 'Legacy AliasesDashboard remains the contract for tabs, spacing, and row-level actions.',
    dependency: 'Alias CRUD needs stable worker endpoints while preserving the current response shape.',
    steps: [
      'Move alias list bootstrap to the standalone app client.',
      'Port alias mutations through the worker while preserving current validation copy.',
      'Diff the standalone page against the legacy aliases dashboard before sign-off.',
    ],
  },
  suggestion: {
    sourceOfTruth: 'Legacy SuggestionDashboard still defines keyword ordering, drag-and-drop, and submit affordances.',
    dependency: 'Suggestion bootstrap and save endpoints must move first so the page can stay visually unchanged.',
    steps: [
      'Port keyword bootstrap and save actions to the worker API client.',
      'Move the existing dashboard component with its layout shell unchanged.',
      'Refresh the existing visual baseline once the standalone route matches legacy output.',
    ],
  },
}

interface AdminPlaceholderPageProps {
  section: AdminSectionDefinition
}

export function AdminPlaceholderPage({ section }: AdminPlaceholderPageProps) {
  const plan = placeholderPlans[section.key as Exclude<AdminSectionKey, 'overview'>]

  return (
    <>
      <section className={adminSurfaceStyles}>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="
              text-sm font-semibold text-gray-900
              dark:text-gray-100
            "
            >
              Route migration pending
            </h2>
            <p className="
              text-xs text-gray-600
              dark:text-gray-300
            "
            >
              The standalone shell is in place. The real page logic for
              {' '}
              {section.title.toLowerCase()}
              {' '}
              has not moved yet.
            </p>
          </div>
          <span className={`
            inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium
            ${getStatusBadgeStyles('pending')}
          `}
          >
            pending
          </span>
        </div>
      </section>

      <section className={adminSurfaceStyles}>
        <div className="
          grid gap-3
          md:grid-cols-2
        "
        >
          <article className={adminInsetCardStyles}>
            <h3 className="
              text-sm font-medium text-gray-900
              dark:text-gray-100
            "
            >
              Source of truth
            </h3>
            <p className="
              mt-3 text-xs text-gray-600
              dark:text-gray-300
            "
            >
              {plan.sourceOfTruth}
            </p>
          </article>

          <article className={adminInsetCardStyles}>
            <h3 className="
              text-sm font-medium text-gray-900
              dark:text-gray-100
            "
            >
              Current dependency
            </h3>
            <p className="
              mt-3 text-xs text-gray-600
              dark:text-gray-300
            "
            >
              {plan.dependency}
            </p>
          </article>
        </div>
      </section>

      <section className={adminSurfaceStyles}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="
            text-sm font-semibold text-gray-900
            dark:text-gray-100
          "
          >
            Next steps
          </h2>
          <span className="
            text-xs text-gray-500
            dark:text-gray-300
          "
          >
            Keep visual output stable
          </span>
        </div>

        <ol className="mt-4 space-y-2">
          {plan.steps.map(step => (
            <li
              key={step}
              className="
                rounded-lg border border-gray-200/80 bg-white/80 px-3 py-2
                text-xs
                dark:border-gray-700 dark:bg-gray-950/40
              "
            >
              {step}
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
