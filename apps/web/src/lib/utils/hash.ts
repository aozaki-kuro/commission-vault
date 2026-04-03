/**
 * djb2 hash — deterministic, works in both server and browser contexts.
 * Returns a base-36 string suitable for use as a URL version token.
 */
export function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) & 0xFFFFFFFF
  }
  return (hash >>> 0).toString(36)
}
