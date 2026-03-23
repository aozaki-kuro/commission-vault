import type { AstroUserConfig } from 'astro'
import { fileURLToPath } from 'node:url'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { assetsPipelineIntegration } from './server/assetsPipelineAstro'

type AstroVitePlugins = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>

// `@tailwindcss/vite` can resolve its own Vite 8 types in the monorepo while Astro 6
// still validates config against Vite 7. The runtime plugin works, but Astro check needs
// the plugin list coerced back onto Astro's config surface.
const vitePlugins: AstroVitePlugins = [
  tailwindcss() as unknown as AstroVitePlugins[number],
  tsconfigPaths(),
]

export default defineConfig({
  output: 'static',
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
      weights: [400, 600],
      styles: ['normal'],
    },
  ],

  integrations: [react(), assetsPipelineIntegration()],
  vite: {
    plugins: vitePlugins,
    resolve: {
      alias: {
        '@astrojs/react/server.js': fileURLToPath(new URL('./src/config/astroReactServerShim.ts', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules'))
              return
            if (id.includes('fuse.js'))
              return 'vendor-search'
            if (id.includes('@radix-ui') || id.includes('cmdk'))
              return 'vendor-ui'
            return 'vendor'
          },
        },
      },
    },
  },
})
