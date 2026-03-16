import type { AstroIntegration } from 'astro'
import path from 'node:path'
import process from 'node:process'

const SOURCE_IMAGE_PATH_PATTERN = /(?:^|\/)data\/images\/.+\.(?:jpe?g|png)$/

function isSourceImagePath(filePath: string) {
  const normalized = filePath.split(path.sep).join('/').toLowerCase()
  return SOURCE_IMAGE_PATH_PATTERN.test(normalized)
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

        server.watcher.on('add', triggerReload)
        server.watcher.on('change', triggerReload)
        server.watcher.on('unlink', triggerReload)
      },
    },
  }
}
