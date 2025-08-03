import { formatDate, parseDateString } from '#lib/date'
import { getBaseFileName, kebabCase } from '#lib/strings'
import { mergePartsAndPreviews, sortCommissionsByDate } from '#lib/commissions'
import { commissionData } from '#data/commissionData'
import { Commission } from '#data/types'

const SITE_TITLE = "Crystallize's Commission Vault"
const SITE_URL = 'https://crystallize.cc'

interface CommissionWithFullName extends Commission {
  characterFullName: string
}

interface CommissionDetails {
  rawCommissionDate: string
  commissionDate: string // 标准的 RSS 日期格式
  formattedDate: string // 自定义的日期格式
  artistName: string | null
}

function extractDetailsFromFileName(fileName: string): CommissionDetails {
  const cleanedFileName = getBaseFileName(fileName)
  const [datePart, artistPartWithExt] = cleanedFileName.split('_')
  const artistName = artistPartWithExt ? artistPartWithExt.split('.')[0] : null

  const date = parseDateString(datePart)
  if (!date) {
    throw new Error(`Invalid date format in fileName: ${fileName}`)
  }

  const commissionDate = date.toUTCString()
  const formattedDate = formatDate(date, 'yyyy/MM/dd')

  return {
    rawCommissionDate: datePart,
    commissionDate,
    formattedDate,
    artistName,
  }
}

function generateRssItem(commission: CommissionWithFullName): string {
  const { commissionDate, formattedDate, artistName, rawCommissionDate } =
    extractDetailsFromFileName(commission.fileName)
  const { characterFullName } = commission
  const imageUrl = `https://img.crystallize.cc/nsfw-commission/webp/${commission.fileName}.webp`
  const link = `${SITE_URL}#${encodeURIComponent(kebabCase(characterFullName))}-${rawCommissionDate}`
  const description = `<![CDATA[Illustrator: ${artistName || 'Anonymous'}, published on ${formattedDate}]]>`

  return `
    <item>
      <title>${characterFullName}</title>
      <link>${link}</link>
      <pubDate>${commissionDate}</pubDate>
      <author>${artistName || 'Anonymous'}</author>
      <description>${description}</description>
      <enclosure url="${imageUrl}" type="image/jpeg" />
    </item>
  `
}

function generateRssFeed(items: string[]): string {
  return `
    <rss version="2.0">
      <channel>
        <title>${SITE_TITLE}</title>
        <link>${SITE_URL}</link>
        <description>Feed from Crystallize</description>
        <language>en-US</language>
        <webMaster>Crystallize</webMaster>
        <ttl>60</ttl>
        ${items.join('')}
      </channel>
    </rss>
  `
}

export const generateStaticParams = async () => {
  return []
}

export async function GET() {
  const allCommissions = commissionData.flatMap(characterData =>
    characterData.Commissions.map(commission => ({
      ...commission,
      characterFullName: characterData.Character,
    })),
  ) as CommissionWithFullName[]

  const uniqueCommissions = mergePartsAndPreviews(allCommissions)

  const commissionsArray = Array.from(uniqueCommissions.values()) as CommissionWithFullName[]

  const sortedCommissions = commissionsArray.sort(sortCommissionsByDate)

  const rssItems = sortedCommissions.map(generateRssItem)

  const rssFeed = generateRssFeed(rssItems)

  return new Response(rssFeed, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
