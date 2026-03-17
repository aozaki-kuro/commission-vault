import type {
  CharacterRow,
  CharacterStatus,
  CommissionRow,
} from '@commission-index/domain'
import type { DragOverEvent } from '@dnd-kit/core'
import type { FormState } from '../lib/formState'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove as dndArrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from 'react'
import {
  deleteCharacterAction,
  renameCharacter,
  saveCharacterOrder,
} from '../lib/adminActions'
import { notifyDataUpdate } from '../lib/dataUpdateSignal'

const disclosureStorageKey = 'admin-existing-open'
const expiryMs = 30 * 60 * 1000
const useSafeLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export const DIVIDER_ID = 'divider'

export type ListItem
  = | { data: CharacterRow, type: 'character' }
    | { id: typeof DIVIDER_ID, type: 'divider' }

export type CharacterItem = Extract<ListItem, { type: 'character' }>
export type FormFeedback = { text: string, type: 'success' | 'error' } | null

type EditingState = { id: number, value: string } | null
type DeletingState = number | null

interface StoredOpenState {
  ids: number[]
  timestamp: number
}

interface CharacterOrderPayload {
  active: number[]
  stale: number[]
}

interface CharacterOrderSaveQueueOptions {
  onError: (message: string) => void
  onSaved: () => void
  saveOrder: (payload: CharacterOrderPayload) => Promise<FormState>
}

type OpenIdsAction
  = | { type: 'clear' }
    | { characterId: number, type: 'toggle' }
    | { type: 'reconcile', validIds: Set<number> }

type CommissionMapAction
  = | { characterId: number, type: 'remove-character' }
    | { characterId: number, commissionId: number, type: 'remove-commission' }
    | { type: 'replace', value: Map<number, CommissionRow[]> }

type ListAction
  = | { characterId: number, type: 'remove-character' }
    | { characterId: number, name: string, type: 'rename-character' }
    | { type: 'replace', value: ListItem[] }
    | { type: 'set', value: ListItem[] }

export function createLatestCharacterOrderSaveQueue({
  onError,
  onSaved,
  saveOrder,
}: CharacterOrderSaveQueueOptions) {
  let requestedVersion = 0
  let completedVersion = 0
  let latestPayload: CharacterOrderPayload | null = null
  let runningPromise: Promise<void> | null = null
  let disposed = false

  const runLoop = async () => {
    while (true) {
      if (disposed || completedVersion >= requestedVersion) {
        break
      }

      const targetVersion = requestedVersion
      const payload = latestPayload
      if (!payload) {
        break
      }

      try {
        const result = await saveOrder(payload)
        if (!disposed && result.status === 'success' && targetVersion === requestedVersion) {
          onSaved()
        }
        else if (!disposed && result.status === 'error' && targetVersion === requestedVersion) {
          onError(result.message ?? 'Unable to save character order.')
        }
      }
      catch {
        if (!disposed && targetVersion === requestedVersion) {
          onError('Unable to save character order.')
        }
      }

      completedVersion = targetVersion
    }
  }

  const ensureRunning = () => {
    if (runningPromise) {
      return
    }

    runningPromise = runLoop().finally(() => {
      runningPromise = null
      if (!disposed && completedVersion < requestedVersion) {
        ensureRunning()
      }
    })
  }

  return {
    dispose() {
      disposed = true
    },
    enqueue(payload: CharacterOrderPayload) {
      latestPayload = payload
      requestedVersion += 1
      ensureRunning()
    },
  }
}

function readOpenIdsFromStorage(): Set<number> {
  if (typeof window === 'undefined') {
    return new Set()
  }

  try {
    const stored = window.localStorage.getItem(disclosureStorageKey)
    if (!stored) {
      return new Set()
    }

    const parsed = JSON.parse(stored) as StoredOpenState | { id?: number, timestamp?: number }
    const timestamp = Number(parsed.timestamp)
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > expiryMs) {
      window.localStorage.removeItem(disclosureStorageKey)
      return new Set()
    }

    if ('ids' in parsed && Array.isArray(parsed.ids)) {
      return new Set(parsed.ids.filter((value): value is number => Number.isInteger(value) && value > 0))
    }

    const legacyId = 'id' in parsed ? parsed.id : undefined
    return typeof legacyId === 'number' && legacyId > 0 ? new Set([legacyId]) : new Set()
  }
  catch {
    return new Set()
  }
}

