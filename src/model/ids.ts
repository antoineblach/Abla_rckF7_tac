import type { Id } from './types'

/** Injectable identifier factory: random UUIDs in the application, sequential ones in tests. */
export type IdFactory = () => Id

export const randomIds: IdFactory = () => crypto.randomUUID()
