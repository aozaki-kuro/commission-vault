import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const cwd = process.cwd()
const imagesDir = path.resolve(cwd, '../web/data/images')
const wranglerConfigPath = path.resolve(cwd, './wrangler.jsonc')
const defaultBucketName = process.env.ADMIN_WORKER_IMAGES_BUCKET?.trim() || 'commission-index-source-images'

const rawArgs = process.argv.slice(2)
const fromArgIndex = rawArgs.findIndex(arg => arg === '--from')
const bucketNameArgIndex = rawArgs.findIndex(arg => arg === '--bucket')
const fromFileName = fromArgIndex >= 0 ? rawArgs[fromArgIndex + 1] || '' : ''
const bucketName = bucketNameArgIndex >= 0
  ? rawArgs[bucketNameArgIndex + 1] || defaultBucketName
  : defaultBucketName
const maxAttempts = 3
const IMAGE_FILE_PATTERN = /\.(?:jpg|jpeg|png)$/i

if (!bucketName) {
  throw new Error('R2 bucket name is required.')
}

function getMimeType(fileName) {
  const lowerCaseName = fileName.toLowerCase()
  if (lowerCaseName.endsWith('.png')) {
    return 'image/png'
  }

  if (lowerCaseName.endsWith('.jpeg')) {
    return 'image/jpeg'
  }

  return 'image/jpeg'
}

function runWrangler(args) {
  return spawnSync('bunx', ['wrangler', ...args], {
    cwd,
    stdio: 'inherit',
  })
}

const imageFiles = readdirSync(imagesDir)
  .filter(fileName => IMAGE_FILE_PATTERN.test(fileName))
  .sort((left, right) => left.localeCompare(right))
  .filter(fileName => !fromFileName || fileName.localeCompare(fromFileName) >= 0)

if (imageFiles.length === 0) {
  console.log('No source images found to upload.')
  process.exit(0)
}

for (const fileName of imageFiles) {
  const objectPath = `${bucketName}/${fileName}`
  const args = [
    'r2',
    'object',
    'put',
    objectPath,
    '--config',
    wranglerConfigPath,
    '--file',
    path.resolve(imagesDir, fileName),
    '--content-type',
    getMimeType(fileName),
    '--remote',
  ]

  let success = false

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runWrangler(args)
    if (result.status === 0) {
      success = true
      break
    }

    if (attempt < maxAttempts) {
      console.error(`Retrying ${fileName} (${attempt + 1}/${maxAttempts})...`)
    }
  }

  if (!success) {
    console.error(`Failed to upload ${fileName} after ${maxAttempts} attempts.`)
    process.exit(1)
  }
}

console.log(`Uploaded ${imageFiles.length} source images to ${bucketName} (remote).`)
