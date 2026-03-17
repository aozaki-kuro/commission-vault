import type { CharacterCommissions } from '#data/types'
import { describe, expect, it } from 'vitest'
import {
  buildCommissionTimeline,
  buildTimelineYearNavItem,
  getTimelineYearSectionId,
  getTimelineYearTitleId,
} from './timeline'

describe('timeline helpers', () => {
  it('builds stable year section and title ids', () => {
    expect(getTimelineYearSectionId('2025')).toBe('timeline-year-2025')
    expect(getTimelineYearTitleId('2025')).toBe('title-timeline-year-2025')
    expect(buildTimelineYearNavItem('2025')).toEqual({
      displayName: '2025',
      sectionId: 'timeline-year-2025',
      titleId: 'title-timeline-year-2025',
      sectionHash: '#timeline-year-2025',
      titleHash: '#title-timeline-year-2025',
    })
  })

  it('groups commissions by year in descending fileName order', () => {
    const commissionMap = new Map<string, CharacterCommissions>([
      ['nero', {
        Character: 'Nero',
        Commissions: [
          { fileName: '20250101_AAA', Links: [] },
          { fileName: '20240101_BBB', Links: [] },
        ],
      }],
      ['artoria', {
        Character: 'Artoria',
        Commissions: [
          { fileName: '20250302_CCC', Links: [] },
          { fileName: '20240203_DDD', Links: [] },
        ],
      }],
    ])

    const { groups, navItems } = buildCommissionTimeline(commissionMap)

    expect(groups.map(group => group.yearKey)).toEqual(['2025', '2024'])
    expect(groups[0]?.entries.map(entry => entry.commission.fileName)).toEqual([
      '20250302_CCC',
      '20250101_AAA',
    ])
    expect(groups[1]?.entries.map(entry => entry.commission.fileName)).toEqual([
      '20240203_DDD',
      '20240101_BBB',
    ])
    expect(navItems).toEqual(groups.map(group => group.navItem))
  })
})
