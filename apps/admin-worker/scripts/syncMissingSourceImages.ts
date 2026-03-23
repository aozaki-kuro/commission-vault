/**
 * Fast pre-dev image sync: reads the existing manifest and downloads only missing images from R2.
 * Unlike exportWebFactSource, this never queries D1 — just checks local files against the manifest.
 * If all images are present locally, exits immediately with no network calls.
 */
import type { GeneratedSourceImageManifest } from '@commission-index/domain'
import type { SpawnSyncReturns } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const adminWorkerRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(adminWorkerRoot, '../..')
const configuredWranglerConfigPath = process.env.FACT_SOURCE_WRANGLER_CONFIG?.trim()
const wranglerConfigPath = path.resolve(
  adminWorkerRoot,
  configuredWranglerConfigPath && configuredWranglerConfigPath.length > 0
    ? configuredWranglerConfigPath
    : './wrangler.jsonc',
)
const localWranglerBinPath = path.resolve(repoRoot, 'node_modules/.bin/wrangler')
const localWranglerCmdBinPath = path.resolve(repoRoot, 'node_modules/.bin/wrangler.cmd')
const defaultBucketName
  = process.env.FACT_SOURCE_IMAGES_BUCKET?.trim()
    || process.env.ADMIN_WORKER_IMAGES_BUCKET?.trim()
    || 'commission-index-images'
const webRoot = path.resolve(adminWorkerRoot, '../web')
const generatedRoot = path.resolve(webRoot, 'generated')
const manifestPath = path.resolve(generatedRoot, 'fact-source/source-images-manifest.json')
const outputImagesDir = path.resolve(generatedRoot, 'source-images')
const maxDownloadAttempts = 3
const missingObjectPattern = /NoSuchKey|The specified key does not exist|not found|404/i

function runWrangler(args: string[]): SpawnSyncReturns<string> {
  const wranglerCommand = existsSync(localWranglerBinPath)
    ? localWranglerBinPath
    : (existsSync(localWranglerCmdBinPath) ? localWranglerCmdBinPath : 'wrangler')

  return spawnSync(wranglerCommand, args, {
    cwd: adminWorkerRoot,
    encoding: 'utf8',
  })
}

function downloadImage(bucketName: string, objectKey: string, outputPath: string): boolean {
  for (let attempt = 1; attempt <= maxDownloadAttempts; attempt++) {
    const result = runWrangler([
      'r2',
      'object',
      'get',
      `${bucketName}/${objectKey}`,
      '--config',
      wranglerConfigPath,
      '--file',
      outputPath,
      '--remote',
    ])

    if (result.status === 0 && existsSync(outputPath)) {
      return true
    }

    const message = (result.stderr || result.stdout || '').trim()
    rmSync(outputPath, { force: true })

    if (missingObjectPattern.test(message)) {
      console.error(`  ✗ Not found in R2: ${objectKey}`)
      return false
    }

    if (attempt < maxDownloadAttempts) {
      console.error(`  Retry ${attempt}/${maxDownloadAttempts}: ${message}`)
    }
    else {
      console.error(`  ✗ Download failed after ${maxDownloadAttempts} attempts: ${objectKey}\n    ${message}`)
    }
  }

  return false
}

function main() {
  // ==================== 读取 manifest ====================
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found at ${manifestPath}`)
    console.error('Run `bun run fact-source:export` first to generate it.')
    process.exit(1)
  }

  let manifest: GeneratedSourceImageManifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GeneratedSourceImageManifest
  }
  catch (e) {
    console.error(`Failed to parse manifest: ${e}`)
    process.exit(1)
  }

  const { files } = manifest

  // ==================== 快速检查：哪些图片缺失 ====================
  const missingFiles = files.filter(file => !existsSync(path.join(outputImagesDir, file.objectKey)))

  if (missingFiles.length === 0) {
    console.log(`Source images OK (${files.length}/${files.length} present locally)`)
    return
  }

  console.log(`Downloading ${missingFiles.length} missing source image(s) from R2...`)
  mkdirSync(outputImagesDir, { recursive: true })

  let failCount = 0
  for (const file of missingFiles) {
    const outputPath = path.join(outputImagesDir, file.objectKey)
    const tempPath = `${outputPath}.download`
    rmSync(tempPath, { force: true })

    process.stdout.write(`  ↓ ${file.objectKey} ... `)
    const ok = downloadImage(defaultBucketName, file.objectKey, tempPath)
    if (ok) {
      writeFileSync(outputPath, readFileSync(tempPath))
      rmSync(tempPath, { force: true })
      console.log('done')
    }
    else {
      rmSync(tempPath, { force: true })
      failCount++
    }
  }

  const downloaded = missingFiles.length - failCount
  console.log(`Downloaded ${downloaded}/${missingFiles.length} images`)

  if (failCount > 0) {
    console.error(`${failCount} image(s) failed. Run \`bun run fact-source:export\` to retry.`)
    process.exit(1)
  }
}

main()
