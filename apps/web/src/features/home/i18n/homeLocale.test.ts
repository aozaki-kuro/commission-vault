import { getHomeLocaleMessages } from '@features/home/i18n/homeLocale'
import { describe, expect, it } from 'vitest'

describe('homeLocale archived summary formatter', () => {
  it('formats english archived character summary with both counts', () => {
    const messages = getHomeLocaleMessages('en')

    expect(messages.controls.formatCollapsedArchivedSummary(2, 31)).toBe(
      '2 Archived Characters / 31 commissions',
    )
    expect(messages.controls.formatCollapsedArchivedSummary(1, 1)).toBe(
      '1 Archived Character / 1 commission',
    )
  })

  it('formats traditional chinese archived character summary with both counts', () => {
    const messages = getHomeLocaleMessages('zh-tw')

    expect(messages.controls.formatCollapsedArchivedSummary(2, 31)).toBe('2 位停更角色 / 31 筆委託')
  })

  it('formats japanese archived character summary with both counts', () => {
    const messages = getHomeLocaleMessages('ja')

    expect(messages.controls.formatCollapsedArchivedSummary(2, 31)).toBe(
      '停止中キャラクター 2 人 / コミッション 31 件',
    )
  })
})
