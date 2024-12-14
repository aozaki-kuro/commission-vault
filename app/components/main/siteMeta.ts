import { Metadata } from 'next'

const Site = 'NSFW Commission'
const Description = 'The collection of commissioned NSFW illustrations / Do Not Repost'
const twitterCard = `https://img.crystallize.cc/nsfw-cover-s.webp`
const CanonicalUrl = 'https://crystallize.cc'

export const SiteMeta: Metadata = {
  metadataBase: new URL(CanonicalUrl),

  /* No index */
  robots: 'noindex',

  /* Base */
  title: Site,
  description: Description,

  /* OpenGraph */
  openGraph: {
    title: Site,
    siteName: Site,
    description: Description,
    images: twitterCard,
    type: 'website',
    url: CanonicalUrl,
  },

  /* Twitter */
  twitter: {
    site: '@CrystallizeSub',
  },

  applicationName: Site,

  icons: {
    icon: [{ url: '/favicon/icon.png' }, new URL('/icon.png?v=20231031', CanonicalUrl)],
    shortcut: ['/favicon/android-chrome-192x192.png'],
    apple: [
      { url: '/favicon/apple-touch-icon.png' },
      { url: '/favicon/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/favicon/apple-touch-icon.png',
      },
    ],
  },
}
