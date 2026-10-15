import { useEffect, useState, type RefObject } from 'react'

/** CSS size of an element, updated by a ResizeObserver. */
export function useElementSize(ref: RefObject<HTMLElement | null>): {
  width: number
  height: number
} {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [ref])
  return size
}
