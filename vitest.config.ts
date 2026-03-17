import { resolve } from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const rootDir = import.meta.dirname

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [
        resolve(rootDir, 'tsconfig.json'),
        resolve(rootDir, 'apps/web/tsconfig.json'),
        resolve(rootDir, 'apps/admin/tsconfig.json'),
        resolve(rootDir, 'apps/admin-worker/tsconfig.json'),
      ],
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: [resolve(rootDir, 'apps/web/test/setup.tsx')],
    include: [
      'apps/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.tsx',
      'apps/*/data/**/*.test.ts',
      'apps/*/server/**/*.test.ts',
      'apps/*/test/**/*.test.ts',
      'apps/*/test/**/*.test.tsx',
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'packages/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      'apps/*/test/visual/**',
    ],
    coverage: {
      reportsDirectory: './coverage/vitest',
    },
  },
})
