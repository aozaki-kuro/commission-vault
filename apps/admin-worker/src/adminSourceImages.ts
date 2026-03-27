const VALID_FILE_NAME_PATTERN = /^\d{8}(?:_.+)?$/
const FILE_NAME_WITH_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp)$/i
const FORBIDDEN_FILE_NAME_CHARS_PATTERN = /[<>:"/\\|?*]/

interface R2HttpMetadataLike {
  contentType?: string | null
}

export interface R2ObjectBodyLike {
  arrayBuffer: () => Promise<ArrayBuffer>
  httpMetadata?: R2HttpMetadataLike
}

export interface R2WriteBucketLike {
  delete: (key: string) => Promise<unknown>
  get: (key: string) => Promise<R2ObjectBodyLike | null>
  put: (
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>
}

export interface SavedSourceImage {
  byteSize: number
  commissionFileName: string
  mimeType: string
  objectKey: string
  sha256: string
  targetKey: string
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), part => part.toString(16).padStart(2, '0'))
    .join('')
}

async function hashArrayBuffer(buffer: ArrayBuffer) {
  return toHex(await crypto.subtle.digest('SHA-256', buffer))
}

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1F) {
      return true
    }
  }

  return false
}

function normalizeCommissionFileName(rawValue: string) {
  return rawValue.trim()
}

async function convertToJpeg(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: sharp } = await import('sharp')
  const { Buffer: NodeBuffer } = await import('node:buffer')
  const result = await sharp(NodeBuffer.from(buffer))
    .jpeg({ quality: 95 })
    .toBuffer()
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
}

export function getSourceImageFileNameValidationError(rawValue: string) {
  const fileName = normalizeCommissionFileName(rawValue)

  if (!fileName) {
    return 'File name is required.'
  }

  if (FILE_NAME_WITH_EXTENSION_PATTERN.test(fileName)) {
    return 'File name must not include an image extension.'
  }

  if (!VALID_FILE_NAME_PATTERN.test(fileName)) {
    return 'File name must start with YYYYMMDD, optionally followed by "_creator".'
  }

  if (
    FORBIDDEN_FILE_NAME_CHARS_PATTERN.test(fileName)
    || fileName.includes('..')
    || hasControlCharacter(fileName)
  ) {
    return 'File name contains forbidden path characters.'
  }

  return null
}

export function buildSourceImageCandidateKeys(rawCommissionFileName: string) {
  const fileName = normalizeCommissionFileName(rawCommissionFileName)
  return [`${fileName}.jpg`, `${fileName}.jpeg`, `${fileName}.png`]
}

export function getSourceImageMimeType(key: string, object?: R2ObjectBodyLike | null) {
  const contentType = object?.httpMetadata?.contentType?.trim()
  if (contentType) {
    return contentType
  }

  if (key.toLowerCase().endsWith('.png')) {
    return 'image/png'
  }

  return 'image/jpeg'
}

export function resolveImageWriteBucket(value: unknown): R2WriteBucketLike | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as {
    delete?: unknown
    get?: unknown
    put?: unknown
  }

  if (
    typeof candidate.get !== 'function'
    || typeof candidate.put !== 'function'
    || typeof candidate.delete !== 'function'
  ) {
    return null
  }

  return value as R2WriteBucketLike
}

export async function saveSourceImageToBucket(
  bucket: R2WriteBucketLike,
  input: {
    commissionFileName: string
    file: File
    overwrite: boolean
    oldCommissionFileName?: string
  },
): Promise<SavedSourceImage> {
  const validationError = getSourceImageFileNameValidationError(input.commissionFileName)
  if (validationError) {
    throw new Error(validationError)
  }

  if (input.file.size <= 0) {
    throw new Error('Uploaded image is empty.')
  }

  const extension = resolveUploadExtension(input.file)
  if (!extension) {
    throw new Error('Only JPG and PNG uploads are supported.')
  }

  const fileName = normalizeCommissionFileName(input.commissionFileName)
  const targetKey = `${fileName}.jpg`
  const candidateKeys = buildSourceImageCandidateKeys(fileName)
  let imageBuffer = await input.file.arrayBuffer()

  if (extension === '.png') {
    imageBuffer = await convertToJpeg(imageBuffer)
  }

  const mimeType = 'image/jpeg'

  if (!input.overwrite) {
    for (const key of candidateKeys) {
      const existing = await bucket.get(key)
      if (existing) {
        throw new Error(`Source image already exists: ${key}`)
      }
    }
  }

  await bucket.put(targetKey, imageBuffer, {
    httpMetadata: {
      contentType: mimeType,
    },
  })

  if (input.overwrite) {
    for (const key of candidateKeys) {
      if (key === targetKey) {
        continue
      }

      await bucket.delete(key)
    }

    if (input.oldCommissionFileName && input.oldCommissionFileName !== input.commissionFileName) {
      const oldCandidateKeys = buildSourceImageCandidateKeys(input.oldCommissionFileName)
      for (const key of oldCandidateKeys) {
        await bucket.delete(key)
      }
    }
  }

  return {
    byteSize: imageBuffer.byteLength,
    commissionFileName: fileName,
    mimeType,
    objectKey: targetKey,
    sha256: await hashArrayBuffer(imageBuffer),
    targetKey,
  }
}

export async function removeSourceImageObject(bucket: R2WriteBucketLike, key: string) {
  await bucket.delete(key)
}
