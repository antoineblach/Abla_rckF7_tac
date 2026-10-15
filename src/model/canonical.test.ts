import { describe, expect, it } from 'vitest'
import { canonicalJson, canonicalize, contentHash, hashString } from './canonical'

describe('canonical serialisation', () => {
  it('sorts keys recursively whatever the insertion order', () => {
    const a = { b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } }
    const b = { a: { c: 'x', d: [3, { y: 2, z: 1 }] }, b: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
    expect(canonicalJson(a)).toBe('{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}')
  })

  it('keeps array order and drops undefined values', () => {
    expect(canonicalize({ list: [2, 1], gone: undefined })).toEqual({ list: [2, 1] })
  })

  it('indents with two spaces on demand', () => {
    expect(canonicalJson({ b: 1, a: 2 }, 2)).toBe('{\n  "a": 2,\n  "b": 1\n}')
  })

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow()
  })
})

describe('content hash', () => {
  it('is stable and depends on content only', () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
    expect(hashString('abc')).toMatch(/^[0-9a-f]{14}$/)
    expect(hashString('abc')).toBe(hashString('abc'))
  })
})
