import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const MSG = {
  ERROR: '\x1b[0m[\x1b[31m ERROR \x1b[0m]',
  SUCCESS: '\x1b[0m[\x1b[32m DONE \x1b[0m]',
  WARN: '\x1b[0m[\x1b[33m WARN \x1b[0m]',
} as const

const DIRS = {
  input: path.join(process.cwd(), 'public/images'),
  webp: path.join(process.cwd(), 'public/images/webp'),
}

const JPG_CONFIG = { quality: 95, progressive: true, chromaSubsampling: '4:4:4', mozjpeg: true }
const WEBP_CONFIG = { quality: 80 }
const SUPPORTED_EXTS = new Set(['.jpg', '.png'])

async function fileExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function needsUpdate(src: string, dest: string) {
  try {
    const [s, d] = await Promise.all([fs.stat(src), fs.stat(dest)])
    return d.mtime < s.mtime
  } catch {
    return true
  }
}

async function convertImage(file: string) {
  const { name, ext } = path.parse(file)
  const jpg = path.join(DIRS.input, `${name}.jpg`)
  const png = path.join(DIRS.input, `${name}.png`)
  const webp = path.join(DIRS.webp, `${name}.webp`)

  try {
    if (ext === '.jpg') {
      if (await fileExists(png)) return 'skipped'
      if (!(await needsUpdate(jpg, webp))) return 'skipped'
      await sharp(jpg).webp(WEBP_CONFIG).toFile(webp)
      return 'processed'
    }

    if (await needsUpdate(png, jpg)) {
      await sharp(png).jpeg(JPG_CONFIG).withMetadata().toFile(jpg)
      await fs.unlink(png)
      return 'processed'
    }
    return 'skipped'
  } catch {
    return 'failed'
  }
}

async function main() {
  await fs.mkdir(DIRS.webp, { recursive: true })
  const files = await fs.readdir(DIRS.input)
  const stats = { processed: 0, skipped: 0, failed: [] as string[] }

  await Promise.all(
    files
      .filter(f => SUPPORTED_EXTS.has(path.extname(f).toLowerCase()))
      .map(async f => {
        const res = await convertImage(f)
        if (res === 'processed') stats.processed++
        else if (res === 'skipped') stats.skipped++
        else stats.failed.push(f)
      }),
  )

  const total = stats.processed + stats.skipped + stats.failed.length
  if (stats.failed.length) {
    console.warn(`${MSG.WARN} Processed ${total} files, but failed: ${stats.failed.join(', ')}`)
  } else {
    console.log(`${MSG.SUCCESS} Processed ${total} files`)
  }
}

main().catch(err => {
  console.error(`${MSG.ERROR} ${err}`)
  process.exit(1)
})
