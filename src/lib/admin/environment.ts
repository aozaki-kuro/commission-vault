import process from 'node:process'

export function isDevelopmentWriteEnabled(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'development'
}

export function ensureDevelopmentWriteEnabled() {
  if (!isDevelopmentWriteEnabled()) {
    throw new Error('Writable database operations are only available in development mode.')
  }
}
