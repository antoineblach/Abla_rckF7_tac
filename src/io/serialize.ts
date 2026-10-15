// File serialisation (SPEC 4.4): JSON indented with 2 spaces, keys in a stable order, final LF.
import { canonicalJson } from '../model/canonical'

export function serialize(value: unknown): string {
  return `${canonicalJson(value, 2)}\n`
}

export type JsonParseResult = { ok: true; value: unknown } | { ok: false; message: string }

export function parseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
