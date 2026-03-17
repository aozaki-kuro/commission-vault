import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Database } from 'bun:sqlite'

const cwd = process.cwd()
const sourceDbPath = path.resolve(cwd, '../web/data/commissions.db')
const imagesDir = path.resolve(cwd, '../web/data/images')
const wranglerConfigPath = path.resolve(cwd, './wrangler.jsonc')
const persistToPath = path.resolve(cwd, './.wrangler/state')
const defaultBucketName = process.env.ADMIN_WORKER_IMAGES_BUCKET?.trim() || 'commission-index-source-images'
const useRemote = process.argv.includes('--remote')
const modeFlag = useRemote ? '--remote' : '--local'
const IMAGE_FILE_PATTERN = /\.(?:jpg|jpeg|png)$/i

function runCommand(args) {
  const result = spawnSync('bunx', ['wrangler', ...args], {
    cwd,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: wrangler ${args.join(' ')}`)
  }

  return result.stdout
}

function loadLocalCounts() {
  const db = new Database(sourceDbPath, { readonly: true })

  const counts = {
    characters: Number(db.query('SELECT COUNT(*) AS count FROM characters').get().count ?? 0),
    commissions: Number(db.query('SELECT COUNT(*) AS count FROM commissions').get().count ?? 0),
    creator_aliases: Number(db.query('SELECT COUNT(*) AS count FROM creator_aliases').get().count ?? 0),
    character_aliases: Number(db.query('SELECT COUNT(*) AS count FROM character_aliases').get().count ?? 0),
    keyword_aliases: Number(db.query('SELECT COUNT(*) AS count FROM keyword_aliases').get().count ?? 0),
    home_featured_search_keywords: Number(
      db.query('SELECT COUNT(*) AS count FROM home_featured_search_keywords').get().count ?? 0,
    ),
  }

  db.close()
  return counts
}

function loadWorkerCounts() {
  const args = [
    'd1',
    'execute',
    'DB',
    '--config',
    wranglerConfigPath,
    '--json',
    modeFlag,
    '--command',
    [
      'SELECT COUNT(*) AS characters_count FROM characters',
      'SELECT COUNT(*) AS commissions_count FROM commissions',
      'SELECT COUNT(*) AS creator_aliases_count FROM creator_aliases',
      'SELECT COUNT(*) AS character_aliases_count FROM character_aliases',
      'SELECT COUNT(*) AS keyword_aliases_count FROM keyword_aliases',
      'SELECT COUNT(*) AS featured_keywords_count FROM home_featured_search_keywords',
    ].join('; '),
  ]

  if (!useRemote) {
    args.push('--persist-to', persistToPath)
  }

  const stdout = runCommand(args)
  const payload = JSON.parse(stdout)

  return {
    characters: Number(payload[0]?.results?.[0]?.characters_count ?? 0),
    commissions: Number(payload[1]?.results?.[0]?.commissions_count ?? 0),
    creator_aliases: Number(payload[2]?.results?.[0]?.creator_aliases_count ?? 0),
    character_aliases: Number(payload[3]?.results?.[0]?.character_aliases_count ?? 0),
    keyword_aliases: Number(payload[4]?.results?.[0]?.keyword_aliases_count ?? 0),
    home_featured_search_keywords: Number(payload[5]?.results?.[0]?.featured_keywords_count ?? 0),
  }
}

function checkR2Coverage() {
  const imageFiles = readdirSync(imagesDir)
    .filter(fileName => IMAGE_FILE_PATTERN.test(fileName))
    .sort((left, right) => left.localeCompare(right))

  const missing = []

  for (const fileName of imageFiles) {
    const args = [
      'r2',
      'object',
      'get',
      `${defaultBucketName}/${fileName}`,
      '--pipe',
      modeFlag,
    ]

    if (!useRemote) {
      args.push('--persist-to', persistToPath)
    }

    const result = spawnSync('bunx', ['wrangler', ...args], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
    })

    if (result.status !== 0) {
      missing.push(fileName)
    }
  }

  return {
    totalLocalImages: imageFiles.length,
    missing,
  }
}

const localCounts = loadLocalCounts()
const workerCounts = loadWorkerCounts()
const imageCoverage = checkR2Coverage()

const mismatchedTables = Object.entries(localCounts)
  .filter(([tableName, count]) => workerCounts[tableName] !== count)
  .map(([tableName, count]) => ({
    tableName,
    local: count,
    worker: workerCounts[tableName],
  }))

const summary = {
  mode: useRemote ? 'remote' : 'local',
  localCounts,
  workerCounts,
  mismatchedTables,
  imageCoverage: {
    totalLocalImages: imageCoverage.totalLocalImages,
    missingCount: imageCoverage.missing.length,
    missing: imageCoverage.missing,
  },
}

console.log(JSON.stringify(summary, null, 2))

if (mismatchedTables.length > 0 || imageCoverage.missing.length > 0) {
  process.exit(1)
}
