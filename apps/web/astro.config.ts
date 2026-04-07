import type { AstroUserConfig } from 'astro'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'
import { assetsPipelineIntegration } from './server/assetsPipelineAstro'

type AstroVitePlugins = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>

// `@tailwindcss/vite` can resolve its own Vite 8 types in the monorepo while Astro 6
// still validates config against Vite 7. The runtime plugin works, but Astro check needs
// the plugin list coerced back onto Astro's config surface.
const vitePlugins: AstroVitePlugins = [
  tailwindcss() as unknown as AstroVitePlugins[number],
]

export default defineConfig({
  output: 'static',
  // Persist image cache outside node_modules so it survives dependency reinstalls
  cacheDir: '.astro',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-tw', 'ja'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-ibm-plex-sans',
      weights: [400, 600, 700],
      styles: ['normal'],
    },
    {
      provider: fontProviders.local(),
      name: 'Berkeley Mono',
      cssVariable: '--font-berkeley-mono',
      options: {
        variants: [
          {
            weight: 400,
            style: 'normal',
            display: 'swap',
            src: ['./src/assets/fonts/BerkeleyMono-Regular.woff2'],
          },
        ],
      },
    },
  ],

  integrations: [assetsPipelineIntegration()],
  vite: {
    plugins: vitePlugins,
    resolve: {
      // @ts-expect-error Vite 6+ native option; Astro's bundled Vite types lag behind
      tsconfigPaths: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules'))
              return
            if (id.includes('fuse.js'))
              return 'vendor-search'
            return 'vendor'
          },
        },
      },
    },
  },
})
