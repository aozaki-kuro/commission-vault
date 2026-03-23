import {
  ACTIVE_CHARACTERS_LOADED_EVENT,
  readActiveCharactersLoadedBatchCount,
  readActiveCharactersLoadedState,
} from '#features/home/commission/loader/activeCharactersEvent'
import {
  ARCHIVED_CHARACTERS_COLLAPSED_EVENT,
  ARCHIVED_CHARACTERS_LOADED_EVENT,
  ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT,
  readArchivedCharactersLoadedBatchCount,
  readArchivedCharactersState,
} from '#features/home/commission/loader/archivedCharactersEvent'
import { TIMELINE_VIEW_LOADED_EVENT } from '#features/home/commission/loader/timelineViewLoader'
import { useCallback, useEffect, useLayoutEffect, useReducer } from 'react'

const useSafeLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

interface PanelLoadedState {
  activeLoaded: boolean
  activeBatchCount: number
  archivedLoaded: boolean
  archivedVisible: boolean
  archivedBatchCount: number
  timelineLoaded: boolean
}

type PanelLoadedStateAction
  = | { type: 'sync-active', value: { batchCount: number, loaded: boolean } }
    | { type: 'sync-archived', value: { batchCount: number, loaded: boolean, visible: boolean } }
    | { type: 'sync-timeline', value: boolean }

function readCharacterPanelActiveSnapshot() {
  return {
    loaded: readActiveCharactersLoadedState(),
    batchCount: readActiveCharactersLoadedBatchCount(),
  }
}

function readCharacterPanelArchivedSnapshot() {
  const state = readArchivedCharactersState()
  return {
    loaded: state.loaded,
    visible: state.visibility === 'visible',
    batchCount: readArchivedCharactersLoadedBatchCount(),
  }
}

function getTimelinePanelLoaded() {
  if (typeof document === 'undefined')
    return false
  return (
    document.querySelector<HTMLElement>('[data-commission-view-panel="timeline"]')?.dataset.timelineLoaded === 'true'
  )
}

function readPanelLoadedStateSnapshot(): PanelLoadedState {
  const active = readCharacterPanelActiveSnapshot()
  const archived = readCharacterPanelArchivedSnapshot()
  return {
    activeLoaded: active.loaded,
    activeBatchCount: active.batchCount,
    archivedLoaded: archived.loaded,
    archivedVisible: archived.visible,
    archivedBatchCount: archived.batchCount,
    timelineLoaded: getTimelinePanelLoaded(),
  }
}

function panelLoadedStateReducer(
  state: PanelLoadedState,
  action: PanelLoadedStateAction,
): PanelLoadedState {
  if (action.type === 'sync-active') {
    return {
      ...state,
      activeLoaded: action.value.loaded,
      activeBatchCount: action.value.batchCount,
    }
  }

  if (action.type === 'sync-archived') {
    return {
      ...state,
      archivedLoaded: action.value.loaded,
      archivedVisible: action.value.visible,
      archivedBatchCount: action.value.batchCount,
    }
  }

  return {
    ...state,
    timelineLoaded: action.value,
  }
}

export function useSearchPanelLoadedState() {
  const [panelLoadedState, dispatchPanelLoadedState] = useReducer(
    panelLoadedStateReducer,
    undefined,
    readPanelLoadedStateSnapshot,
  )
  const syncActiveLoaded = useCallback(() => {
    const snapshot = readCharacterPanelActiveSnapshot()
    dispatchPanelLoadedState({
      type: 'sync-active',
      value: snapshot,
    })
  }, [])

  const syncArchivedLoaded = useCallback(() => {
    const snapshot = readCharacterPanelArchivedSnapshot()
    dispatchPanelLoadedState({
      type: 'sync-archived',
      value: snapshot,
    })
  }, [])

  const syncTimelineLoaded = useCallback(() => {
    dispatchPanelLoadedState({
      type: 'sync-timeline',
      value: getTimelinePanelLoaded(),
    })
  }, [])

  useSafeLayoutEffect(() => {
    syncActiveLoaded()
    window.addEventListener(ACTIVE_CHARACTERS_LOADED_EVENT, syncActiveLoaded)

    return () => {
      window.removeEventListener(ACTIVE_CHARACTERS_LOADED_EVENT, syncActiveLoaded)
    }
  }, [syncActiveLoaded])

  useSafeLayoutEffect(() => {
    syncArchivedLoaded()
    window.addEventListener(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, syncArchivedLoaded)
    window.addEventListener(ARCHIVED_CHARACTERS_LOADED_EVENT, syncArchivedLoaded)
    window.addEventListener(ARCHIVED_CHARACTERS_COLLAPSED_EVENT, syncArchivedLoaded)

    return () => {
      window.removeEventListener(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, syncArchivedLoaded)
      window.removeEventListener(ARCHIVED_CHARACTERS_LOADED_EVENT, syncArchivedLoaded)
      window.removeEventListener(ARCHIVED_CHARACTERS_COLLAPSED_EVENT, syncArchivedLoaded)
    }
  }, [syncArchivedLoaded])

  useSafeLayoutEffect(() => {
    syncTimelineLoaded()
    window.addEventListener(TIMELINE_VIEW_LOADED_EVENT, syncTimelineLoaded)

    return () => {
      window.removeEventListener(TIMELINE_VIEW_LOADED_EVENT, syncTimelineLoaded)
    }
  }, [syncTimelineLoaded])

  return {
    activeLoaded: panelLoadedState.activeLoaded,
    activeBatchCount: panelLoadedState.activeBatchCount,
    archivedLoaded: panelLoadedState.archivedLoaded,
    archivedVisible: panelLoadedState.archivedVisible,
    archivedBatchCount: panelLoadedState.archivedBatchCount,
    timelineLoaded: panelLoadedState.timelineLoaded,
  }
}
