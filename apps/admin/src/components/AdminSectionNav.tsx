import type { AdminSectionKey } from '../app/sections'
import { adminSections } from '../app/sections'

interface AdminSectionNavProps {
  current: AdminSectionKey
  publicSiteUrl: string
}

export function AdminSectionNav({ current, publicSiteUrl }: AdminSectionNavProps) {
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
                    cursor-default text-gray-500
                    dark:text-gray-400
                  "
                >
                  {item.label}
                </span>
              )
            : (
                <a key={item.key} href={item.path}>
                  {item.label}
                </a>
              ),
        )}
      </div>

      <div className="flex items-center gap-4">
        <a href={publicSiteUrl}>Public Site</a>
      </div>
    </nav>
  )
}
