import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CommissionRow,
} from '@commission-index/domain'
import { IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { CommissionEditForm } from './CommissionEditForm'

const SM_BREAKPOINT = '(min-width: 640px)'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SM_BREAKPOINT).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(SM_BREAKPOINT)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

interface CommissionEditDrawerProps {
  characters: CharacterRow[]
  commission: CommissionRow | null
  commissionSearchRows: AdminCommissionSearchRow[]
  onClose: () => void
  onDelete: () => void
  onSaveSuccess: (updated: CommissionRow) => void
  open: boolean
}

interface EditPanelBodyProps {
  characters: CharacterRow[]
  commission: CommissionRow | null
  commissionSearchRows: AdminCommissionSearchRow[]
  onDelete: () => void
  onSaveSuccess: (updated: CommissionRow) => void
}

function EditPanelBody({
  characters,
  commission,
  commissionSearchRows,
  onDelete,
  onSaveSuccess,
}: EditPanelBodyProps) {
  if (!commission)
    return null
  return (
    <CommissionEditForm
      key={commission.id}
      characters={characters}
      commission={commission}
      commissionSearchRows={commissionSearchRows}
      onDelete={onDelete}
      onSaveSuccess={onSaveSuccess}
    />
  )
}

export function CommissionEditDrawer({
  characters,
  commission,
  commissionSearchRows,
  onClose,
  onDelete,
  onSaveSuccess,
  open,
}: CommissionEditDrawerProps) {
  const isDesktop = useIsDesktop()

  // 关闭动画期间保留上一次的 commission 数据，防止内容塌缩
  const lastCommissionRef = useRef<CommissionRow | null>(null)
  if (commission) {
    lastCommissionRef.current = commission
  }
  const displayCommission = commission ?? lastCommissionRef.current

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen)
            onClose()
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              <p className="
                truncate text-base font-semibold text-gray-900
                dark:text-gray-100
              "
              >
                {displayCommission?.fileName ?? ''}
              </p>
              <p className="
                truncate text-sm text-gray-500
                dark:text-gray-400
              "
              >
                {displayCommission?.characterName ?? ''}
              </p>
            </DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <EditPanelBody
              characters={characters}
              commission={displayCommission}
              commissionSearchRows={commissionSearchRows}
              onDelete={onDelete}
              onSaveSuccess={onSaveSuccess}
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen)
          onClose()
      }}
      direction="bottom"
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="
            fixed inset-0 z-60 bg-black/15 backdrop-blur-sm
          "
        />
        <Drawer.Content
          aria-describedby={undefined}
          className="
            fixed right-0 bottom-0 left-0 z-70 flex max-h-[85dvh] flex-col
            rounded-t-2xl bg-white shadow-2xl outline-none
            dark:bg-gray-950
          "
        >
          <div className="
            flex shrink-0 items-center justify-between border-b
            border-gray-200 px-5 py-4
            dark:border-gray-800
          "
          >
            <Drawer.Title className="min-w-0 flex-1">
              <p className="
                truncate text-base font-semibold text-gray-900
                dark:text-gray-100
              "
              >
                {displayCommission?.fileName ?? ''}
              </p>
              <p className="
                truncate text-sm text-gray-500
                dark:text-gray-400
              "
              >
                {displayCommission?.characterName ?? ''}
              </p>
            </Drawer.Title>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="
                ml-3 inline-flex size-8 shrink-0 items-center
                justify-center rounded-lg bg-gray-100 text-gray-600
                transition
                hover:bg-gray-200 hover:text-gray-900
                focus-visible:ring-2 focus-visible:ring-gray-400
                focus-visible:ring-offset-2 focus-visible:ring-offset-white
                focus-visible:outline-none
                dark:bg-gray-800 dark:text-gray-300
                dark:hover:bg-gray-700 dark:hover:text-gray-100
                dark:focus-visible:ring-offset-gray-950
              "
            >
              <IconX className="size-4" stroke={2} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <EditPanelBody
              characters={characters}
              commission={displayCommission}
              commissionSearchRows={commissionSearchRows}
              onDelete={onDelete}
              onSaveSuccess={onSaveSuccess}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
