import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { adminSections, getAdminSectionForPath, normalizeAdminPath } from './app/sections'
import { adminActionLinkStyles, adminSurfaceStyles } from './app/ui'
import { AdminInternalLink } from './components/AdminInternalLink'
import { AdminPageShell, AdminRootLayout } from './components/AdminLayout'

const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage').then(m => ({ default: m.AdminOverviewPage })))
const AdminCreatePage = lazy(() => import('./pages/AdminCreatePage').then(m => ({ default: m.AdminCreatePage })))
const AdminEditPage = lazy(() => import('./pages/AdminEditPage').then(m => ({ default: m.AdminEditPage })))
const AdminAliasesPage = lazy(() => import('./pages/AdminAliasesPage').then(m => ({ default: m.AdminAliasesPage })))
const AdminSuggestionPage = lazy(() => import('./pages/AdminSuggestionPage').then(m => ({ default: m.AdminSuggestionPage })))
const AdminPlaceholderPage = lazy(() => import('./pages/AdminPlaceholderPage').then(m => ({ default: m.AdminPlaceholderPage })))

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

function getWindowScrollTop() {
  return Math.max(window.scrollY, window.pageYOffset, 0)
}

export function App() {
  const [currentPath, setCurrentPath] = useState(() => typeof window === 'undefined'
    ? '/'
    : normalizeAdminPath(window.location.pathname))
  const scrollPositionByPathRef = useRef(new Map<string, number>())
  const currentPathRef = useRef(currentPath)
  const currentSection = getAdminSectionForPath(currentPath)
  const publicSiteUrl = getPublicSiteUrl()

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  useEffect(() => {
    const pageTitle = currentSection ? currentSection.title : 'Not Found'
    document.title = `${pageTitle} | Commission Admin`
  }, [currentSection])

  const navigateTo = useCallback((nextPath: string, historyMode: 'push' | 'replace' = 'push') => {
    if (typeof window === 'undefined') {
      return
    }

    const previousPath = currentPathRef.current
    const normalizedPath = normalizeAdminPath(nextPath)
    if (normalizedPath === previousPath) {
      return
    }

    scrollPositionByPathRef.current.set(previousPath, getWindowScrollTop())

    if (historyMode === 'push') {
      window.history.pushState(null, '', normalizedPath)
    }
    else {
      window.history.replaceState(null, '', normalizedPath)
    }

    startTransition(() => {
      setCurrentPath(normalizedPath)
    })

    window.requestAnimationFrame(() => {
      const nextScrollTop = scrollPositionByPathRef.current.get(normalizedPath) ?? 0
      window.scrollTo({
        behavior: 'auto',
        top: nextScrollTop,
      })
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      scrollPositionByPathRef.current.set(currentPathRef.current, getWindowScrollTop())

      const normalizedPath = normalizeAdminPath(window.location.pathname)
      startTransition(() => {
        setCurrentPath(normalizedPath)
      })

      window.requestAnimationFrame(() => {
        const nextScrollTop = scrollPositionByPathRef.current.get(normalizedPath) ?? 0
        window.scrollTo({
          behavior: 'auto',
          top: nextScrollTop,
        })
      })
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  if (!currentSection) {
    return (
      <AdminRootLayout>
        <div className="
          mx-auto max-w-5xl space-y-6 pt-6 pb-10
          md:px-4
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
                <AdminInternalLink
                  key={section.key}
                  href={section.path}
                  onNavigate={navigateTo}
                  className={adminActionLinkStyles}
                >
                  {section.title}
                  <span aria-hidden="true">→</span>
                </AdminInternalLink>
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
    ? <AdminOverviewPage onNavigate={navigateTo} />
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
        onNavigate={navigateTo}
        publicSiteUrl={publicSiteUrl}
      >
        <Suspense>
          {page}
        </Suspense>
      </AdminPageShell>
    </AdminRootLayout>
  )
}
