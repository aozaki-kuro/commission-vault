import { generateRssFeed } from '#lib/rss'

export const generateStaticParams = async () => []

export async function GET() {
  return new Response(generateRssFeed(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
