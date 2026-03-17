import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CommissionRow,
} from '@commission-index/domain'
import type { ChangeEvent } from 'react'
import { IconUpload } from '@tabler/icons-react'
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useCommissionEditState } from '../../hooks/useCommissionEditState'
import {
  deleteCommissionAction,
  replaceCommissionSourceImageAction,
  updateCommissionAction,
} from '../../lib/adminActions'
import { notifyDataUpdate } from '../../lib/dataUpdateSignal'
import { findDuplicateCommissionHints } from '../../lib/duplicateCommissionHints'
import { INITIAL_FORM_STATE } from '../../lib/formState'
import { CommissionHiddenSwitch } from '../create/CommissionFormFields'
import { CommissionSharedFields } from '../create/CommissionSharedFields'
import { DuplicateCommissionNotice } from '../create/DuplicateCommissionNotice'
import { FormStatusIndicator } from '../FormStatusIndicator'
import { SubmitButton } from '../SubmitButton'

interface CommissionEditFormProps {
  characters: CharacterRow[]
  commission: CommissionRow
  commissionSearchRows: AdminCommissionSearchRow[]
  onDelete?: () => void
}

interface OperationStatus {
  text: string
  type: 'success' | 'error'
}

function buildPreviewVersionStorageKey(commissionId: number) {
  return `admin-preview-image-version:${commissionId}`
}

