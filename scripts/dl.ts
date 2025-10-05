import { commissionData } from '#data/commissionData'
import dotenv from 'dotenv'
import fs from 'fs'
import { mkdir } from 'fs/promises'
import { IncomingMessage } from 'http'
import https from 'https'
import path from 'path'
import { pipeline } from 'stream/promises'

/**
 * 控制台输出颜色配置
 */
const COLORS = {
  ERROR: '\x1b[31m',
  SUCCESS: '\x1b[32m',
  RESET: '\x1b[0m',
} as const

/**
 * 日志输出工具
 */
const log = {
  error: (msg: string, err?: Error) =>
    console.error(
      `${COLORS.RESET}[${COLORS.ERROR} ERROR ${COLORS.RESET}] ${msg}${err ? `: ${err.message}` : ''}`,
    ),
  success: (msg: string) =>
    console.log(`${COLORS.RESET}[${COLORS.SUCCESS} DONE ${COLORS.RESET}] ${msg}`),
} as const

// 加载环境变量
dotenv.config()

/**
 * 应用配置接口
 */
interface Config {
  /** 远程主机地址 */
  hosting: string
  /** 是否为开发环境 */
  isDev: boolean
  /** 文件保存路径配置 */
  paths: {
    webp: string
    jpg: string
  }
}

/**
 * 应用配置
 */
const config: Config = {
  hosting: process.env.HOSTING || '',
  isDev: process.env.NODE_ENV === 'development',
  paths: {
    webp: path.join('public', 'images', 'webp'),
    jpg: path.join('public', 'images'),
  },
}

// 校验配置
if (!config.hosting) {
  log.error('DL links not set correctly in the environment or .env')
  process.exit(1)
}

/**
 * 获取远程文件流
 * @param url - 文件URL
 * @returns 文件流
 * @throws 当HTTP状态码不为200时抛出错误
 */
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

/**
 * 下载单个文件
 * @param url - 文件URL
 * @param destPath - 保存路径
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  try {
    const fileStream = await getFileStream(url)
    await mkdir(path.dirname(destPath), { recursive: true })
    await pipeline(fileStream, fs.createWriteStream(destPath))
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${(error as Error).message}`)
  }
}

/**
 * 为单个文件创建下载任务
 * @param fileName - 文件名
 * @returns 下载任务数组
 */
function createDownloadTasks(fileName: string): Promise<void>[] {
  // WebP 图片总是需要下载
  const tasks = [
    downloadFile(
      `https://${config.hosting}/nsfw-commission/webp/${fileName}.webp`,
      path.join(config.paths.webp, `${fileName}.webp`),
    ),
  ]

  // 开发环境下额外下载 JPG 图片
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

/**
 * 主下载函数
 * 并行下载所有文件，并处理错误
 */
async function downloadImages(): Promise<void> {
  const startTime = performance.now()

  try {
    // 创建并执行所有下载任务
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

// 执行下载并处理结果
downloadImages()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
