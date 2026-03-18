import type {
  CharacterAliasEntry,
  CharacterRecord,
  CreatorAliasEntry,
  GeneratedFactSourceContent,
  GeneratedFactSourceMeta,
  GeneratedSourceImageManifestFile,
  GeneratedSourceImageManifestMissing,
  KeywordAliasEntry,
} from '@commission-index/domain'
import type { SpawnSyncReturns } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
} from '../src/adminSourceImages'

interface ParsedArgs {
  outputRoot: string
  usePreview: boolean
}

interface CharacterRow {
  id: number
  name: string
  status: CharacterRecord['status']
  sortOrder: number
}

interface CommissionRow {
  characterId: number
  fileName: string
  links?: string | null
  design?: string | null
  description?: string | null
  hidden?: number | null
  keyword?: string | null
}

interface CreatorAliasRow {
  creatorName: string
  aliasesJson?: string | null
  aliases?: string | null
}

interface CharacterAliasRow {
  characterName: string
  aliasesJson?: string | null
  aliases?: string | null
}

interface KeywordAliasRow {
  baseKeyword: string
  aliasesJson?: string | null
  aliases?: string | null
}

interface FeaturedKeywordRow {
  keyword: string
}

interface SourceImageRow {
  byteSize: number
  commissionFileName: string
  mimeType: string
  objectKey: string
  sha256: string
}

interface ExportSourceImagesOptions {
  bucketName: string
  outputImagesDir: string
  sourceImageRows: SourceImageRow[]
}

interface ExportSourceImagesResult {
  files: GeneratedSourceImageManifestFile[]
  missing: GeneratedSourceImageManifestMissing[]
  hasHardFailure: boolean
  downloadedCount: number
  metadataUpserts: SourceImageRow[]
  reusedCount: number
}

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
const downloadFileWaitAttempts = 5
const downloadFileWaitMilliseconds = 50

function printHelp() {
  console.log(`
Usage: bun run ./scripts/exportWebFactSource.ts [options]

Options:
  --output-root <path>  Override generated output root (default: ../web/generated)
  --preview             Read preview D1 instead of production D1
  --help                Show this message
`.trim())
}

function parseArgs(argv: string[]): ParsedArgs {
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

function runWrangler(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('bunx', ['wrangler', ...args], {
    cwd,
    encoding: 'utf8',
  })
}

function runWranglerOrThrow(args: string[], label: string): string {
  const result = runWrangler(args)
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to ${label}.`)
  }

  return result.stdout
}

function executeRemoteStatements(statements: string[], {
  databaseBinding,
  usePreview,
}: {
  databaseBinding: string
  usePreview: boolean
}): unknown[][] {
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
  const payload = JSON.parse(stdout) as Array<{ results?: unknown[] }>

  if (!Array.isArray(payload) || payload.length < statements.length) {
    throw new Error('Unexpected D1 JSON payload shape.')
  }

  return payload.map(entry => entry?.results ?? [])
}

function parseLinks(rawValue: unknown): string[] {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(String(rawValue)) as unknown
    return Array.isArray(parsed) ? parsed.map(link => String(link)) : []
  }
  catch {
    return []
  }
}

function buildCharacterRecords(
  characterRows: CharacterRow[],
  commissionRows: CommissionRow[],
): CharacterRecord[] {
  const characters = new Map<number, CharacterRecord>(
    characterRows.map(row => [
      row.id,
      {
        id: Number(row.id),
        name: String(row.name),
        status: row.status,
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

function buildCreatorAliases(rows: CreatorAliasRow[]): CreatorAliasEntry[] {
  const aliasMap = new Map<string, string[]>()

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

function buildCharacterAliases(rows: CharacterAliasRow[]): CharacterAliasEntry[] {
  const aliasMap = new Map<string, CharacterAliasEntry>()

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

function buildKeywordAliases(rows: KeywordAliasRow[]): KeywordAliasEntry[] {
  const aliasMap = new Map<string, KeywordAliasEntry>()

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

function dedupeKeywords(keywords: Iterable<unknown>): string[] {
  const uniqueKeywords: string[] = []
  const seen = new Set<string>()

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

function buildFeaturedSearchKeywords(rows: FeaturedKeywordRow[]): string[] {
  return dedupeKeywords(rows.map(row => row.keyword))
}

function looksLikeMissingObject(message: string): boolean {
  return missingObjectPattern.test(message)
}

function ensureOutputImagePath(outputImagesDir: string, fileName: string): string {
  const safeName = path.basename(fileName)
  if (safeName !== fileName) {
    throw new Error(`Unsafe source image filename: ${fileName}`)
  }

  return path.join(outputImagesDir, safeName)
}

function hashFile(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function sleepSync(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function waitForFile(filePath: string) {
  for (let attempt = 0; attempt < downloadFileWaitAttempts; attempt += 1) {
    if (existsSync(filePath)) {
      return true
    }

    sleepSync(downloadFileWaitMilliseconds)
  }

  return false
}

function writeJsonFile(filePath: string, payload: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function sqlLiteral(value: unknown) {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL'
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  return `'${String(value).replaceAll('\'', '\'\'')}'`
}