function saveOpenIdsToStorage(openIds: Set<number>) {
  if (typeof window === 'undefined') {
    return
  }

  if (openIds.size === 0) {
    window.localStorage.removeItem(disclosureStorageKey)
    return
  }

  const payload: StoredOpenState = {
    ids: [...openIds],
    timestamp: Date.now(),
  }
  window.localStorage.setItem(disclosureStorageKey, JSON.stringify(payload))
}

function openIdsReducer(state: Set<number>, action: OpenIdsAction): Set<number> {
  if (action.type === 'clear') {
    return state.size === 0 ? state : new Set()
  }

  if (action.type === 'toggle') {
    const next = new Set(state)
    if (next.has(action.characterId)) {
      next.delete(action.characterId)
    }
    else {
      next.add(action.characterId)
    }
    return next
  }

  const next = new Set([...state].filter(id => action.validIds.has(id)))
  return next.size === state.size && [...next].every(id => state.has(id)) ? state : next
}

function commissionMapReducer(
  state: Map<number, CommissionRow[]>,
  action: CommissionMapAction,
): Map<number, CommissionRow[]> {
  if (action.type === 'replace') {
    return action.value
  }

  if (action.type === 'remove-character') {
    if (!state.has(action.characterId)) {
      return state
    }

    const next = new Map(state)
    next.delete(action.characterId)
    return next
  }

  const current = state.get(action.characterId) ?? []
  const nextRows = current.filter(row => row.id !== action.commissionId)
  if (nextRows.length === current.length) {
    return state
  }

  const next = new Map(state)
  next.set(action.characterId, nextRows)
  return next
}

function listReducer(state: ListItem[], action: ListAction): ListItem[] {
  if (action.type === 'replace' || action.type === 'set') {
    return action.value
  }

  if (action.type === 'remove-character') {
    return state.filter(
      item => !(item.type === 'character' && item.data.id === action.characterId),
    )
  }

  return state.map(item =>
    item.type === 'character' && item.data.id === action.characterId
      ? { ...item, data: { ...item.data, name: action.name } }
      : item,
  )
}

interface UseCommissionManagerParams {
  characters: CharacterRow[]
  commissions: CommissionRow[]
}

