export function DropIndicator() {
  return (
    <div
      aria-hidden="true"
      className="
        pointer-events-none relative flex h-0.5 items-center
      "
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
