const BACKSLASH_PATTERN = /\\/g
const DOUBLE_QUOTE_PATTERN = /"/g

export function escapeAttributeSelectorValue(value: string) {
  return value.replace(BACKSLASH_PATTERN, '\\\\').replace(DOUBLE_QUOTE_PATTERN, '\\"')
}

export const getExactIdSelector = (id: string) => `[id="${escapeAttributeSelectorValue(id)}"]`

export function normalizeBatchTargetId(rawValue: string | null | undefined) {
  if (!rawValue)
    return ''

  const value = rawValue.startsWith('#') ? rawValue.slice(1) : rawValue
  if (!value)
    return ''

  try {
    return decodeURIComponent(value)
  }
  catch {
    return ''
  }
}
