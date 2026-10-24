// Synchronisation links in the editor (SPEC 5.8, D-108, D-109): creation with refusals (the run
// itself, loops, targets that cannot apply), settings, removal that leaves the computed delay,
// waypoint deletion (links removed, indices shifted), copy by « Dupliquer », choice of the target.
import { describe, expect, it } from 'vitest'
import { createCaches } from '../engine/caches'
import { compiledPhaseOf, phaseSchematic, type PhaseSchematic } from '../engine/evaluate'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import type { Id, Play, RunAction, RunSync } from '../model/types'
import { validatePlay } from '../model/validate'
import {
  P,
  ball,
  basePlay,
  pass,
  phase,
  player,
  run,
  sequentialIds,
  sevenVsSevenWithOptions,
  uuid,
} from '../test/builders'
import {
  deleteWaypoint,
  duplicatePhase,
  removeRunSync,
  setRunSync,
  updateRunSync,
  type CommandContext,
} from './commands'
import { pickRendezVous, syncPickClick } from './syncPick'

const settings = engineSettingsOf(defaultSettings())
const ctx = (): CommandContext => ({ ids: sequentialIds(700), settings, caches: createCaches() })

function runOf(play: Play, id: Id): RunAction {
  const action = play.phases.flatMap((p) => p.actions).find((a) => a.id === id)
  if (action?.type !== 'run') throw new Error(`no run ${id}`)
  return action
}

const RUN_A4 = uuid(200)
const RUN_A5 = uuid(201)
const PASS_A4_A5 = uuid(202)

const toEnd = (actionId: Id): RunSync => ({
  target: { actionId, event: 'runEnd' },
  adjust: 'delay',
})

describe('creating a link (D-109)', () => {
  it('links a run to an action of its phase', () => {
    const result = setRunSync(sevenVsSevenWithOptions(), RUN_A5, toEnd(RUN_A4))
    expect(result.refused).toBeNull()
    expect(runOf(result.play, RUN_A5).sync).toEqual(toEnd(RUN_A4))
  })

  it('refuses the run itself, a missing or incompatible target, a point out of range', () => {
    const play = sevenVsSevenWithOptions()
    expect(setRunSync(play, RUN_A5, toEnd(RUN_A5)).refused).toBe('self')
    expect(setRunSync(play, RUN_A5, toEnd(uuid(999))).refused).toBe('invalid')
    // A target in another phase is « missing » from the phase of the run.
    expect(setRunSync(play, RUN_A5, toEnd(uuid(210))).refused).toBe('invalid')
    expect(setRunSync(play, RUN_A5, toEnd(PASS_A4_A5)).refused).toBe('invalid')
    const point: RunSync = {
      target: { actionId: RUN_A4, event: 'runPoint', index: 2 },
      adjust: 'delay',
    }
    expect(setRunSync(play, RUN_A5, point).refused).toBe('invalid')
    expect(setRunSync(play, RUN_A5, { ...toEnd(RUN_A4), at: 2 }).refused).toBe('invalid')
    expect(setRunSync(play, uuid(999), toEnd(RUN_A4)).refused).toBe('invalid')
  })

  it('refuses a loop of links, but accepts a receiver meeting the arrival of her own pass', () => {
    const first = setRunSync(sevenVsSevenWithOptions(), RUN_A5, toEnd(RUN_A4))
    const loop = setRunSync(first.play, RUN_A4, toEnd(RUN_A5))
    expect(loop.refused).toBe('cycle')
    expect(loop.play).toBe(first.play)
    // A5 receives the pass of A4: her run may meet its arrival (D-108).
    const own = setRunSync(sevenVsSevenWithOptions(), RUN_A5, {
      target: { actionId: PASS_A4_A5, event: 'arrival' },
      adjust: 'delay',
    })
    expect(own.refused).toBeNull()
  })

  it('refuses a loop through a release on receipt', () => {
    const base = sevenVsSevenWithOptions()
    // A5 passes to A6 on receipt: her release depends on the arrival of the pass of A4, which
    // depends on her run. Linking her run to that release closes a loop.
    const withRelay: Play = {
      ...base,
      phases: base.phases.map((p) =>
        p.id === P.t1
          ? {
              ...p,
              actions: [...p.actions, pass(uuid(203), P.A(5), P.A(6), 0, { release: 'onReceipt' })],
            }
          : p,
      ),
    }
    const linked = setRunSync(withRelay, RUN_A5, {
      target: { actionId: uuid(203), event: 'release' },
      adjust: 'delay',
    })
    expect(linked.refused).toBe('cycle')
  })
})

