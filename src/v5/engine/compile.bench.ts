// Compilation time (D-150), out of the CI: `npm run bench`. Version 4 and version 5 side by side on
// the same machine until the switch (C4). Target 16 ms per move, stop and ask beyond 33 ms. The
// scenario differs from version 4: 18 actions against 16, see `realisticRunsPlay` and D-157.
import { test } from 'vitest'
import { createCaches as createCachesV4 } from '../../engine/caches'
import { compileLine as compileLineV4 } from '../../engine/timeline'
import { defaultSettings, engineSettingsOf } from '../../model/settings'
import type { Play as PlayV4 } from '../../model/types'
import { allLines as allLinesV4 } from '../../model/phaseTree'
import { realisticRunsPlay as realisticRunsPlayV4 } from '../../test/builders'
import { allLines } from '../model/branches'
import type { Play } from '../model/types'
import { realisticRunsPlay } from '../test/builders'
import { createCaches } from './caches'
import { compileLine } from './timeline'

const settings = engineSettingsOf(defaultSettings())

const playV5 = realisticRunsPlay()
const linesV5 = allLines(playV5)
const lineV5 = linesV5[0] ?? []
const playV4 = realisticRunsPlayV4()
const linesV4 = allLinesV4(playV4)
const lineV4 = linesV4[0] ?? []

/** The play with a waypoint moved a little more at each call, as a drag does. */
function draggedV5(step: number): Play {
  const actions = playV5.actions.map((action) => {
    if (action.type !== 'run' || action.id !== playV5.actions[0]?.id) return action
    const [first, ...rest] = action.waypoints
    if (!first) return action
    return { ...action, waypoints: [{ ...first, x: first.x + step * 1e-4 }, ...rest] }
  })
  return { ...playV5, actions }
}

function draggedV4(step: number): PlayV4 {
  const phases = playV4.phases.map((phase) => ({
    ...phase,
    actions: phase.actions.map((action) => {
      if (action.type !== 'run' || action.id !== playV4.phases[0]?.actions[0]?.id) return action
      const [first, ...rest] = action.waypoints
      if (!first) return action
      return { ...action, waypoints: [{ ...first, x: first.x + step * 1e-4 }, ...rest] }
    }),
  }))
  return { ...playV4, phases }
}

test('compilation of a line, without cache', async ({ bench }) => {
  await bench.compare(
    bench('v4', () => {
      compileLineV4(playV4, lineV4, settings, createCachesV4())
    }),
    bench('v5', () => {
      compileLine(playV5, lineV5, settings, createCaches())
    }),
  )
})

test('a drag move: a point moved, every line compiled again (D-150)', async ({ bench }) => {
  const cachesV4 = createCachesV4()
  const cachesV5 = createCaches()
  let stepV4 = 0
  let stepV5 = 0
  await bench.compare(
    bench('v4', () => {
      const play = draggedV4(++stepV4)
      for (const line of linesV4) compileLineV4(play, line, settings, cachesV4)
    }),
    bench('v5', () => {
      const play = draggedV5(++stepV5)
      for (const line of linesV5) compileLine(play, line, settings, cachesV5)
    }),
  )
})
