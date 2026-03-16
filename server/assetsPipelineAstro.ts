import type { AstroIntegration } from 'astro'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const SOURCE_IMAGE_PATH_PATTERN = /(?:^|\/)data\/images\/.+\.(?:jpe?g|png)$/
const ASSET_PIPELINE_REASON_ENV = 'ASSET_PIPELINE_REASON'
const ASSET_PIPELINE_EVAL = `
  import('./src/lib/pipeline/assets.ts')
    .then(({ runFullAssetPipeline }) => runFullAssetPipeline(process.env.${ASSET_PIPELINE_REASON_ENV} ?? 'manual'))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
`

function isSourceImagePath(filePath: string) {
  const normalized = filePath.split(path.sep).join('/').toLowerCase()
  return SOURCE_IMAGE_PATH_PATTERN.test(normalized)
}

async function runAssetPipelineInBun(reason: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['--eval', ASSET_PIPELINE_EVAL], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        [ASSET_PIPELINE_REASON_ENV]: reason,
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`assets pipeline command exited with code ${code ?? 'null'}`))
    })
  })
}

async function runAssetPipelineWithLog({
  reason,
  failOnError,
  logPrefix,
  logger,
}: {
  reason: string
  failOnError: boolean
  logPrefix: string
  logger: { info: (message: string) => void, error: (message: string) => void }
}) {
  const startedAt = Date.now()
  logger.info(`[${logPrefix}] start reason=${reason}`)

  try {
    await runAssetPipelineInBun(reason)
    logger.info(`[${logPrefix}] done in ${Date.now() - startedAt}ms`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[${logPrefix}] failed: ${message}`)
    if (failOnError) {
      throw error
    }
  }
}

export function assetsPipelineIntegration(): AstroIntegration {
  return {
    name: 'assets-pipeline',
    hooks: {
      'astro:server:setup': async ({ server, logger }) => {
        const triggerReload = (filePath: string) => {
          if (!isSourceImagePath(filePath))
            return

          const relativePath = path.relative(process.cwd(), filePath)
          logger.info(`[assets/dev-watch] source image changed: ${relativePath}`)
          logger.info('[assets/dev-watch] trigger full reload')
          server.ws.send({ type: 'full-reload' })
        }

        await runAssetPipelineWithLog({
          reason: 'astro-dev-startup',
          failOnError: false,
          logPrefix: 'assets/dev-startup',
          logger,
        })

        server.watcher.on('add', triggerReload)
        server.watcher.on('change', triggerReload)
        server.watcher.on('unlink', triggerReload)
      },
      'astro:build:start': async ({ logger }) => {
        await runAssetPipelineWithLog({
          reason: 'astro-build-start',
          failOnError: true,
          logPrefix: 'assets/build-start',
          logger,
        })
      },
    },
  }
}
