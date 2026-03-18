import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  GENERATED_FACT_SOURCE_SCHEMA_VERSION,
  GENERATED_FACT_SOURCE_SOURCE,
  normalizeAliases,
  normalizeCharacterAliases,
  normalizeCharacterAliasKey,
  normalizeCharacterAliasName,
  normalizeCreatorName,
  normalizeKeywordAliases,
  normalizeKeywordAliasKey,
  normalizeKeywordBaseTerm,
  parseAliasesJson,
  parseCharacterAliasesJson,
  parseKeywordAliasesJson,
} from '@commission-index/domain'
import {
  buildSourceImageCandidateKeys,
  getSourceImageMimeType,
} from '../src/adminSourceImages.ts'

const cwd = process.cwd()
const wranglerConfigPath = path.resolve(cwd, './wrangler.jsonc')
const defaultOutputRoot = path.resolve(cwd, '../web/generated')
const defaultDatabaseBinding = process.env.ADMIN_WORKER_DB_BINDING?.trim() || 'DB'
const defaultBucketName = process.env.ADMIN_WORKER_IMAGES_BUCKET?.trim() || 'commission-index-source-images'
const imageOutputDirectoryName = 'source-images'
const factSourceDirectoryName = 'fact-source'
const normalizeSpacesPattern = /\s+/g
const missingObjectPattern = /NoSuchKey|The specified key does not exist|not found|404/i
const maxDownloadAttempts = 3

function printHelp() {
  console.log(`
Usage: bun run ./scripts/exportWebFactSource.mjs [options]

Options:
  --output-root <path>  Override generated output root (default: ../web/generated)
  --preview             Read preview D1 instead of production D1
  --help                Show this message
`.trim())
}

function parseArgs(argv) {
  let outputRoot = defaultOutputRoot
  let usePreview = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--preview') {
      usePreview = true
      continue
    }

    if (arg === '--output-root') {
      const nextValue = argv[index + 1]
      if (!nextValue) {
        throw new Error('--output-root requires a path value.')
      }

      outputRoot = path.resolve(cwd, nextValue)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { outputRoot, usePreview }
}

function runWrangler(args) {
  return spawnSync('bunx', ['wrangler', ...args], {
    cwd,
    encoding: 'utf8',
  })
}