function buildSourceImageFileRecord(
  commissionFileName: string,
  objectKey: string,
  filePath: string,
): GeneratedSourceImageManifestFile {
  const fileStats = statSync(filePath)

  return {
    commissionFileName,
    objectKey,
    relativePath: path.posix.join(imageOutputDirectoryName, objectKey),
    mimeType: getSourceImageMimeType(objectKey),
    byteSize: fileStats.size,
    sha256: hashFile(filePath),
  }
}

function buildSourceImageMetadataRow(record: GeneratedSourceImageManifestFile): SourceImageRow {
  return {
    byteSize: record.byteSize ?? 0,
    commissionFileName: record.commissionFileName,
    mimeType: record.mimeType,
    objectKey: record.objectKey,
    sha256: record.sha256,
  }
}

function buildSourceImageRowMap(rows: SourceImageRow[]) {
  return new Map(rows.map(row => [row.commissionFileName, row] as const))
}

function resolveReusableSourceImageRecord(
  outputImagesDir: string,
  sourceImageRow?: SourceImageRow,
): GeneratedSourceImageManifestFile | null {
  if (!sourceImageRow) {
    return null
  }

  const outputPath = ensureOutputImagePath(outputImagesDir, sourceImageRow.objectKey)
  if (!existsSync(outputPath)) {
    return null
  }

  const fileStats = statSync(outputPath)
  if (fileStats.size !== sourceImageRow.byteSize) {
    return null
  }

  if (hashFile(outputPath) !== sourceImageRow.sha256) {
    return null
  }

  return {
    commissionFileName: sourceImageRow.commissionFileName,
    objectKey: sourceImageRow.objectKey,
    relativePath: path.posix.join(imageOutputDirectoryName, sourceImageRow.objectKey),
    mimeType: sourceImageRow.mimeType || getSourceImageMimeType(sourceImageRow.objectKey),
    byteSize: sourceImageRow.byteSize,
    sha256: sourceImageRow.sha256,
  }
}

function cleanupStaleSourceImages(outputImagesDir: string, retainedObjectKeys: Set<string>) {
  if (!existsSync(outputImagesDir)) {
    return
  }

  for (const entry of readdirSync(outputImagesDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }

    if (!retainedObjectKeys.has(entry.name)) {
      rmSync(path.join(outputImagesDir, entry.name), { force: true })
    }
  }
}

function upsertRemoteSourceImageMetadataRows(
  rows: SourceImageRow[],
  {
    databaseBinding,
    usePreview,
  }: {
    databaseBinding: string
    usePreview: boolean
  },
) {
  if (rows.length === 0) {
    return
  }

  const statements = rows.map(row => `
    INSERT INTO source_images (
      commission_file_name,
      object_key,
      mime_type,
      byte_size,
      sha256,
      updated_at
    ) VALUES (
      ${sqlLiteral(row.commissionFileName)},
      ${sqlLiteral(row.objectKey)},
      ${sqlLiteral(row.mimeType)},
      ${sqlLiteral(row.byteSize)},
      ${sqlLiteral(row.sha256)},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(commission_file_name) DO UPDATE SET
      object_key = excluded.object_key,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size,
      sha256 = excluded.sha256,
      updated_at = CURRENT_TIMESTAMP
  `.trim())

  runWranglerOrThrow(
    [
      'd1',
      'execute',
      databaseBinding,
      '--config',
      wranglerConfigPath,
      '--remote',
      '--command',
      statements.join('; '),
      ...(usePreview ? ['--preview'] : []),
    ],
    `upsert source image metadata in remote D1 (${databaseBinding})`,
  )
}

