import type { CharacterRow, CommissionRow } from '@commission-index/domain'
import { useEffect, useMemo, useState } from 'react'
import { getAdminApiUrl } from '../lib/adminApi'

interface DeleteStatus {
  text: string
  type: 'success' | 'error'
}

interface UseCommissionEditStateParams {
  characters: CharacterRow[]
  commission: CommissionRow
}

function buildImageSrc(fileName: string) {
  return getAdminApiUrl(`/api/admin/source-image/${encodeURIComponent(fileName)}`)
}

export function useCommissionEditState({
  characters,
  commission,
}: UseCommissionEditStateParams) {
  const sortedCharacters = useMemo(
    () => characters.toSorted((left, right) => left.sortOrder - right.sortOrder),
    [characters],
  )

  const initialCharacterId = useMemo(() => {
    const exists = characters.some(character => character.id === commission.characterId)
    return exists ? commission.characterId : (sortedCharacters[0]?.id ?? commission.characterId)
  }, [characters, commission.characterId, sortedCharacters])

  const [selectedCharacterId, setSelectedCharacterId] = useState<number>(initialCharacterId)
  const [isHidden, setIsHidden] = useState(commission.hidden)
  const [fileName, setFileName] = useState(commission.fileName)
  const [linksValue, setLinksValue] = useState(() => commission.links.join('\n'))
  const [designValue, setDesignValue] = useState(commission.design ?? '')
  const [descriptionValue, setDescriptionValue] = useState(commission.description ?? '')
  const [keywordValue, setKeywordValue] = useState(commission.keyword ?? '')
  const [errorSrc, setErrorSrc] = useState<string | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null)

  const imageSrc = useMemo(() => buildImageSrc(fileName), [fileName])

  useEffect(() => {
    if (!deleteStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setDeleteStatus(null)
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [deleteStatus])

  return {
    deleteStatus,
    descriptionValue,
    designValue,
    errorSrc,
    fileName,
    imageSrc,
    initialCharacterId,
    isHidden,
    keywordValue,
    linksValue,
    selectedCharacterId,
    setDeleteStatus,
    setDescriptionValue,
    setDesignValue,
    setErrorSrc,
    setFileName,
    setIsHidden,
    setKeywordValue,
    setLinksValue,
    setSelectedCharacterId,
    sortedCharacters,
  }
}
