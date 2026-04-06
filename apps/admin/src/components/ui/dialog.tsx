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
          fixed inset-0 z-60 bg-black/15 backdrop-blur-sm
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

function DialogContent({
  ref,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Content> | null>
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          `
            fixed top-1/2 left-1/2 z-70 flex max-h-[85vh] w-full max-w-2xl
            -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
            rounded-2xl bg-white shadow-xl ring-1 ring-black/8
            dark:bg-gray-950 dark:ring-white/10
            data-[state=open]:animate-[dialog-content-in_200ms_ease-out]
            data-[state=closed]:animate-[dialog-content-out_150ms_ease-in]
          `,
          className,
        )}
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
