import * as DialogPrimitive from '@radix-ui/react-dialog'
import { IconX } from '@tabler/icons-react'
import * as React from 'react'
import { cn } from '../../lib/cn'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogPortal = DialogPrimitive.Portal

function DialogOverlay({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Overlay> | null>
}) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        `
          fixed inset-0 z-60 bg-black/30 backdrop-blur-md
          data-[state=open]:animate-[dialog-overlay-in_150ms_ease-out]
          data-[state=closed]:animate-[dialog-overlay-in_150ms_ease-in_reverse]
        `,
        className,
      )}
      {...props}
    />
  )
}
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentVariant = 'default' | 'sheet'

const dialogContentBase = {
  // 默认：始终居中浮层
  default: `
    fixed top-1/2 left-1/2 z-70 flex max-h-[85vh] w-full max-w-2xl
    -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
    rounded-2xl bg-white shadow-2xl ring-1 ring-black/10
    dark:bg-gray-950 dark:ring-white/10
    data-[state=open]:animate-[dialog-content-in_200ms_ease-out]
    data-[state=closed]:animate-[dialog-content-out_150ms_ease-in]
  `,
  // sheet：移动端全屏，>=sm 退化为居中浮层；避免 vaul 那种 fixed+transform 触发的键盘异常。
  sheet: `
    fixed inset-0 z-70 flex flex-col overflow-hidden bg-white
    dark:bg-gray-950
    data-[state=open]:animate-[dialog-content-in_200ms_ease-out]
    data-[state=closed]:animate-[dialog-content-out_150ms_ease-in]
    sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-2xl
    sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-2xl
    sm:ring-1 sm:ring-black/10
    sm:dark:ring-white/10
  `,
} as const satisfies Record<DialogContentVariant, string>

function DialogContent({
  ref,
  className,
  children,
  variant = 'default',
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Content> | null>
  variant?: DialogContentVariant
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogContentBase[variant], className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center border-b border-gray-200 px-5 py-4 dark:border-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogTitle({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Title> | null>
}) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('min-w-0 flex-1', className)}
      {...props}
    />
  )
}
DialogTitle.displayName = DialogPrimitive.Title.displayName

function DialogCloseButton({ className }: { className?: string }) {
  return (
    <DialogClose asChild>
      <button
        type="button"
        className={cn(
          `
            ml-3 inline-flex size-8 shrink-0 items-center justify-center rounded-lg
            bg-gray-100 text-gray-600 transition
            hover:bg-gray-200 hover:text-gray-900
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-gray-400 focus-visible:ring-offset-2
            focus-visible:ring-offset-white
            dark:bg-gray-800 dark:text-gray-300
            dark:hover:bg-gray-700 dark:hover:text-gray-100
            dark:focus-visible:ring-offset-gray-950
          `,
          className,
        )}
        aria-label="Close"
      >
        <IconX className="size-4" stroke={2} aria-hidden="true" />
      </button>
    </DialogClose>
  )
}

export {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
