// Keyboard focus inside a control that uses the keys itself: text fields, lists (type-ahead) and
// the time slider (arrows). A focused checkbox, colour or button leaves the shortcuts working, so
// that R or V still work right after a click in the inspector.
const KEYLESS_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file'])

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return !KEYLESS_INPUTS.has(target.type)
  return target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}
