import { useEffect, useState } from 'react'

/** True once the embedded font is loaded, so that the canvas draws numbers with it. */
export function useFieldFont(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      document.fonts.load('bold 14px "Atkinson Hyperlegible"'),
      document.fonts.load('14px "Atkinson Hyperlegible"'),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return ready
}
