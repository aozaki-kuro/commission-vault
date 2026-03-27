export type StatusTone = 'done' | 'pending' | 'blocked'

export const adminSurfaceStyles
  = 'space-y-5 rounded-2xl border border-gray-200 bg-white/90 p-6 text-sm shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'

export const adminMetricCardStyles
  = 'rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'

export const adminInsetCardStyles
  = 'rounded-xl border border-gray-200/80 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-950/40'

export const adminActionLinkStyles
  = 'inline-flex items-center justify-between rounded-xl border border-gray-300/80 bg-white px-4 py-3 text-sm font-medium text-gray-800 no-underline transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-gray-100'

export const formControlStyles
  = 'w-full rounded-lg border border-gray-200 bg-white/80 px-3 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900'

export function getStatusBadgeStyles(tone: StatusTone) {
  switch (tone) {
    case 'done':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
    case 'blocked':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-100'
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100'
  }
}

export type RebuildTone = 'default' | 'success' | 'error'

const rebuildButtonBase
  = 'w-28 shrink-0 rounded-lg border px-4 py-2 text-center text-xs font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50'

export function getRebuildButtonStyles(tone: RebuildTone) {
  switch (tone) {
    case 'error':
      return `${rebuildButtonBase} border-red-300 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100 focus-visible:ring-red-400 dark:border-red-700 dark:bg-red-500/15 dark:text-red-200 dark:hover:border-red-600 dark:hover:bg-red-500/25 dark:focus-visible:ring-red-500 dark:focus-visible:ring-offset-gray-900`
    case 'success':
      return `${rebuildButtonBase} border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 focus-visible:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/25 dark:focus-visible:ring-emerald-500 dark:focus-visible:ring-offset-gray-900`
    default:
      return `${rebuildButtonBase} border-amber-500 bg-amber-500 text-white hover:border-amber-400 hover:bg-amber-400 focus-visible:ring-amber-400 dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950 dark:hover:border-amber-300 dark:hover:bg-amber-300 dark:focus-visible:ring-amber-300 dark:focus-visible:ring-offset-gray-900`
  }
}
