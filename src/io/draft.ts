// Unsaved draft kept in IndexedDB (SPEC 3.5, DECISIONS Q25 / D-025): written at each change,
// cleared after a successful save, offered at start-up when it differs from the stored play. A draft
// of an earlier version is neither restored nor erased: its one key is rewritten at the next change
// (D-151).
import { canonicalJson } from '../model/canonical'
import type { Play } from '../model/types'
import { kvKey, type KeyValueStore } from './kv'
import { readPlayText } from './readPlay'
import { serialize } from './serialize'

const DRAFT_KEY = kvKey('draft')

export async function saveDraft(kv: KeyValueStore, play: Play): Promise<void> {
  await kv.set(DRAFT_KEY, serialize(play))
}

export async function clearDraft(kv: KeyValueStore): Promise<void> {
  await kv.del(DRAFT_KEY)
}

/** The draft; 'obsolete' for a draft of an earlier version; null when absent or unreadable. */
export async function loadDraft(kv: KeyValueStore): Promise<Play | 'obsolete' | null> {
  const value = await kv.get(DRAFT_KEY)
  if (typeof value !== 'string') return null
  const result = readPlayText(value)
  if (result.ok) return result.play
  return result.error.code === 'obsoleteVersion' ? 'obsolete' : null
}

/** A draft is worth offering when its content differs from the stored play (or none exists). */
export function draftDiffers(draft: Play, stored: Play | null): boolean {
  if (!stored) return true
  return canonicalJson({ ...draft, updatedAt: '' }) !== canonicalJson({ ...stored, updatedAt: '' })
}
