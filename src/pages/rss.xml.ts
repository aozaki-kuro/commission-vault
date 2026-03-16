import type { APIRoute } from 'astro'
import { generateRssFeed } from '#lib/rss/feed'

export const GET: APIRoute = async () => {
  return new Response(`${generateRssFeed()}\n`, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
