import { commissionData } from '#data/commissionData'
import dotenv from 'dotenv'
import fs from 'fs'
import { mkdir } from 'fs/promises'
import { IncomingMessage } from 'http'
import https from 'https'
import path from 'path'
import { pipeline } from 'stream/promises'

const COLORS = {
  ERROR: '\x1b[31m',
  SUCCESS: '\x1b[32m',
  RESET: '\x1b[0m',
} as const

const log = {
  error: (msg: string, err?: Error) =>
    console.error(
      `${COLORS.RESET}[${COLORS.ERROR} ERROR ${COLORS.RESET}] ${msg}${err ? `: ${err.message}` : ''}`,
    ),
  success: (msg: string) =>
    console.log(`${COLORS.RESET}[${COLORS.SUCCESS} DONE ${COLORS.RESET}] ${msg}`),
} as const

dotenv.config()

interface Config {
  hosting: string
  isDev: boolean
  paths: {
    webp: string
    jpg: string
  }
}

const config: Config = {
  hosting: process.env.HOSTING || '',
  isDev: process.env.NODE_ENV === 'development',
  paths: {
    webp: path.join('public', 'images', 'webp'),
    jpg: path.join('public', 'images'),
  },
}

if (!config.hosting) {
  log.error('DL links not set correctly in the environment or .env')
  process.exit(1)
}

async function getFileStream(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    https
      .get(url, response => {
        const { statusCode } = response
        if (statusCode !== 200) {
          reject(new Error(`HTTP ${statusCode}`))
          return
        }
        resolve(response)
      })
      .on('error', reject)
  })
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  try {
    const fileStream = await getFileStream(url)
    await mkdir(path.dirname(destPath), { recursive: true })
    await pipeline(fileStream, fs.createWriteStream(destPath))
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${(error as Error).message}`)
  }
}

function createDownloadTasks(fileName: string): Promise<void>[] {
  const tasks = [
    downloadFile(
      `https://${config.hosting}/nsfw-commission/webp/${fileName}.webp`,
      path.join(config.paths.webp, `${fileName}.webp`),
    ),
  ]

  if (config.isDev) {
    tasks.push(
      downloadFile(
        `https://${config.hosting}/nsfw-commission/${fileName}.jpg`,
        path.join(config.paths.jpg, `${fileName}.jpg`),
      ),
    )
  }

  return tasks
}

async function downloadImages(): Promise<void> {
  const startTime = performance.now()

  try {
    const tasks = commissionData.flatMap(char =>
      char.Commissions.flatMap(comm => createDownloadTasks(comm.fileName)),
    )

    await Promise.all(tasks)

    const elapsed = Math.round(performance.now() - startTime)
    log.success(`Downloads completed in ${elapsed}ms`)
  } catch (error) {
    log.error('Download process failed', error as Error)
    process.exit(1)
  }
}

downloadImages()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
