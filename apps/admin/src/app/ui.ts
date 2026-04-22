export type StatusTone = 'done' | 'pending' | 'blocked'

export const adminSurfaceStyles
  = 'space-y-5 rounded-2xl border border-gray-200 bg-white/90 p-6 text-sm shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'

export const adminMetricCardStyles
  = 'rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm ring-1 ring-gray-900/5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10'

export const adminInsetCardStyles
  = 'rounded-xl border border-gray-200/80 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-950/40'

export const adminActionLinkStyles
  = 'inline-flex items-center justify-between rounded-xl border border-gray-300/80 bg-white px-4 py-3 text-sm font-medium text-gray-800 no-underline transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-gray-100'

// 移动端用 text-base (16px) 规避 iOS Safari 聚焦自动放大；桌面端维持 text-sm。
export const formControlStyles
  = 'w-full rounded-lg border border-gray-200 bg-white/80 px-3 py-2.5 text-base text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:text-sm dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900'

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
