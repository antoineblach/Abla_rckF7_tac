import { useEffect } from 'react'
import { tickPlayer, usePlayerStore } from '../../state/playerStore'

/** requestAnimationFrame only while playing (SPEC 7); drawing is on demand otherwise. */
export function useAnimationLoop(): void {
  const playing = usePlayerStore((s) => s.transport.playing)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last: number | null = null
    const step = (now: number) => {
      if (last !== null) tickPlayer(Math.min(0.1, (now - last) / 1000))
      last = now
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [playing])
}
