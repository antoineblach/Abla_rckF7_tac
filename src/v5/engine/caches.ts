// Caches passed as parameters to the pure functions and indexed by content hashes
// (SPEC 3.3.1). A cache never changes a result: it only avoids recomputing it.
import type { Spline } from '../../engine/spline'
import type { PlayResolution } from './glue'
import type { CompiledLine } from './timeline'

export class BoundedCache<V> {
  private readonly entries = new Map<string, V>()

  constructor(private readonly capacity: number) {}

  get(key: string): V | undefined {
    const value = this.entries.get(key)
    if (value !== undefined) {
      // Refresh recency.
      this.entries.delete(key)
      this.entries.set(key, value)
    }
    return value
  }

  set(key: string, value: V): void {
    if (this.entries.has(key)) this.entries.delete(key)
    this.entries.set(key, value)
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }

  get size(): number {
    return this.entries.size
  }
}

export interface EvalCaches {
  readonly splines: BoundedCache<Spline>
  readonly lines: BoundedCache<CompiledLine>
  /** The glues resolved over the whole branch tree of a play, shared by its lines. */
  readonly resolutions: BoundedCache<PlayResolution>
}

export function createCaches(): EvalCaches {
  return {
    splines: new BoundedCache(512),
    lines: new BoundedCache(64),
    resolutions: new BoundedCache(8),
  }
}