function runWranglerOrThrow(args, label) {
  const result = runWrangler(args)
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to ${label}.`)
  }

  return result.stdout
}

function executeRemoteStatements(statements, { databaseBinding, usePreview }) {
  const args = [
    'd1',
    'execute',
    databaseBinding,
    '--config',
    wranglerConfigPath,
    '--json',
    '--remote',
    '--command',
    statements.join('; '),
  ]

  if (usePreview) {
    args.splice(6, 0, '--preview')
  }

  const stdout = runWranglerOrThrow(args, `query remote D1 (${databaseBinding})`)
  const payload = JSON.parse(stdout)

  if (!Array.isArray(payload) || payload.length < statements.length) {
    throw new Error('Unexpected D1 JSON payload shape.')
  }

  return payload.map(entry => entry?.results ?? [])
}

function parseLinks(rawValue) {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.map(link => String(link)) : []
  }
  catch {
    return []
  }
}

function buildCharacterRecords(characterRows, commissionRows) {
  const characters = new Map(
    characterRows.map(row => [
      row.id,
      {
        id: Number(row.id),
        name: String(row.name),
        status: String(row.status),
        sortOrder: Number(row.sortOrder),
        commissions: [],
      },
    ]),
  )

  for (const row of commissionRows) {
    const character = characters.get(Number(row.characterId))
    if (!character) {
      continue
    }

    character.commissions.push({
      fileName: String(row.fileName),
      Links: parseLinks(row.links),
      Design: row.design ? String(row.design) : undefined,
      Description: row.description ? String(row.description) : undefined,
      Keyword: row.keyword ? String(row.keyword) : undefined,
      Hidden: Boolean(row.hidden ?? 0),
    })
  }

  return [...characters.values()].toSorted((left, right) => left.sortOrder - right.sortOrder)
}

function buildCreatorAliases(rows) {
  const aliasMap = new Map()

  for (const row of rows) {
    const creatorName = normalizeCreatorName(String(row.creatorName))
    if (!creatorName) {
      continue
    }

    const aliases = parseAliasesJson(String(row.aliasesJson ?? row.aliases ?? '[]'))
    aliasMap.set(
      creatorName,
      normalizeAliases([...(aliasMap.get(creatorName) ?? []), ...aliases]),
    )
  }

  return Array.from(aliasMap.entries(), ([creatorName, aliases]) => ({
    creatorName,
    aliases,
  })).toSorted((left, right) => left.creatorName.localeCompare(right.creatorName, 'ja'))
}

function buildCharacterAliases(rows) {
  const aliasMap = new Map()

  for (const row of rows) {
    const normalizedCharacterName = normalizeCharacterAliasName(String(row.characterName))
    if (!normalizedCharacterName) {
      continue
    }

    const key = normalizeCharacterAliasKey(normalizedCharacterName)
    if (!key) {
      continue
    }

    const aliases = parseCharacterAliasesJson(String(row.aliasesJson ?? row.aliases ?? '[]'))
    const previous = aliasMap.get(key)
    aliasMap.set(key, {
      characterName: previous?.characterName ?? normalizedCharacterName,
      aliases: normalizeCharacterAliases([...(previous?.aliases ?? []), ...aliases]),
    })
  }

  return [...aliasMap.values()].toSorted((left, right) =>
    left.characterName.localeCompare(right.characterName, 'ja'))
}

function buildKeywordAliases(rows) {
  const aliasMap = new Map()

  for (const row of rows) {
    const baseKeyword = normalizeKeywordBaseTerm(String(row.baseKeyword))
    if (!baseKeyword) {
      continue
    }

    const key = normalizeKeywordAliasKey(baseKeyword)
    if (!key) {
      continue
    }

    const aliases = parseKeywordAliasesJson(String(row.aliasesJson ?? row.aliases ?? '[]'))
    const previous = aliasMap.get(key)
    aliasMap.set(key, {
      baseKeyword: previous?.baseKeyword ?? baseKeyword,
      aliases: normalizeKeywordAliases([...(previous?.aliases ?? []), ...aliases]),
    })
  }

  return [...aliasMap.values()].toSorted((left, right) =>
    left.baseKeyword.localeCompare(right.baseKeyword, 'ja'))
}

function dedupeKeywords(keywords) {
  const uniqueKeywords = []
  const seen = new Set()

  for (const keyword of keywords) {
    const normalized = String(keyword).trim().replace(normalizeSpacesPattern, ' ')
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueKeywords.push(normalized)
  }

  return uniqueKeywords
}

function buildFeaturedSearchKeywords(rows) {
  return dedupeKeywords(rows.map(row => row.keyword))
}

function looksLikeMissingObject(message) {
  return missingObjectPattern.test(message)
}

function ensureOutputImagePath(outputImagesDir, fileName) {
  const safeName = path.basename(fileName)
  if (safeName !== fileName) {
    throw new Error(`Unsafe source image filename: ${fileName}`)
  }

  return path.join(outputImagesDir, safeName)
}

function writeJsonFile(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function buildMeta({ databaseBinding, imagesBucket }) {
  return {
    schemaVersion: GENERATED_FACT_SOURCE_SCHEMA_VERSION,
    source: GENERATED_FACT_SOURCE_SOURCE,
    exportedAt: new Date().toISOString(),
    databaseBinding,
    imagesBucket,
  }
}

function listExpectedSourceImages(characters) {
  const fileNames = new Set()

  for (const character of characters) {
    for (const commission of character.commissions) {
      fileNames.add(commission.fileName)
    }
  }

  return [...fileNames].toSorted((left, right) => left.localeCompare(right))
}

function exportSourceImages(fileNames, { bucketName, outputImagesDir }) {
  const files = []
  const missing = []
  let hasHardFailure = false

  rmSync(outputImagesDir, { recursive: true, force: true })
  mkdirSync(outputImagesDir, { recursive: true })

  for (const commissionFileName of fileNames) {
    const candidateObjectKeys = buildSourceImageCandidateKeys(commissionFileName)
    let exported = false
    let hardFailureMessage = ''

    for (const objectKey of candidateObjectKeys) {
      const relativePath = path.posix.join(imageOutputDirectoryName, objectKey)
      const outputPath = ensureOutputImagePath(outputImagesDir, objectKey)
      let result = null

      for (let attempt = 1; attempt <= maxDownloadAttempts; attempt += 1) {
        result = runWrangler([
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

        if (result.status === 0) {
          break
        }

        const message = (result.stderr || result.stdout || '').trim()
        if (looksLikeMissingObject(message) || attempt === maxDownloadAttempts) {
          break
        }
      }

      if (result?.status === 0) {
        const fileStats = statSync(outputPath)
        files.push({
          commissionFileName,
          objectKey,
          relativePath,
          mimeType: getSourceImageMimeType(objectKey),
          byteSize: fileStats.size,
        })
        exported = true
        break
      }

      rmSync(outputPath, { force: true })

      const message = (result?.stderr || result?.stdout || '').trim()
      if (!looksLikeMissingObject(message)) {
        hardFailureMessage = message
        break
      }
    }

    if (exported) {
      continue
    }

    if (hardFailureMessage) {
      hasHardFailure = true
      missing.push({
        commissionFileName,
        candidateObjectKeys,
        reason: 'download_failed',
        message: hardFailureMessage || undefined,
      })
      continue
    }

    missing.push({
      commissionFileName,
      candidateObjectKeys,
      reason: 'not_found',
    })
  }

  return { files, missing, hasHardFailure }
}

function loadRemoteFactSource({ databaseBinding, usePreview }) {
  const statements = [
    'SELECT id, name, status, sort_order as sortOrder FROM characters ORDER BY sort_order ASC, id ASC',
    'SELECT character_id as characterId, file_name as fileName, links, design, description, hidden, keyword FROM commissions ORDER BY character_id ASC, id ASC',
    'SELECT creator_name as creatorName, aliases as aliasesJson FROM creator_aliases ORDER BY creator_name ASC',
    'SELECT character_name as characterName, aliases as aliasesJson FROM character_aliases ORDER BY character_name ASC',
    'SELECT base_keyword as baseKeyword, aliases as aliasesJson FROM keyword_aliases ORDER BY base_keyword ASC',
    'SELECT keyword, sort_order as sortOrder FROM home_featured_search_keywords ORDER BY sort_order ASC, keyword ASC',
  ]

  const [
    characterRows,
    commissionRows,
    creatorAliasRows,
    characterAliasRows,
    keywordAliasRows,
    featuredKeywordRows,
  ] = executeRemoteStatements(statements, {
    databaseBinding,
    usePreview,
  })

  const characters = buildCharacterRecords(characterRows, commissionRows)

  return {
    characters,
    creatorAliases: buildCreatorAliases(creatorAliasRows),
    characterAliases: buildCharacterAliases(characterAliasRows),
    keywordAliases: buildKeywordAliases(keywordAliasRows),
    featuredSearchKeywords: buildFeaturedSearchKeywords(featuredKeywordRows),
  }
}

function main() {
  const { outputRoot, usePreview } = parseArgs(process.argv.slice(2))
  const factSourceDir = path.join(outputRoot, factSourceDirectoryName)
  const outputImagesDir = path.join(outputRoot, imageOutputDirectoryName)

  // ==================== 导出结构化事实源 ====================
  const factSource = loadRemoteFactSource({
    databaseBinding: defaultDatabaseBinding,
    usePreview,
  })

  const meta = buildMeta({
    databaseBinding: defaultDatabaseBinding,
    imagesBucket: defaultBucketName,
  })

  writeJsonFile(path.join(factSourceDir, 'content.json'), {
    meta,
    characters: factSource.characters,
    creatorAliases: factSource.creatorAliases,
    characterAliases: factSource.characterAliases,
    keywordAliases: factSource.keywordAliases,
    featuredSearchKeywords: factSource.featuredSearchKeywords,
  })

  // ==================== 导出 source images 到 generated 目录 ====================
  const expectedSourceImages = listExpectedSourceImages(factSource.characters)
  const imageExport = exportSourceImages(expectedSourceImages, {
    bucketName: defaultBucketName,
    outputImagesDir,
  })

  writeJsonFile(path.join(factSourceDir, 'source-images-manifest.json'), {
    meta,
    files: imageExport.files,
    missing: imageExport.missing,
  })

  console.log(
    [
      `Exported generated fact source to ${outputRoot}`,
      `characters=${factSource.characters.length}`,
      `creatorAliases=${factSource.creatorAliases.length}`,
      `characterAliases=${factSource.characterAliases.length}`,
      `keywordAliases=${factSource.keywordAliases.length}`,
      `featuredKeywords=${factSource.featuredSearchKeywords.length}`,
      `downloadedImages=${imageExport.files.length}`,
      `missingImages=${imageExport.missing.length}`,
    ].join(' | '),
  )

  if (imageExport.hasHardFailure) {
    process.exit(1)
  }
}

main()