describe('settings and removal of a link (D-108)', () => {
  it('changes the rendez-vous point and the setting', () => {
    const play = setRunSync(sevenVsSevenWithOptions(), RUN_A5, toEnd(RUN_A4)).play
    expect(runOf(updateRunSync(play, RUN_A5, { at: 0 }), RUN_A5).sync?.at).toBe(0)
    const back = updateRunSync(updateRunSync(play, RUN_A5, { at: 0 }), RUN_A5, { at: null })
    expect(runOf(back, RUN_A5).sync).toEqual(toEnd(RUN_A4))
    expect(runOf(updateRunSync(play, RUN_A5, { at: 5 }), RUN_A5).sync?.at).toBeUndefined()
    expect(runOf(updateRunSync(play, RUN_A5, { adjust: 'speed' }), RUN_A5).sync?.adjust).toBe(
      'speed',
    )
  })

  /** A1 runs 30 m; A2 runs 5 m, her end synchronised on the end of A1 (positive delay). */
  function delayedPlay(): Play {
    return basePlay({
      entities: [player(uuid(1), 'A', 1), player(uuid(2), 'A', 2), ball(uuid(20))],
      setup: {
        positions: { [uuid(1)]: { x: 20, y: 20 }, [uuid(2)]: { x: 20, y: 30 } },
        ballCarrierId: uuid(1),
        ballPosition: null,
      },
      phases: [
        phase(uuid(100), null, [
          run(uuid(300), uuid(1), [{ x: 50, y: 20 }]),
          run(uuid(301), uuid(2), [{ x: 25, y: 30 }], { delay: 0.3, sync: toEnd(uuid(300)) }),
        ]),
      ],
    })
  }

  it('« Retirer le lien » leaves the computed delay of a « Départ différé »', () => {
    const play = delayedPlay()
    const c = ctx()
    const before = compiledPhaseOf(play, uuid(100), c.settings, c.caches)
    const linked = before?.motions.find((m) => m.actionId === uuid(301))
    const computed = linked?.sync?.delay ?? NaN
    expect(computed).toBeGreaterThan(1)
    const removed = removeRunSync(play, uuid(301), c)
    const run301 = runOf(removed, uuid(301))
    expect(run301.sync).toBeUndefined()
    expect(run301.delay).toBeCloseTo(computed, 9)
    // The run starts at the same instant as with the link.
    const after = compiledPhaseOf(removed, uuid(100), c.settings, c.caches)
    expect(after?.motions.find((m) => m.actionId === uuid(301))?.start).toBeCloseTo(
      linked?.start ?? NaN,
      9,
    )
  })

  it('« Retirer le lien » keeps the stored delay of an adjusted speed', () => {
    const play = updateRunSync(delayedPlay(), uuid(301), { adjust: 'speed' })
    const removed = removeRunSync(play, uuid(301), ctx())
    expect(runOf(removed, uuid(301)).delay).toBe(0.3)
    expect(runOf(removed, uuid(301)).sync).toBeUndefined()
    expect(removeRunSync(removed, uuid(301), ctx())).toBe(removed)
  })
})

describe('deleting a point that carries a link (D-108)', () => {
  /** R1 meets the end of R2 at its point 1; R3 meets point 2 of R1, R4 its point 0, R5 the end of R2. */
  function linksPlay(): Play {
    const ids = [1, 2, 3, 4, 5].map((n) => uuid(n))
    const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 20, y: 10 + 5 * i }]))
    return basePlay({
      entities: ids.map((id, i) => player(id, 'A', i + 1)),
      setup: { positions, ballCarrierId: null, ballPosition: null },
      phases: [
        phase(uuid(100), null, [
          run(
            uuid(401),
            uuid(1),
            [
              { x: 25, y: 10 },
              { x: 30, y: 12 },
              { x: 35, y: 10 },
            ],
            { sync: { ...toEnd(uuid(402)), at: 1 } },
          ),
          run(uuid(402), uuid(2), [{ x: 30, y: 15 }]),
          run(uuid(403), uuid(3), [{ x: 30, y: 20 }], {
            sync: { target: { actionId: uuid(401), event: 'runPoint', index: 2 }, adjust: 'delay' },
          }),
          run(uuid(404), uuid(4), [{ x: 30, y: 25 }], {
            sync: { target: { actionId: uuid(401), event: 'runPoint', index: 0 }, adjust: 'delay' },
          }),
          run(uuid(405), uuid(5), [{ x: 30, y: 30 }], { sync: toEnd(uuid(402)) }),
        ]),
      ],
    })
  }

  it('removes the link of the deleted point and shifts the indices after it', () => {
    const first = deleteWaypoint(linksPlay(), uuid(401), 0)
    expect(first.removedLinks).toBe(1)
    expect(runOf(first.play, uuid(401)).sync?.at).toBe(0)
    expect(runOf(first.play, uuid(403)).sync?.target).toEqual({
      actionId: uuid(401),
      event: 'runPoint',
      index: 1,
    })
    expect(runOf(first.play, uuid(404)).sync).toBeUndefined()
    expect(validatePlay(first.play).filter((i) => i.severity === 'error')).toEqual([])
  })

  it('removes the rendez-vous of the deleted point', () => {
    const result = deleteWaypoint(linksPlay(), uuid(401), 1)
    expect(result.removedLinks).toBe(1)
    expect(runOf(result.play, uuid(401)).sync).toBeUndefined()
    expect(runOf(result.play, uuid(403)).sync?.target).toMatchObject({ index: 1 })
    expect(runOf(result.play, uuid(404)).sync?.target).toMatchObject({ index: 0 })
  })

  it('keeps a link aimed at the end of a run deleted with its last point (« cible supprimée »)', () => {
    const result = deleteWaypoint(linksPlay(), uuid(402), 0)
    expect(result.removedLinks).toBe(0)
    expect(result.play.phases[0]?.actions.some((a) => a.id === uuid(402))).toBe(false)
    expect(runOf(result.play, uuid(405)).sync).toEqual(toEnd(uuid(402)))
    expect(deleteWaypoint(linksPlay(), uuid(402), 3).play).toEqual(linksPlay())
  })
})

