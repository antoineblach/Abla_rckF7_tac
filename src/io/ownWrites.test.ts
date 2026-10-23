// Versions written by the page and reference of each id (D-098).
import { describe, expect, it } from 'vitest'
import { uuid } from '../test/builders'
import { OwnWrites } from './ownWrites'

const id = uuid(1)
const version = (hash: string, fileName: string | null = 'a.combi.json') => ({
  hash,
  text: `text ${hash}`,
  fileName,
})

describe('versions written by the page (D-098)', () => {
  it('remembers the last versions written, at most `kept`', () => {
    const own = new OwnWrites(3)
    for (const hash of ['h1', 'h2', 'h3', 'h4']) own.written(id, version(hash))
    expect(['h1', 'h2', 'h3', 'h4'].map((h) => own.isOwn(id, h))).toEqual([false, true, true, true])
    expect(own.isOwn(uuid(2), 'h4')).toBe(false)
    expect(own.reference(id)).toEqual(version('h4'))
  })

  it('writing the same version again keeps it among the last ones', () => {
    const own = new OwnWrites(2)
    own.written(id, version('h1'))
    own.written(id, version('h2'))
    own.written(id, version('h1'))
    own.written(id, version('h3'))
    expect(own.isOwn(id, 'h1')).toBe(true)
    expect(own.isOwn(id, 'h2')).toBe(false)
  })

  it('an older version of the page, in the file of the reference, is a rollback', () => {
    const own = new OwnWrites()
    own.written(id, version('h1'))
    own.written(id, version('h2'))
    expect(own.rollbackTarget(id, 'h1', 'a.combi.json')).toEqual(version('h2'))
    // The reference itself, another file, or a content never written by the page: no rollback.
    expect(own.rollbackTarget(id, 'h2', 'a.combi.json')).toBeNull()
    expect(own.rollbackTarget(id, 'h1', 'a (1).combi.json')).toBeNull()
    expect(own.rollbackTarget(id, 'x', 'a.combi.json')).toBeNull()
    expect(own.rollbackTarget(uuid(2), 'h1', 'a.combi.json')).toBeNull()
  })

  it('a version read from outside becomes the reference, without being a version of the page (Q1)', () => {
    const own = new OwnWrites()
    own.written(id, version('h1'))
    own.written(id, version('h2'))
    own.readFromOutside(id, version('x'))
    expect(own.isOwn(id, 'x')).toBe(false)
    expect(own.rollbackTarget(id, 'h2', 'a.combi.json')).toEqual(version('x'))
  })
})
