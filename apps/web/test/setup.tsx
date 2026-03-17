import path from 'node:path'
import process from 'node:process'
import { afterEach } from 'vitest'

const appRoot = path.resolve(import.meta.dirname, '..')

if (process.cwd() !== appRoot) {
  process.chdir(appRoot)
}

const isJsdom = typeof window !== 'undefined' && typeof document !== 'undefined'

if (isJsdom) {
  void import('@testing-library/jest-dom/vitest')
  void import('@testing-library/react').then(({ cleanup }) => {
    afterEach(() => {
      cleanup()
    })
  })
}
