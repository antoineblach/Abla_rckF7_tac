// Speed in m/s of a named pace or a typed speed (D-114, D-133). Pure.
import type { Pace, SpeedValue } from './types'

export function speedOf(value: SpeedValue, paces: Readonly<Record<Pace, number>>): number {
  return typeof value === 'number' ? value : paces[value]
}