function buildMeta({
  databaseBinding,
  imagesBucket,
}: {
  databaseBinding: string
  imagesBucket: string
}): GeneratedFactSourceMeta {
  return {
    schemaVersion: GENERATED_FACT_SOURCE_SCHEMA_VERSION,
    source: GENERATED_FACT_SOURCE_SOURCE,
    exportedAt: new Date().toISOString(),
    databaseBinding,
    imagesBucket,
  }
}

function listExpectedSourceImages(characters: CharacterRecord[]): string[] {
  const fileNames = new Set<string>()

  for (const character of characters) {
    for (const commission of character.commissions) {
      fileNames.add(commission.fileName)
    }
  }

  return [...fileNames].toSorted((left, right) => left.localeCompare(right))
}

function downloadSourceImageObject(
  bucketName: string,
  objectKey: string,
  outputPath: string,
) {
  let result: SpawnSyncReturns<string> | null = null
  let hardFailureMessage = ''

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

    if (result.status === 0 && waitForFile(outputPath)) {
      return { message: '', ok: true }
    }

    const message = result.status === 0
      ? `Downloaded ${bucketName}/${objectKey} but file was not written to ${outputPath}.`
      : (result.stderr || result.stdout || '').trim()

    rmSync(outputPath, { force: true })

    if (looksLikeMissingObject(message)) {
      return { message, ok: false }
    }

    if (attempt === maxDownloadAttempts) {
      hardFailureMessage = message
    }
  }

  return {
    message: hardFailureMessage || (result?.stderr || result?.stdout || '').trim(),
    ok: false,
  }
}

function exportSourceImages(
  fileNames: string[],
  { bucketName, outputImagesDir, sourceImageRows }: ExportSourceImagesOptions,
): ExportSourceImagesResult {
  const files: GeneratedSourceImageManifestFile[] = []
  const missing: GeneratedSourceImageManifestMissing[] = []
  const metadataUpserts: SourceImageRow[] = []
  const retainedObjectKeys = new Set<string>()
  const sourceImageRowMap = buildSourceImageRowMap(sourceImageRows)
  let hasHardFailure = false
  let downloadedCount = 0
  let reusedCount = 0

  mkdirSync(outputImagesDir, { recursive: true })

  for (const commissionFileName of fileNames) {
    const candidateObjectKeys = buildSourceImageCandidateKeys(commissionFileName)
    const sourceImageRow = sourceImageRowMap.get(commissionFileName)
    const reusableRecord = resolveReusableSourceImageRecord(outputImagesDir, sourceImageRow)
    if (reusableRecord) {
      files.push(reusableRecord)
      retainedObjectKeys.add(reusableRecord.objectKey)
      reusedCount += 1
      continue
    }

    const orderedCandidateObjectKeys = sourceImageRow
      ? [sourceImageRow.objectKey, ...candidateObjectKeys.filter(key => key !== sourceImageRow.objectKey)]
      : candidateObjectKeys
    let exported = false
    let hardFailureMessage = ''

    for (const objectKey of orderedCandidateObjectKeys) {
      const outputPath = ensureOutputImagePath(outputImagesDir, objectKey)
      const tempOutputPath = `${outputPath}.download`
      rmSync(tempOutputPath, { force: true })

      const downloadResult = downloadSourceImageObject(bucketName, objectKey, tempOutputPath)
      if (downloadResult.ok) {
        const record = buildSourceImageFileRecord(commissionFileName, objectKey, tempOutputPath)
        rmSync(outputPath, { force: true })
        writeFileSync(outputPath, readFileSync(tempOutputPath))
        rmSync(tempOutputPath, { force: true })

        files.push(record)
        retainedObjectKeys.add(record.objectKey)
        downloadedCount += 1

        if (
          !sourceImageRow
          || sourceImageRow.objectKey !== record.objectKey
          || sourceImageRow.byteSize !== record.byteSize
          || sourceImageRow.sha256 !== record.sha256
          || sourceImageRow.mimeType !== record.mimeType
        ) {
          metadataUpserts.push(buildSourceImageMetadataRow(record))
        }

        if (sourceImageRow && sourceImageRow.objectKey !== record.objectKey) {
          rmSync(ensureOutputImagePath(outputImagesDir, sourceImageRow.objectKey), { force: true })
        }

        exported = true
        break
      }

      rmSync(tempOutputPath, { force: true })

      const message = downloadResult.message
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
        candidateObjectKeys: orderedCandidateObjectKeys,
        reason: 'download_failed',
        message: hardFailureMessage || undefined,
      })
      continue
    }

    missing.push({
      commissionFileName,
      candidateObjectKeys: orderedCandidateObjectKeys,
      reason: 'not_found',
    })
  }

  cleanupStaleSourceImages(outputImagesDir, retainedObjectKeys)

  return {
    files,
    missing,
    hasHardFailure,
    downloadedCount,
    metadataUpserts,
    reusedCount,
  }
}

