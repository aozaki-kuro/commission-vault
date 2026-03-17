import { spawn } from 'node:child_process'
import process from 'node:process'

const workerPort = process.env.WORKER_PORT?.trim() || '8787'
const adminApiBaseUrl = process.env.ADMIN_API_BASE_URL?.trim() || `http://127.0.0.1:${workerPort}`

const children = new Set()
let stopping = false

function startProcess(name, args, extraEnv = {}) {
  const child = spawn('bun', args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)

    if (stopping) {
      return
    }

    stopping = true
    stopAll(signal ? 0 : (code ?? 1))
  })

  child.on('error', (error) => {
    if (stopping) {
      return
    }

    console.error(`[dev:admin] failed to start ${name}:`, error)
    stopping = true
    stopAll(1)
  })

  return child
}

function stopAll(exitCode = 0) {
  for (const child of children) {
    child.kill('SIGTERM')
  }

  setTimeout(() => {
    for (const child of children) {
      child.kill('SIGKILL')
    }
    process.exit(exitCode)
  }, 1200).unref()
}

process.on('SIGINT', () => {
  if (stopping) {
    return
  }
  stopping = true
  stopAll(0)
})

process.on('SIGTERM', () => {
  if (stopping) {
    return
  }
  stopping = true
  stopAll(0)
})

startProcess('admin-worker', ['run', '--cwd', 'apps/admin-worker', 'dev'])
startProcess('admin', ['run', '--cwd', 'apps/admin', 'dev'], {
  ADMIN_API_BASE_URL: adminApiBaseUrl,
})
