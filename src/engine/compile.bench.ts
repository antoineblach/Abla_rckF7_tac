// Compilation time (D-150), out of the CI: `npm run bench`. Target 16 ms per move, stop and ask beyond
// 33 ms. Scenario: `realisticRunsPlay` (D-157).
import { test } from 'vitest'
import { defaultSettings, engineSettingsOf } from '../model/settings'
import { allLines } from '../model/branches'
import type { Play } from '../model/types'
import { realisticRunsPlay } from '../test/builders'
import { createCaches } from './caches'
import { compileLine } from './timeline'

const settings = engineSettingsOf(defaultSettings())

const play = realisticRunsPlay()
const lines = allLines(play)
const firstLine = lines[0] ?? []

/** The play with a waypoint moved a little more at each call, as a drag does. */
function dragged(step: number): Play {
  const actions = play.actions.map((action) => {
    if (action.type !== 'run' || action.id !== play.actions[0]?.id) return action
    const [first, ...rest] = action.waypoints
    if (!first) return action
    return { ...action, waypoints: [{ ...first, x: first.x + step * 1e-4 }, ...rest] }
  })
  return { ...play, actions }
}

test('compilation of a line, without cache', async ({ bench }) => {
  await bench('compile', () => {
    compileLine(play, firstLine, settings, createCaches())
  }).run()
})

test('a drag move: a point moved, every line compiled again (D-150)', async ({ bench }) => {
  const caches = createCaches()
  let step = 0
  await bench('drag', () => {
    const moved = dragged(++step)
    for (const line of lines) compileLine(moved, line, settings, caches)
  }).run()
})
