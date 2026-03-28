import type { Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Remove ", url(...woff) format('woff')" from @fontsource src declarations.
// Browsers that support ES modules all support woff2, so the .woff fallback
// is dead weight in the build output.
const WOFF_SRC_RE = /,\s*url\([^)]+\.woff\)\s*format\(['"]woff['"]\)/g

function fontsourceWoff2Only(): Plugin {
  return {
    name: 'fontsource-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.endsWith('.css')) {
        return
      }
      return code.replace(WOFF_SRC_RE, '')
    },
  }
}

export default defineConfig({
  envPrefix: ['VITE_', 'ADMIN_'],
  plugins: [
    fontsourceWoff2Only(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'react-vendor'
          }
          return undefined
        },
      },
    },
  },
})
