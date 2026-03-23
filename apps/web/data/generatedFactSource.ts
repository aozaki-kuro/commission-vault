import type {
  GeneratedFactSourceContent,
  GeneratedSourceImageManifest,
} from '@commission-index/domain'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const isDevelopment = process.env.NODE_ENV === 'development'
const generatedDirectoryName = 'generated'
const factSourceDirectoryName = 'fact-source'

let cachedFactSourceContent: GeneratedFactSourceContent | null = null
let cachedSourceImageManifest: GeneratedSourceImageManifest | null = null

function resolveGeneratedFactSourcePath(fileName: string) {
  const cwdPath = path.join(process.cwd(), generatedDirectoryName, factSourceDirectoryName, fileName)
  if (fs.existsSync(cwdPath)) {
    return cwdPath
  }

  const workspacePath = path.join(
    process.cwd(),
    'apps',
    'web',
    generatedDirectoryName,
    factSourceDirectoryName,
    fileName,
  )
  if (fs.existsSync(workspacePath)) {
    return workspacePath
  }

  return cwdPath
}

export function hasGeneratedFactSourceFile(fileName: string) {
  return fs.existsSync(resolveGeneratedFactSourcePath(fileName))
}

export function hasGeneratedFactSourceContent() {
  return hasGeneratedFactSourceFile('content.json')
}

function readGeneratedJsonFile<T>(fileName: string): T {
  const filePath = resolveGeneratedFactSourcePath(fileName)
  if (!hasGeneratedFactSourceFile(fileName)) {
    throw new Error(
      `Generated fact source file not found at ${filePath}. Run \`bun run web:fact-source:export\` or \`bun run build:web\` first.`,
    )
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse generated fact source file ${filePath}: ${message}`)
  }
}

export function getGeneratedFactSourceContent(): GeneratedFactSourceContent {
  if (!isDevelopment && cachedFactSourceContent) {
    return cachedFactSourceContent
  }

  const content = readGeneratedJsonFile<GeneratedFactSourceContent>('content.json')
  if (!isDevelopment) {
    cachedFactSourceContent = content
  }
  return content
}

export function getGeneratedSourceImageManifest(): GeneratedSourceImageManifest {
  if (!isDevelopment && cachedSourceImageManifest) {
    return cachedSourceImageManifest
  }

  const manifest = readGeneratedJsonFile<GeneratedSourceImageManifest>('source-images-manifest.json')
  if (!isDevelopment) {
    cachedSourceImageManifest = manifest
  }
  return manifest
}
