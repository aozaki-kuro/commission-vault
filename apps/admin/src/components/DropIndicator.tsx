interface DropIndicatorProps {
  /** Override the default vertical offset (e.g. "-top-1.5" for smaller gaps) */
  offsetClass?: string
}

export function DropIndicator({ offsetClass = '-top-2.5' }: DropIndicatorProps) {
  return (
    <div
      aria-hidden="true"
      className={`
        pointer-events-none absolute inset-x-0 z-10 flex h-0.5
        items-center
        ${offsetClass}
      `}
    >
      <div className="
        size-1.5 shrink-0 rounded-full bg-blue-500
        dark:bg-blue-400
      "
      />
      <div className="
        h-0.5 flex-1 bg-blue-500
        dark:bg-blue-400
      "
      />
      <div className="
        size-1.5 shrink-0 rounded-full bg-blue-500
        dark:bg-blue-400
      "
      />
    </div>
  )
}
