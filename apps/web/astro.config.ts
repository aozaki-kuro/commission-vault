import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { assetsPipelineIntegration } from './server/assetsPipelineAstro'
import { devAdminIntegration } from './server/devAdminAstro'

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

  integrations: [react(), assetsPipelineIntegration(), devAdminIntegration()],
  vite: {
    plugins: [tailwindcss(), tsconfigPaths()],
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
