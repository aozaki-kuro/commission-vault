import { useEffect } from 'react'
import { adminSections, getAdminSectionForPath, normalizeAdminPath } from './app/sections'
import { adminActionLinkStyles, adminSurfaceStyles } from './app/ui'
import { AdminPageShell, AdminRootLayout } from './components/AdminLayout'
import { AdminAliasesPage } from './pages/AdminAliasesPage'
import { AdminCreatePage } from './pages/AdminCreatePage'
import { AdminEditPage } from './pages/AdminEditPage'
import { AdminOverviewPage } from './pages/AdminOverviewPage'
import { AdminPlaceholderPage } from './pages/AdminPlaceholderPage'
import { AdminSuggestionPage } from './pages/AdminSuggestionPage'

function getPublicSiteUrl() {
  if (typeof window === 'undefined') {
    return 'https://crystallize.cc'
  }

  const { hostname, protocol } = window.location
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return 'http://localhost:4321'
  }

  if (hostname === 'admin.crystallize.cc') {
    return 'https://crystallize.cc'
  }

  return `${protocol}//${hostname}`
}

export function App() {
  const currentPath = typeof window === 'undefined'
    ? '/'
    : normalizeAdminPath(window.location.pathname)
  const currentSection = getAdminSectionForPath(currentPath)
  const publicSiteUrl = getPublicSiteUrl()

  useEffect(() => {
    const pageTitle = currentSection ? currentSection.title : 'Not Found'
    document.title = `${pageTitle} | Commission Admin`
  }, [currentSection])

  if (!currentSection) {
    return (
      <AdminRootLayout>
        <div className="
          mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-10
          lg:px-0
        "
        >
          <header className="space-y-2">
            <h1 className="
              text-2xl/tight font-semibold text-gray-900
              dark:text-gray-100
            "
            >
              Not Found
            </h1>
            <p className="
              text-sm text-gray-600
              dark:text-gray-300
            "
            >
              This route is not part of the standalone admin shell.
            </p>
          </header>

          <section className={adminSurfaceStyles}>
            <h2 className="
              text-sm font-semibold text-gray-900
              dark:text-gray-100
            "
            >
              Available routes
            </h2>
            <div className="
              grid gap-3
              sm:grid-cols-2
            "
            >
              {adminSections.map(section => (
                <a
                  key={section.key}
                  href={section.path}
                  className={adminActionLinkStyles}
                >
                  {section.title}
                  <span aria-hidden="true">→</span>
                </a>
              ))}
            </div>
            <a
              href={publicSiteUrl}
              className="
                inline-flex items-center gap-2 text-xs text-gray-600
                hover:text-gray-900
                dark:text-gray-300
                dark:hover:text-gray-100
              "
            >
              Open public site
              <span aria-hidden="true">↗</span>
            </a>
          </section>
        </div>
      </AdminRootLayout>
    )
  }

  const page = currentSection.key === 'overview'
    ? <AdminOverviewPage />
    : currentSection.key === 'create'
      ? <AdminCreatePage />
      : currentSection.key === 'edit'
        ? <AdminEditPage />
        : currentSection.key === 'aliases'
          ? <AdminAliasesPage />
          : currentSection.key === 'suggestion'
            ? <AdminSuggestionPage />
            : <AdminPlaceholderPage section={currentSection} />

  return (
    <AdminRootLayout>
      <AdminPageShell
        current={currentSection.key}
        title={currentSection.title}
        description={currentSection.description}
        publicSiteUrl={publicSiteUrl}
      >
        {page}
      </AdminPageShell>
    </AdminRootLayout>
  )
}