describe('« Dupliquer » copies the links (D-108)', () => {
  it('aims the links of the copies at the copies', () => {
    const play = setRunSync(sevenVsSevenWithOptions(), uuid(210), {
      target: { actionId: uuid(211), event: 'release' },
      adjust: 'delay',
    }).play
    const duplicated = duplicatePhase(play, P.t2, ctx())
    const copy = duplicated.play.phases.find((p) => p.id === duplicated.phaseId)
    const copiedRun = copy?.actions.find((a) => a.type === 'run')
    const copiedPass = copy?.actions.find((a) => a.type === 'pass')
    if (copiedRun?.type !== 'run' || !copiedPass) throw new Error('no copies')
    expect(copiedRun.sync?.target).toEqual({ actionId: copiedPass.id, event: 'release' })
    expect(runOf(duplicated.play, uuid(210)).sync?.target.actionId).toBe(uuid(211))
  })
})

describe('choosing the target (D-109)', () => {
  const play = sevenVsSevenWithOptions()
  const schematic = phaseSchematic(play, P.t1, settings, createCaches()) as PhaseSchematic
  const pick = { runId: RUN_A5 }
  const at = { x: 0, y: 0 }

  it('reads a point, the end or the line of another run', () => {
    expect(
      syncPickClick(pick, schematic, { kind: 'waypoint', actionId: RUN_A4, index: 0 }, at),
    ).toEqual({
      kind: 'target',
      target: { actionId: RUN_A4, event: 'runPoint', index: 0 },
    })
    expect(
      syncPickClick(pick, schematic, { kind: 'waypoint', actionId: RUN_A4, index: 1 }, at),
    ).toEqual({
      kind: 'target',
      target: { actionId: RUN_A4, event: 'runEnd' },
    })
    expect(
      syncPickClick(pick, schematic, { kind: 'run', actionId: RUN_A4, segment: 0 }, at),
    ).toEqual({
      kind: 'target',
      target: { actionId: RUN_A4, event: 'runEnd' },
    })
  })

  it('refuses the run itself, ignores players and empty clicks', () => {
    expect(
      syncPickClick(pick, schematic, { kind: 'run', actionId: RUN_A5, segment: 1 }, at),
    ).toEqual({
      kind: 'self',
    })
    expect(
      syncPickClick(pick, schematic, { kind: 'waypoint', actionId: RUN_A5, index: 0 }, at),
    ).toEqual({
      kind: 'self',
    })
    expect(syncPickClick(pick, schematic, { kind: 'player', id: P.A(1) }, at)).toEqual({
      kind: 'none',
    })
    expect(syncPickClick(pick, schematic, null, at)).toEqual({ kind: 'none' })
  })

  it('takes the nearest end of a pass, the formation of a breakdown, the arrival of a kick', () => {
    const line = schematic.passes.find((p) => p.actionId === PASS_A4_A5)
    if (!line) throw new Error('no pass')
    const hit = { kind: 'pass' as const, actionId: PASS_A4_A5 }
    expect(syncPickClick(pick, schematic, hit, line.from)).toEqual({
      kind: 'target',
      target: { actionId: PASS_A4_A5, event: 'release' },
    })
    expect(syncPickClick(pick, schematic, hit, line.to)).toEqual({
      kind: 'target',
      target: { actionId: PASS_A4_A5, event: 'arrival' },
    })
    expect(syncPickClick(pick, schematic, { kind: 'breakdown', actionId: uuid(9) }, at)).toEqual({
      kind: 'target',
      target: { actionId: uuid(9), event: 'formation' },
    })
    expect(syncPickClick(pick, schematic, { kind: 'kickTarget', actionId: uuid(8) }, at)).toEqual({
      kind: 'target',
      target: { actionId: uuid(8), event: 'arrival' },
    })
  })

  it('meets at the selected point of the run, at its end otherwise', () => {
    expect(pickRendezVous(RUN_A5, 2, { actionId: RUN_A5, index: 0 })).toEqual({
      runId: RUN_A5,
      at: 0,
    })
    expect(pickRendezVous(RUN_A5, 2, { actionId: RUN_A5, index: 1 })).toEqual({ runId: RUN_A5 })
    expect(pickRendezVous(RUN_A5, 2, { actionId: RUN_A4, index: 0 })).toEqual({ runId: RUN_A5 })
    expect(pickRendezVous(RUN_A5, 2, null)).toEqual({ runId: RUN_A5 })
  })
})
