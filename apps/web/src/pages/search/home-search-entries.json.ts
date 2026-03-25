import type { APIRoute } from 'astro'
import { buildHomeSearchEntries } from '@lib/pipeline/homeSearchEntries'

export const GET: APIRoute = async () => {
  const entries = buildHomeSearchEntries()
  return new Response(`${JSON.stringify(entries, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
