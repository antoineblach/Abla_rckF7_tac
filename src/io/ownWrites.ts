// Versions written by this page (D-098). Per id: the content hashes of the last versions written
// by the page, and the reference, the version held as current (the last one written by the page,
// or a version read from outside since). A stored content that is a version written by the page is
// never an external change; when it is not the reference, the synchronisation went back in time.
import { OWN_WRITES_KEPT } from '../config/defaults'
import type { Id } from '../model/types'

export interface ReferenceVersion {
  /** Content hash of the item read back from `text` (D-097). */
  hash: string
  text: string
  /** File holding the version; null in the browser library. */
  fileName: string | null
}

interface Versions {
  hashes: string[]
  reference: ReferenceVersion | null
}

export class OwnWrites {
  private readonly byId = new Map<Id, Versions>()

  constructor(private readonly kept = OWN_WRITES_KEPT) {}

  private versions(id: Id): Versions {
    let versions = this.byId.get(id)
    if (!versions) {
      versions = { hashes: [], reference: null }
      this.byId.set(id, versions)
    }
    return versions
  }

  /** A version written by the page: remembered, and it becomes the reference. */
  written(id: Id, version: ReferenceVersion): void {
    const versions = this.versions(id)
    versions.hashes = [...versions.hashes.filter((h) => h !== version.hash), version.hash]
    if (versions.hashes.length > this.kept) {
      versions.hashes.splice(0, versions.hashes.length - this.kept)
    }
    versions.reference = version
  }

  /** A version never written by the page, read as current: it becomes the reference (Q1). */
  readFromOutside(id: Id, version: ReferenceVersion): void {
    this.versions(id).reference = version
  }

  isOwn(id: Id, hash: string): boolean {
    return this.byId.get(id)?.hashes.includes(hash) ?? false
  }

  reference(id: Id): ReferenceVersion | null {
    return this.byId.get(id)?.reference ?? null
  }

  /**
   * The reference to write back when `hash`, stored in `fileName`, is an older version written by
   * the page (rollback by the synchronisation); null otherwise.
   */
  rollbackTarget(id: Id, hash: string, fileName: string | null): ReferenceVersion | null {
    const reference = this.reference(id)
    if (!reference || reference.hash === hash || reference.fileName !== fileName) return null
    return this.isOwn(id, hash) ? reference : null
  }
}
