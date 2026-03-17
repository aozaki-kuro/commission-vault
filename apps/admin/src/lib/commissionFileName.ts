const VALID_FILE_NAME = /^\d{8}(?:_.+)?$/
const FILE_NAME_WITH_EXTENSION = /\.(?:jpe?g|png|webp)$/i
const FORBIDDEN_FILE_NAME_CHARS = /[<>:"/\\|?*]/

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1F) {
      return true
    }
  }

  return false
}

export function isValidCommissionFileName(rawValue: string) {
  const fileName = rawValue.trim()

  if (!fileName) {
    return false
  }

  if (FILE_NAME_WITH_EXTENSION.test(fileName)) {
    return false
  }

  if (!VALID_FILE_NAME.test(fileName)) {
    return false
  }

  if (FORBIDDEN_FILE_NAME_CHARS.test(fileName) || fileName.includes('..') || hasControlCharacter(fileName)) {
    return false
  }

  return true
}
