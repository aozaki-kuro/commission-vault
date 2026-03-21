import { mountHomeUpdateLinks } from '#features/home/blocks/updateLinks'
import { mountActiveCharactersLoader } from '#features/home/commission/activeCharactersLoader'
import { mountCommissionViewModeDomSync } from '#features/home/commission/commissionViewModeDomSync'
import { mountMobileViewModeTabs } from '#features/home/commission/mobileViewModeTabs'
import { mountStaleCharactersLoader } from '#features/home/commission/staleCharactersLoader'
import { mountTimelineViewLoader } from '#features/home/commission/timelineViewLoader'
import { mountUnpublishedInterestButtons } from '#features/home/commission/unpublishedInterestClient'
import { mountHomeScrollRestore } from '#features/home/homeScrollRestore'
import { mountMobileHamburgerMenu } from '#features/home/nav/hamburger/mobileHamburgerMenu'
import { mountMobileLanguageMenu } from '#features/home/nav/hamburger/mobileLanguageMenu'
import { mountSidebarNavEnhancer } from '#features/home/nav/sidebarNavEnhancer'
import { ANALYTICS_EVENTS } from '#lib/analytics/events'
import { trackRybbitEvent } from '#lib/analytics/track'

type Cleanup = () => void
type Mount = () => Cleanup

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

const HOME_DEFERRED_MOUNT_TIMEOUT_MS = 1200
const HOME_DEFERRED_MOUNT_FALLBACK_DELAY_MS = 180

interface HomePageClientDeps {
  mountCommissionViewModeDomSync: Mount
  mountActiveCharactersLoader: Mount
  mountStaleCharactersLoader: Mount
  mountTimelineViewLoader: Mount
  mountHomeScrollRestore: Mount
  mountHomeUpdateLinks: Mount
  mountSidebarNavEnhancer: Mount
  mountMobileHamburgerMenu: Mount
  mountMobileLanguageMenu: Mount
  mountMobileViewModeTabs: Mount
  mountUnpublishedInterestButtons: Mount
  scheduleDeferredMount: (task: () => void) => Cleanup
}

interface MountHomePageClientOptions {
  deps?: Partial<HomePageClientDeps>
}

const defaultDeps: HomePageClientDeps = {
  mountCommissionViewModeDomSync: () => mountCommissionViewModeDomSync(),
  mountActiveCharactersLoader: () => mountActiveCharactersLoader(),
  mountStaleCharactersLoader: () => mountStaleCharactersLoader(),
  mountTimelineViewLoader: () => mountTimelineViewLoader(),
  mountHomeScrollRestore: () => mountHomeScrollRestore(),
  mountHomeUpdateLinks: () => mountHomeUpdateLinks(),
  mountSidebarNavEnhancer: () => mountSidebarNavEnhancer(),
  mountMobileHamburgerMenu: () => mountMobileHamburgerMenu(),
  mountMobileLanguageMenu: () => mountMobileLanguageMenu(),
  mountMobileViewModeTabs: () => mountMobileViewModeTabs(),
  mountUnpublishedInterestButtons: () =>
    mountUnpublishedInterestButtons({
      trackEvent: (properties) => {
        trackRybbitEvent(ANALYTICS_EVENTS.iWantToSeeIt, {
          sub_event: properties.sub_event,
        })
      },
    }),
  scheduleDeferredMount: (task) => {
    const idleWindow = window as IdleWindow
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(task, {
        timeout: HOME_DEFERRED_MOUNT_TIMEOUT_MS,
      })
      return () => {
        idleWindow.cancelIdleCallback?.(handle)
      }
    }

    const timeoutHandle = window.setTimeout(task, HOME_DEFERRED_MOUNT_FALLBACK_DELAY_MS)
    return () => {
      window.clearTimeout(timeoutHandle)
    }
  },
}

export function mountHomePageClient({ deps: depsOverrides }: MountHomePageClientOptions = {}) {
  const deps = { ...defaultDeps, ...depsOverrides }
  const criticalMounts: Mount[] = [
    deps.mountCommissionViewModeDomSync,
    deps.mountActiveCharactersLoader,
    deps.mountStaleCharactersLoader,
    deps.mountTimelineViewLoader,
    deps.mountHomeScrollRestore,
    deps.mountHomeUpdateLinks,
  ]
  const deferredMounts: Mount[] = [
    deps.mountSidebarNavEnhancer,
    deps.mountMobileHamburgerMenu,
    deps.mountMobileLanguageMenu,
    deps.mountMobileViewModeTabs,
    deps.mountUnpublishedInterestButtons,
  ]
  const cleanups: Cleanup[] = []
  let cancelDeferredMount: Cleanup | null = null
  let disposed = false

  const cleanupAll = () => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  }

  try {
    for (const mount of criticalMounts) {
      cleanups.push(mount())
    }

    cancelDeferredMount = deps.scheduleDeferredMount(() => {
      cancelDeferredMount = null
      if (disposed)
        return
      try {
        for (const mount of deferredMounts) {
          cleanups.push(mount())
        }
      }
      catch (error) {
        cleanupAll()
        throw error
      }
    })
  }
  catch (error) {
    cancelDeferredMount?.()
    cancelDeferredMount = null
    cleanupAll()
    throw error
  }

  return () => {
    disposed = true
    cancelDeferredMount?.()
    cancelDeferredMount = null
    cleanupAll()
  }
}
