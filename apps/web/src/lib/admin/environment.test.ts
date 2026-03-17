import { afterEach, describe, expect, it, vi } from 'vitest'

describe('admin environment gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('only enables writes in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { isDevelopmentWriteEnabled } = await import('./environment')

    expect(isDevelopmentWriteEnabled()).toBe(true)
    expect(isDevelopmentWriteEnabled('test')).toBe(false)
    expect(isDevelopmentWriteEnabled('production')).toBe(false)
  })
})
