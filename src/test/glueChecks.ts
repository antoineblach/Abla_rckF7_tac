// Checks shared by the glue tests (D-177): every glue on its target, and a resolution that reads
// no stored start of a start computed by a glue.
import { expect } from 'vitest'
import type { CompiledLine } from '../engine/timeline'
import { canonicalJson } from '../model/canonical'
import type { IssueCode } from '../model/issues'
import { analyseGlues } from '../model/syncGraph'
import type { Id, Play } from '../model/types'

/** Gap between a glued edge and its target, in seconds: rounding only. */
const ON_TARGET = 1e-6

/**
 * HYPOTHÈSE (D-177): right edge of a pass, which slides or stretches, in seconds. Its release or its
 * speed comes from fixed points of 5 iterations on the receiver (SPEC 5.4, D-037): a residue remains.
 */
export const PASS_END_ON_TARGET = 0.01

/** Fallbacks of SPEC 4.3: the block is no longer where its glue puts it, signalled. */
const FALLBACKS: readonly IssueCode[] = [
  'runStartDelayed',
  'startsBeforeBranch',
  'sequenceOverlap',
  'sequenceCrossesBranch',
]

/** Instant of a glued edge on a compiled line, undefined when the block is not there. */
function edgeInstant(
  compiled: CompiledLine,
  ownerId: Id,
  kind: 'start' | 'end' | 'branchAt',
): number | null | undefined {
  if (kind === 'branchAt') return compiled.branches.find((b) => b.id === ownerId)?.branchAt
  const span = compiled.blocks[ownerId]
  return kind === 'start' ? span?.start : span?.end
}

/** (a) Every glue « ok » of the line is on its target, save a block in a fallback of 4.3. */
export function expectGluesOnTarget(compiled: CompiledLine): void {
  const fallen = new Set<Id>()
  for (const issue of compiled.issues) {
    if (FALLBACKS.includes(issue.code) && 'id' in issue.target) fallen.add(issue.target.id)
  }
  const passes = new Set(compiled.passes.map((p) => p.actionId))
  for (const glue of compiled.glues) {
    if (glue.status !== 'ok' || glue.targetT === null || fallen.has(glue.ownerId)) continue
    const instant = edgeInstant(compiled, glue.ownerId, glue.kind)
    const label = `${glue.kind} edge of ${glue.ownerId} on ${glue.targetId}`
    expect(instant, label).toBeTypeOf('number')
    const tolerance =
      glue.kind === 'end' && passes.has(glue.ownerId) ? PASS_END_ON_TARGET : ON_TARGET
    expect(Math.abs((instant ?? NaN) - glue.targetT), label).toBeLessThanOrEqual(tolerance)
  }
}

/**
 * (b) The play with every start that an applied glue computes at `t`: a left edge glued, or a right
 * edge that slides (a sequence that slides keeps its length); a glued branch point at `t`.
 */
export function withComputedStarts(play: Play, t: number): Play {
  const { order, gluedStarts } = analyseGlues(play)
  const computed = new Set<Id>()
  const branchPoints = new Set<Id>()
  for (const edge of order) {
    if (edge.kind === 'branchAt') branchPoints.add(edge.ownerId)
    else if (edge.kind === 'start') computed.add(edge.ownerId)
    else if (edge.keep === 'duration' && !gluedStarts.has(edge.ownerId)) computed.add(edge.ownerId)
  }
  return {
    ...play,
    branches: play.branches.map((b) => (branchPoints.has(b.id) ? { ...b, branchAt: t } : b)),
    actions: play.actions.map((a) =>
      computed.has(a.id) && a.type !== 'groupRun' ? { ...a, start: t } : a,
    ),
    sequences: play.sequences.map((s) => {
      if (!computed.has(s.id)) return s
      const slides = s.endGlue !== undefined && !gluedStarts.has(s.id)
      return { ...s, start: t, end: slides ? s.end + t - s.start : s.end }
    }),
  }
}

/** In a canonical order: the order of these lists follows the order of the edges (D-162). */
const sorted = <T>(items: readonly T[]): T[] =>
  items
    .map((item) => ({ item, key: canonicalJson(item) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ item }) => item)

/**
 * What (b) compares between two compilations of a line. Where the graph leaves the choice, the
 * edges go by stored start (D-162): the alerts and the glues of the line come in that order, which
 * (b) leaves aside; their values do not depend on it.
 */
export function resolvedParts(compiled: CompiledLine) {
  return {
    motions: compiled.motions,
    issues: sorted(compiled.issues),
    passes: compiled.passes,
    kicks: compiled.kicks,
    breakdowns: compiled.breakdowns,
    statuses: sorted(
      compiled.glues.map((g) => ({ ownerId: g.ownerId, kind: g.kind, status: g.status })),
    ),
  }
}