export function CommissionEditForm({
  characters,
  commission,
  commissionSearchRows,
  onDelete,
}: CommissionEditFormProps) {
  const [state, formAction] = useActionState(updateCommissionAction, INITIAL_FORM_STATE)
  const [isDeleting, startDelete] = useTransition()
  const [isUploading, startUpload] = useTransition()
  const [uploadStatus, setUploadStatus] = useState<OperationStatus | null>(null)
  const [isDeleteArmed, setIsDeleteArmed] = useState(false)
  const sourceImageInputRef = useRef<HTMLInputElement | null>(null)
  const [imageVersion, setImageVersion] = useState(() => {
    if (typeof window === 'undefined') {
      return 0
    }

    const stored = window.sessionStorage.getItem(buildPreviewVersionStorageKey(commission.id))
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  })
  const {
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
  } = useCommissionEditState({
    characters,
    commission,
  })
  const previewImageSrc = imageVersion > 0 ? `${imageSrc}?v=${imageVersion}` : imageSrc
  const duplicateHints = useMemo(
    () => findDuplicateCommissionHints({
      characterId: selectedCharacterId,
      commissionId: commission.id,
      commissions: commissionSearchRows,
      fileName,
      keyword: keywordValue,
    }),
    [commission.id, commissionSearchRows, fileName, keywordValue, selectedCharacterId],
  )

  useEffect(() => {
    if (state.status === 'success') {
      notifyDataUpdate()
    }
  }, [state.status])

  useEffect(() => {
    if (!uploadStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setUploadStatus(null)
    }, 2400)

    return () => window.clearTimeout(timer)
  }, [uploadStatus])

  const handleDelete = () => {
    if (!isDeleteArmed) {
      setIsDeleteArmed(true)
      return
    }

    startDelete(() => {
      deleteCommissionAction(commission.id)
        .then((result) => {
          if (result.status === 'success') {
            setDeleteStatus({ text: 'Entry deleted.', type: 'success' })
            setIsDeleteArmed(false)
            onDelete?.()
            return
          }

          setDeleteStatus({
            text: result.message ?? 'Failed to delete commission.',
            type: 'error',
          })
          setIsDeleteArmed(false)
        })
        .catch(() => {
          setDeleteStatus({ text: 'Failed to delete commission.', type: 'error' })
          setIsDeleteArmed(false)
        })
    })
  }

  const handleSelectSourceImage = () => {
    if (fileName.trim() !== commission.fileName) {
      setUploadStatus({
        text: 'Save file name changes before reuploading the source image.',
        type: 'error',
      })
      return
    }

    sourceImageInputRef.current?.click()
  }

  const handleSourceImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) {
      return
    }

    if (fileName.trim() !== commission.fileName) {
      setUploadStatus({
        text: 'Save file name changes before reuploading the source image.',
        type: 'error',
      })
      input.value = ''
      return
    }

    const payload = new FormData()
    payload.set('commissionFileName', commission.fileName)
    payload.set('id', String(commission.id))
    payload.set('sourceImage', file)

    startUpload(() => {
      replaceCommissionSourceImageAction(payload)
        .then((result) => {
          if (result.status === 'success') {
            const nextVersion = Date.now()
            setUploadStatus({
              text: result.message ?? `Source image for "${commission.fileName}" replaced.`,
              type: 'success',
            })
            setErrorSrc(null)
            setImageVersion(nextVersion)
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(
                buildPreviewVersionStorageKey(commission.id),
                String(nextVersion),
              )
            }
            return
          }

          setUploadStatus({
            text: result.message ?? 'Failed to replace source image.',
            type: 'error',
          })
        })
        .catch(() => {
          setUploadStatus({ text: 'Failed to replace source image.', type: 'error' })
        })
        .finally(() => {
          input.value = ''
        })
    })
  }

  return (
    <form
      action={formAction}
      className="
        space-y-4 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm
        ring-1 ring-gray-900/5 backdrop-blur-sm
        dark:border-gray-700 dark:bg-gray-900/30 dark:ring-white/10
      "
    >
      <input type="hidden" name="id" value={commission.id} />
      <input type="hidden" name="characterId" value={selectedCharacterId} />
      {isHidden ? <input type="hidden" name="hidden" value="on" /> : null}

      <div className="
        group relative aspect-1280/525 w-full overflow-hidden rounded-xl
        bg-gray-50
        dark:bg-gray-900/30
      "
      >
        {errorSrc === imageSrc
          ? (
              <div className="
                flex size-full items-center justify-center text-xs text-gray-500
                dark:text-gray-300
              "
              >
                Image not found
              </div>
            )
          : (
              <img
                src={previewImageSrc}
                alt={commission.fileName}
                className="size-full object-contain"
                onError={() => setErrorSrc(imageSrc)}
              />
            )}

        <input
          ref={sourceImageInputRef}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleSourceImageChange}
        />

        <button
          type="button"
          onClick={handleSelectSourceImage}
          disabled={isDeleting || isUploading}
          aria-label={`Reupload source image for ${commission.fileName}`}
          className="
            absolute right-3 bottom-3 inline-flex size-9 items-center
            justify-center rounded-full border border-white/20 bg-black/55
            text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.75)]
            backdrop-blur-sm transition
            hover:bg-black/70
            focus-visible:ring-2 focus-visible:ring-white/90
            focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
            focus-visible:outline-none
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <IconUpload className="size-4" stroke={1.8} aria-hidden="true" />
        </button>
      </div>

      {uploadStatus
        ? (
            <p
              className={uploadStatus.type === 'success'
                ? `
                  text-xs text-emerald-600
                  dark:text-emerald-400
                `
                : `
                  text-xs text-red-500
                  dark:text-red-400
                `}
            >
              {uploadStatus.text}
            </p>
          )
        : null}

      <CommissionSharedFields
        characterOptions={sortedCharacters}
        selectedCharacterId={selectedCharacterId}
        onCharacterChange={id => setSelectedCharacterId(id ?? initialCharacterId)}
        fileName={fileName}
        onFileNameChange={setFileName}
        linksValue={linksValue}
        onLinksChange={setLinksValue}
        linksRows={3}
        designValue={designValue}
        onDesignChange={setDesignValue}
        descriptionValue={descriptionValue}
        onDescriptionChange={setDescriptionValue}
        keywordValue={keywordValue}
        onKeywordChange={setKeywordValue}
      />

      <DuplicateCommissionNotice hints={duplicateHints} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <SubmitButton>Save changes</SubmitButton>
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            errorFallback="Unable to update commission."
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <CommissionHiddenSwitch isHidden={isHidden} onChange={setIsHidden} />

          {isDeleteArmed && !isDeleting
            ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteArmed(false)}
                  className="
                    inline-flex h-10 items-center justify-center rounded-md
                    border border-gray-300/80 px-4 text-sm font-medium
                    text-gray-600 transition
                    hover:bg-gray-50
                    focus-visible:ring-2 focus-visible:ring-gray-400
                    focus-visible:ring-offset-2 focus-visible:ring-offset-white
                    focus-visible:outline-none
                    dark:border-gray-700 dark:text-gray-300
                    dark:hover:bg-gray-900/40
                    dark:focus-visible:ring-offset-gray-900
                  "
                >
                  Cancel
                </button>
              )
            : null}

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="
              inline-flex h-10 items-center justify-center rounded-md border
              border-red-200/70 px-4 text-sm font-medium text-red-600 transition
              hover:bg-red-50
              focus-visible:ring-2 focus-visible:ring-red-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-white
              focus-visible:outline-none
              disabled:cursor-not-allowed disabled:opacity-60
              dark:border-red-500/40 dark:text-red-300
              dark:hover:bg-red-500/10
              dark:focus-visible:ring-offset-gray-900
            "
          >
            {isDeleting ? 'Deleting…' : isDeleteArmed ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </div>

      {deleteStatus
        ? (
            <p
              className={deleteStatus.type === 'success'
                ? `
                  text-sm text-gray-700
                  dark:text-gray-200
                `
                : `
                  text-sm text-red-500
                  dark:text-red-400
                `}
            >
              {deleteStatus.text}
            </p>
          )
        : null}
    </form>
  )
}
