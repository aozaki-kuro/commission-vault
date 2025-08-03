import { formatDate, parseDateString } from '#lib/date'
import { getBaseFileName, kebabCase } from '#lib/strings'
import { mergePartsAndPreviews, sortCommissionsByDate } from '#lib/commissions'
import { commissionData } from '#data/commissionData'
import { Commission } from '#data/types'

const SITE_TITLE = "Crystallize's Commission Vault"
const SITE_URL = 'https://crystallize.cc'

interface CommissionWithName extends Commission {
  characterFullName: string
}

interface RssItem {
  title: string
  link: string
  pubDate: string
  author: string
  description: string
  enclosure: string
}

function buildItem(commission: CommissionWithName): RssItem {
  const cleanedFileName = getBaseFileName(commission.fileName)
  const [datePart, artistPartWithExt] = cleanedFileName.split('_')
  const artistName = artistPartWithExt ? artistPartWithExt.split('.')[0] : 'Anonymous'
  const dateObj = parseDateString(datePart)!
  const pubDate = dateObj.toUTCString()
  const formatted = formatDate(dateObj, 'yyyy/MM/dd')
  const link = `${SITE_URL}#${encodeURIComponent(kebabCase(commission.characterFullName))}-${datePart}`
  const imageUrl = `https://img.crystallize.cc/nsfw-commission/webp/${commission.fileName}.webp`
  const description = `<![CDATA[Illustrator: ${artistName}, published on ${formatted}]]>`
  return {
    title: commission.characterFullName,
    link,
    pubDate,
    author: artistName,
    description,
    enclosure: `<enclosure url="${imageUrl}" type="image/jpeg" />`,
  }
}

export const rssItems: RssItem[] = (() => {
  const flattened = commissionData.flatMap(character =>
    character.Commissions.map(commission => ({
      ...commission,
      characterFullName: character.Character,
    })),
  ) as CommissionWithName[]

  const unique = mergePartsAndPreviews(flattened)
  const sorted = Array.from(unique.values()).sort(sortCommissionsByDate) as CommissionWithName[]

  return sorted.map(buildItem)
})()

export function generateRssFeed(): string {
  const items = rssItems
    .map(
      item =>
        `\n    <item>\n      <title>${item.title}</title>\n      <link>${item.link}</link>\n      <pubDate>${item.pubDate}</pubDate>\n      <author>${item.author}</author>\n      <description>${item.description}</description>\n      ${item.enclosure}\n    </item>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${SITE_TITLE}</title>\n    <link>${SITE_URL}</link>\n    <description>Feed from Crystallize</description>\n    <language>en-US</language>\n    <webMaster>Crystallize</webMaster>\n    <ttl>60</ttl>${items}\n  </channel>\n</rss>`
}
