import type { Vec2 } from '../model/types'

export const vec = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k })
export const length = (a: Vec2): number => Math.hypot(a.x, a.y)
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp = (a: Vec2, b: Vec2, k: number): Vec2 => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
})
export const equals = (a: Vec2, b: Vec2, epsilon = 1e-9): boolean => distance(a, b) <= epsilon
export const copy = (a: Vec2): Vec2 => ({ x: a.x, y: a.y })
