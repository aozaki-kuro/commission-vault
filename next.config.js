/** @type {import('next').NextConfig} */
const securityHeaders = [
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-DNS-Prefetch-Control
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Feature-Policy
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const noRobots = [
  {
    key: 'X-Robots-Tag',
    value: 'noindex',
  },
]

const nextConfig = {
  reactStrictMode: true,
  cleanDistDir: true,
  images: {
    // unoptimized: process.env.CF_PAGES === 'true' ? true : false,
    unoptimized: true,
    minimumCacheTTL: 604800,
  },

  // Ignore Lint during Build
  eslint: {
    ignoreDuringBuilds: true,
  },

  ...(process.env.CF_PAGES === 'true'
    ? /*
       * If true = Cloudflare Pages
       */
      {
        /*
         * pnpm prebuild && pnpx @cloudflare/next-on-pages
         * Change output dir: .vercel/output/static
         * Add compability flag: nodejs_compat
         * Then you can disable output: 'export'
         */
        output: 'export', // Use static output for Cloudflare Pages
      }
    : /*
       * If false = Not Cloudflare Pages
       */
      {
        // Add headers when NOT on Cloudflare Pages
        async headers() {
          return [
            {
              source: '/(.*)',
              headers: [...securityHeaders, ...noRobots],
            },
          ]
        },

        // Plausible Analytics
        async rewrites() {
          return [
            {
              source: '/sight/app.js',
              destination: 'https://sight.aozaki.cc/app-event.js',
            },
            {
              source: '/sight/event',
              destination: 'https://sight.aozaki.cc/api/event',
            },
          ]
        },
      }),
}

module.exports = nextConfig
