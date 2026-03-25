import type { RequestActiveCharactersLoadOptions } from '@features/home/commission/loader/activeCharactersEvent'
import {
  ACTIVE_CHARACTERS_LOADED_EVENT,
  hasDeferredActiveCharacterTarget,
  requestActiveCharactersLoad,
} from '@features/home/commission/loader/activeCharactersEvent'
import { loadDeferredHomeNavTarget } from '@features/home/nav/homeNavTargetClient'
import {
  getHashFromHref,
  getHashTarget,
  scrollToHashTargetFromHrefWithoutHash,
} from '@lib/navigation/hashAnchor'

const UPDATE_ROOT_SELECTOR = '[data-home-update-links="true"]'
const UPDATE_LINK_SELECTOR = '[data-home-update-link="true"]'

interface HomeUpdateLinksDeps {
  hasDeferredActiveTarget: typeof hasDeferredActiveCharacterTarget
  requestActiveLoad: (win: Window, options?: RequestActiveCharactersLoadOptions) => void
  scrollToHashWithoutWrite: typeof scrollToHashTargetFromHrefWithoutHash
}

const defaultDeps: HomeUpdateLinksDeps = {
  hasDeferredActiveTarget: hasDeferredActiveCharacterTarget,
  requestActiveLoad: requestActiveCharactersLoad,
  scrollToHashWithoutWrite: scrollToHashTargetFromHrefWithoutHash,
}

export function mountHomeUpdateLinks({
  win = window,
  doc = document,
  deps: depsOverrides,
}: {
  win?: Window
  doc?: Document
  deps?: Partial<HomeUpdateLinksDeps>
} = {}) {
  const root = doc.querySelector<HTMLElement>(UPDATE_ROOT_SELECTOR)
  if (!root)
    return () => {}

  const deps = { ...defaultDeps, ...depsOverrides }

  const onClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element))
      return

    const link = target.closest<HTMLAnchorElement>(UPDATE_LINK_SELECTOR)
    if (!link || !root.contains(link))
      return

    const href = link.getAttribute('href')
    if (!deps.hasDeferredActiveTarget(doc, href))
      return

    event.preventDefault()
    loadDeferredHomeNavTarget({
      isReady: () => Boolean(getHashTarget(getHashFromHref(href))),
      loadedEvent: ACTIVE_CHARACTERS_LOADED_EVENT,
      onLoaded: () => {
        deps.scrollToHashWithoutWrite(href)
      },
      requestLoad: () => {
        deps.requestActiveLoad(win, {
          strategy: 'target',
          targetId: href ?? undefined,
        })
      },
      win,
    })
  }

  root.addEventListener('click', onClick)

  return () => {
    root.removeEventListener('click', onClick)
  }
}