function loadRemoteFactSource({
  databaseBinding,
  usePreview,
}: {
  databaseBinding: string
  usePreview: boolean
}): Omit<GeneratedFactSourceContent, 'meta'> & { sourceImages: SourceImageRow[] } {
  const statements = [
    'SELECT id, name, status, sort_order as sortOrder FROM characters ORDER BY sort_order ASC, id ASC',
    'SELECT character_id as characterId, file_name as fileName, links, design, description, hidden, keyword FROM commissions ORDER BY character_id ASC, id ASC',
    'SELECT creator_name as creatorName, aliases as aliasesJson FROM creator_aliases ORDER BY creator_name ASC',
    'SELECT character_name as characterName, aliases as aliasesJson FROM character_aliases ORDER BY character_name ASC',
    'SELECT base_keyword as baseKeyword, aliases as aliasesJson FROM keyword_aliases ORDER BY base_keyword ASC',
    'SELECT keyword, sort_order as sortOrder FROM home_featured_search_keywords ORDER BY sort_order ASC, keyword ASC',
    'SELECT commission_file_name as commissionFileName, object_key as objectKey, mime_type as mimeType, byte_size as byteSize, sha256 FROM source_images ORDER BY commission_file_name ASC',
  ]

  const [
    rawCharacterRows,
    rawCommissionRows,
    rawCreatorAliasRows,
    rawCharacterAliasRows,
    rawKeywordAliasRows,
    rawFeaturedKeywordRows,
    rawSourceImageRows,
  ] = executeRemoteStatements(statements, {
    databaseBinding,
    usePreview,
  })

  const characters = buildCharacterRecords(
    rawCharacterRows as CharacterRow[],
    rawCommissionRows as CommissionRow[],
  )

  return {
    characters,
    creatorAliases: buildCreatorAliases(rawCreatorAliasRows as CreatorAliasRow[]),
    characterAliases: buildCharacterAliases(rawCharacterAliasRows as CharacterAliasRow[]),
    keywordAliases: buildKeywordAliases(rawKeywordAliasRows as KeywordAliasRow[]),
    featuredSearchKeywords: buildFeaturedSearchKeywords(rawFeaturedKeywordRows as FeaturedKeywordRow[]),
    sourceImages: (rawSourceImageRows as SourceImageRow[]).map(row => ({
      byteSize: Number(row.byteSize),
      commissionFileName: String(row.commissionFileName),
      mimeType: String(row.mimeType),
      objectKey: String(row.objectKey),
      sha256: String(row.sha256),
    })),
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
  } satisfies GeneratedFactSourceContent)

  // ==================== 导出 source images 到 generated 目录 ====================
  const expectedSourceImages = listExpectedSourceImages(factSource.characters)
  const imageExport = exportSourceImages(expectedSourceImages, {
    bucketName: defaultBucketName,
    outputImagesDir,
    sourceImageRows: factSource.sourceImages,
  })

  upsertRemoteSourceImageMetadataRows(imageExport.metadataUpserts, {
    databaseBinding: defaultDatabaseBinding,
    usePreview,
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
      `materializedImages=${imageExport.files.length}`,
      `downloadedImages=${imageExport.downloadedCount}`,
      `reusedImages=${imageExport.reusedCount}`,
      `metadataUpserts=${imageExport.metadataUpserts.length}`,
      `missingImages=${imageExport.missing.length}`,
    ].join(' | '),
  )

  if (imageExport.hasHardFailure) {
    process.exit(1)
  }
}

main()
