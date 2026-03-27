import type { AdminSectionKey } from '../app/sections'
import { adminSections } from '../app/sections'
import { AdminInternalLink } from './AdminInternalLink'

interface AdminSectionNavProps {
  current: AdminSectionKey
  onNavigate: (path: string) => void
  publicSiteUrl: string
}

export function AdminSectionNav({ current, onNavigate, publicSiteUrl }: AdminSectionNavProps) {
  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-4">
        {adminSections.map(item =>
          item.key === current
            ? (
                <span
                  key={item.key}
                  aria-current="page"
                  className="
                    cursor-default py-1.5 text-gray-500
                    dark:text-gray-400
                  "
                >
                  {item.label}
                </span>
              )
            : (
                <AdminInternalLink
                  key={item.key}
                  href={item.path}
                  onNavigate={onNavigate}
                  className="py-1.5"
                >
                  {item.label}
                </AdminInternalLink>
              ),
        )}
      </div>

      <div className="flex items-center gap-4">
        <a href={publicSiteUrl} className="py-1.5">Public Site</a>
      </div>
    </nav>
  )
}