export function useCommissionManager({
  characters,
  commissions,
}: UseCommissionManagerParams) {
  const sortedCharacters = useMemo(
    () => characters.toSorted((left, right) => left.sortOrder - right.sortOrder),
    [characters],
  )

  const initialMap = useMemo(() => {
    const grouped = new Map<number, CommissionRow[]>()
    sortedCharacters.forEach(character => grouped.set(character.id, []))
    commissions.forEach((commission) => {
      const rows = grouped.get(commission.characterId)
      if (rows) {
        rows.push(commission)
      }
    })
    return grouped
  }, [commissions, sortedCharacters])

  const initialList = useMemo((): ListItem[] => {
    const active = sortedCharacters.filter(character => character.status === 'active')
    const stale = sortedCharacters.filter(character => character.status === 'stale')

    return [
      ...active.map(character => ({ data: character, type: 'character' as const })),
      { id: DIVIDER_ID, type: 'divider' as const },
      ...stale.map(character => ({ data: character, type: 'character' as const })),
    ]
  }, [sortedCharacters])

  const [commissionMap, dispatchCommissionMap] = useReducer(commissionMapReducer, initialMap)
  const [list, dispatchList] = useReducer(listReducer, initialList)
  const [feedback, setFeedback] = useState<FormFeedback>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const [, startRenameTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<DeletingState>(null)
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [confirmingCharacter, setConfirmingCharacter] = useState<CharacterRow | null>(null)
  const [openIds, dispatchOpenIds] = useReducer(openIdsReducer, undefined, readOpenIdsFromStorage)
  const orderSaveQueueRef = useRef<ReturnType<typeof createLatestCharacterOrderSaveQueue> | null>(
    null,
  )

  orderSaveQueueRef.current ??= createLatestCharacterOrderSaveQueue({
    onError: (message) => {
      setFeedback({ text: message, type: 'error' })
    },
    onSaved: notifyDataUpdate,
    saveOrder: saveCharacterOrder,
  })

  const reconcileOpenIds = useCallback((nextCharacters: CharacterRow[]) => {
    dispatchOpenIds({
      type: 'reconcile',
      validIds: new Set(nextCharacters.map(character => character.id)),
    })
  }, [])

  const replaceCommissionMap = useCallback((nextMap: Map<number, CommissionRow[]>) => {
    dispatchCommissionMap({ type: 'replace', value: nextMap })
  }, [])

  const replaceList = useCallback((nextList: ListItem[]) => {
    dispatchList({ type: 'replace', value: nextList })
  }, [])

  useEffect(() => {
    saveOpenIdsToStorage(openIds)
  }, [openIds])

  useSafeLayoutEffect(() => {
    reconcileOpenIds(sortedCharacters)
  }, [reconcileOpenIds, sortedCharacters])

  useSafeLayoutEffect(() => {
    replaceCommissionMap(initialMap)
  }, [initialMap, replaceCommissionMap])

  useSafeLayoutEffect(() => {
    replaceList(initialList)
  }, [initialList, replaceList])

  useEffect(() => {
    if (!feedback) {
      return
    }

    const timer = window.setTimeout(() => {
      setFeedback(null)
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [feedback])

  useEffect(() => {
    const orderSaveQueue = orderSaveQueueRef.current
    return () => {
      orderSaveQueue?.dispose()
    }
  }, [])

  const handleDeleteCommission = useCallback((characterId: number, commissionId: number) => {
    dispatchCommissionMap({
      characterId,
      commissionId,
      type: 'remove-commission',
    })
  }, [])

  const handleRequestDelete = useCallback((character: CharacterRow) => {
    setConfirmingCharacter(character)
  }, [])

  const toFeedback = useCallback((state: FormState): FormFeedback => {
    return state.status === 'error'
      ? { text: state.message ?? 'Something went wrong.', type: 'error' }
      : { text: state.message ?? 'Saved.', type: 'success' }
  }, [])

  const persistOrder = useCallback((currentList: ListItem[]) => {
    const dividerIndex = currentList.findIndex(item => item.type === 'divider')
    if (dividerIndex === -1) {
      return
    }

    const activeIds = currentList
      .slice(0, dividerIndex)
      .filter((item): item is CharacterItem => item.type === 'character')
      .map(item => item.data.id)

    const staleIds = currentList
      .slice(dividerIndex + 1)
      .filter((item): item is CharacterItem => item.type === 'character')
      .map(item => item.data.id)

    orderSaveQueueRef.current?.enqueue({
      active: activeIds,
      stale: staleIds,
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const activeIndex = list.findIndex(item =>
      item.type === 'character' ? item.data.id === active.id : item.id === active.id,
    )
    const overIndex = list.findIndex(item =>
      item.type === 'character' ? item.data.id === over.id : item.id === over.id,
    )

    if (activeIndex === -1 || overIndex === -1) {
      return
    }

    dispatchList({
      type: 'set',
      value: dndArrayMove(list, activeIndex, overIndex),
    })
  }, [list])

  const handleDragEnd = useCallback(() => {
    persistOrder(list)
  }, [list, persistOrder])

  const getCharacterStatus = useCallback((characterId: number): CharacterStatus => {
    const dividerIndex = list.findIndex(item => item.type === 'divider')
    const itemIndex = list.findIndex(
      item => item.type === 'character' && item.data.id === characterId,
    )

    if (dividerIndex === -1 || itemIndex === -1) {
      return 'active'
    }

    return itemIndex < dividerIndex ? 'active' : 'stale'
  }, [list])

  const startEditingName = useCallback((character: CharacterRow) => {
    setEditing({
      id: character.id,
      value: character.name,
    })
  }, [])

  const handleRenameChange = useCallback((value: string) => {
    setEditing(current => (current ? { ...current, value } : current))
  }, [])

  const cancelEditing = useCallback(() => {
    setEditing((current) => {
      if (!current) {
        return current
      }

      const item = list.find(
        entry => entry.type === 'character' && entry.data.id === current.id,
      ) as CharacterItem | undefined

      return item ? { id: current.id, value: item.data.name } : current
    })
    setEditing(null)
  }, [list])

  const submitRename = useCallback(() => {
    const current = editing
    if (!current) {
      return
    }

    const trimmed = current.value.trim()
    if (!trimmed) {
      cancelEditing()
      return
    }

    const item = list.find(
      entry => entry.type === 'character' && entry.data.id === current.id,
    ) as CharacterItem | undefined
    if (!item) {
      setEditing(null)
      return
    }

    if (trimmed === item.data.name) {
      setEditing(null)
      return
    }

    const status = getCharacterStatus(current.id)
    setFeedback({ text: 'Updating name…', type: 'success' })

    startRenameTransition(() => {
      renameCharacter({
        id: current.id,
        name: trimmed,
        status,
      })
        .then((result) => {
          if (result.status === 'error') {
            setFeedback({ text: result.message ?? 'Unable to update character.', type: 'error' })
            cancelEditing()
            return
          }

          dispatchList({
            characterId: current.id,
            name: trimmed,
            type: 'rename-character',
          })
          setFeedback(toFeedback(result))
          setEditing(null)
          notifyDataUpdate()
        })
        .catch(() => {
          setFeedback({ text: 'Unable to update character.', type: 'error' })
          cancelEditing()
        })
    })
  }, [cancelEditing, editing, getCharacterStatus, list, startRenameTransition, toFeedback])

  const performDeleteCharacter = useCallback((character: CharacterRow) => {
    setFeedback({ text: 'Deleting…', type: 'success' })
    setDeletingId(character.id)
    setEditing(current => (current?.id === character.id ? null : current))

    startDeleteTransition(() => {
      deleteCharacterAction(character.id)
        .then((result) => {
          if (result.status === 'error') {
            setFeedback({ text: result.message ?? 'Unable to delete character.', type: 'error' })
            return
          }

          dispatchList({ characterId: character.id, type: 'remove-character' })
          dispatchCommissionMap({ characterId: character.id, type: 'remove-character' })
          setFeedback(toFeedback(result))
          notifyDataUpdate()
        })
        .catch(() => {
          setFeedback({ text: 'Unable to delete character.', type: 'error' })
        })
        .finally(() => {
          setConfirmingCharacter(null)
          setDeletingId(null)
        })
    })
  }, [startDeleteTransition, toFeedback])

  const orderedCharacters = useMemo(
    () => list.filter((item): item is CharacterItem => item.type === 'character').map(item => item.data),
    [list],
  )

  const itemIds = useMemo(
    () => list.map(item => (item.type === 'character' ? item.data.id : item.id)),
    [list],
  )

  const activeCount = useMemo(() => {
    const dividerIndex = list.findIndex(item => item.type === 'divider')
    return dividerIndex === -1 ? 0 : dividerIndex
  }, [list])

  const toggleCharacterOpen = useCallback((characterId: number) => {
    dispatchOpenIds({
      characterId,
      type: 'toggle',
    })
  }, [])

  const closeAllCharacterOpen = useCallback(() => {
    dispatchOpenIds({ type: 'clear' })
  }, [])

  return {
    activeCount,
    cancelEditing,
    closeAllCharacterOpen,
    confirmingCharacter,
    deletingId,
    editing,
    feedback,
    handleDeleteCommission,
    handleDragEnd,
    handleDragOver,
    handleRenameChange,
    handleRequestDelete,
    isDeletePending,
    itemIds,
    list,
    openIds,
    orderedCharacters,
    performDeleteCharacter,
    sensors,
    startEditingName,
    submitRename,
    toggleCharacterOpen,
    commissionMap,
    closeConfirmDialog: () => setConfirmingCharacter(null),
  }
}
