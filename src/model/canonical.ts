// Canonical serialisation (stable key order) and content hashing.
// Used for files (SPEC 4.4, readable diffs in the Drive history) and for cache keys (SPEC 3.3.1).

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** Deep copy with object keys sorted alphabetically; array order is kept; undefined is dropped. */
export function canonicalize(value: unknown): Json {
  if (value === null) return null
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return value
    case 'number':
      if (!Number.isFinite(value)) throw new Error('Non-finite number cannot be serialised')
      return value
    case 'object': {
      const source = value as Record<string, unknown>
      const result: { [key: string]: Json } = {}
      for (const key of Object.keys(source).sort()) {
        const item = source[key]
        if (item !== undefined) result[key] = canonicalize(item)
      }
      return result
    }
    default:
      throw new Error(`Value of type ${typeof value} cannot be serialised`)
  }
}

/** JSON with sorted keys. `indent` 2 for files, 0 for hashing. */
export function canonicalJson(value: unknown, indent = 0): string {
  return JSON.stringify(canonicalize(value), null, indent)
}

/** cyrb53 string hash (53 bits), as 14 hexadecimal characters. Not cryptographic. */
export function hashString(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return value.toString(16).padStart(14, '0')
}

/** Hash of the canonical form of a value: equal contents give equal hashes. */
export function contentHash(value: unknown): string {
  return hashString(canonicalJson(value))
}
