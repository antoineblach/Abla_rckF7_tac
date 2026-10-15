import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { ORIENTATION_ASPECT } from '../../config/defaults'
import { evaluate, phaseSchematic } from '../../engine/evaluate'
import { hitTest, type Hit } from '../../editor/hitTest'
import { engineSettingsOf } from '../../model/settings'
import type { Vec2 } from '../../model/types'
import { renderOverlay } from '../../render/overlay'
import { render } from '../../render/render'
import { drawSchematic } from '../../render/renderSchematic'
import { THEMES } from '../../render/themes'
import {
  createViewport,
  panFrame,
  toMeters,
  visibleBounds,
  zoomFrame,
  type Viewport,
} from '../../render/viewport'
import {
  editorContextMenu,
  editorDoubleClick,
  editorPointerDown,
  editorPointerLeave,
  editorPointerMove,
  editorPointerUp,
  useInteractionStore,
} from '../../state/editorActions'
import { useEditorStore } from '../../state/editorStore'
import { buildOverlay } from '../../state/overlay'
import { usePlayerStore } from '../../state/playerStore'
import { appCaches, useSettingsStore } from '../../state/settingsStore'
import { displayFrame, setEditFrame, setVisibleArea, useViewStore } from '../../state/viewStore'
import { useElementSize } from '../hooks/useElementSize'
import { useFieldFont } from '../hooks/useFieldFont'

const ZOOM_STEP = 1.15

/** The field: schematic of the selected phase in edit mode, scene at t during playback (D-010). */
export function FieldCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useElementSize(containerRef)
  const fontReady = useFieldFont()

  const play = useEditorStore((s) => s.play)
  const selectedPhaseId = useEditorStore((s) => s.selectedPhaseId)
  const selection = useEditorStore((s) => s.selection)
  const tool = useEditorStore((s) => s.tool)
  const runDraft = useEditorStore((s) => s.runDraft)
  const passFromId = useEditorStore((s) => s.passFromId)
  const mode = usePlayerStore((s) => s.mode)
  const transport = usePlayerStore((s) => s.transport)
  const layers = usePlayerStore((s) => s.layers)
  const orientation = usePlayerStore((s) => s.orientation)
  const framing = usePlayerStore((s) => s.framing)
  const settings = useSettingsStore((s) => s.settings)
  const cursor = useInteractionStore((s) => s.cursor)
  const selectionBox = useInteractionStore((s) => s.selectionBox)
  const editFrame = useViewStore((s) => s.editFrame)

  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const aspect = ORIENTATION_ASPECT[orientation]
  let cssWidth = size.width
  let cssHeight = size.height
  if (cssWidth > 0 && cssHeight > 0) {
    if (cssWidth / cssHeight > aspect) cssWidth = Math.floor(cssHeight * aspect)
    else cssHeight = Math.floor(cssWidth / aspect)
  }

  const viewport = useMemo<Viewport | null>(() => {
    if (!play || cssWidth <= 0 || cssHeight <= 0) return null
    const frame = displayFrame(play, { mode, framing, transport }, editFrame)
    return createViewport({
      widthPx: Math.round(cssWidth * dpr),
      heightPx: Math.round(cssHeight * dpr),
      pixelRatio: dpr,
      frame,
      orientation,
      attackingTeam: play.attackingTeam,
    })
    // The line matters for the automatic framing; the time does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, cssWidth, cssHeight, dpr, mode, framing, transport.line, editFrame, orientation])

  // Viewport-dependent helpers for the interactions.
  useEffect(() => {
    if (!viewport) return
    setVisibleArea(visibleBounds(viewport))
    const { ex, ey } = viewport
    useInteractionStore.setState({
      screenToField: (dx, dy) => ({ x: dx * ex.x + dy * ex.y, y: dx * ey.x + dy * ey.y }),
    })
  }, [viewport])

  const schematic = useMemo(() => {
    if (!play || !selectedPhaseId) return null
    return phaseSchematic(play, selectedPhaseId, engineSettingsOf(settings), appCaches)
  }, [play, selectedPhaseId, settings])

  // On-demand drawing (requestAnimationFrame only while playing, see useAnimationLoop).
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !viewport || !play) return
    const theme = THEMES[settings.theme]
    if (mode === 'play') {
      const state = evaluate(
        play,
        transport.line,
        transport.t,
        engineSettingsOf(settings),
        appCaches,
      )
      render(ctx, state, viewport, theme, layers)
    } else if (schematic) {
      drawSchematic(ctx, schematic, viewport, theme)
      renderOverlay(
        ctx,
        viewport,
        theme,
        buildOverlay({ schematic, selection, tool, runDraft, passFromId, cursor, selectionBox }),
      )
    }
  }, [
    viewport,
    play,
    mode,
    transport.line,
    transport.t,
    layers,
    settings,
    schematic,
    selection,
    tool,
    runDraft,
    passFromId,
    cursor,
    selectionBox,
    fontReady,
  ])

  // Interactions -----------------------------------------------------------
  const panRef = useRef<{ last: Vec2 } | null>(null)
  const spaceRef = useRef(false)

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isTyping(e.target)) {
        spaceRef.current = true
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const toFieldPoint = (event: { clientX: number; clientY: number }): Vec2 | null => {
    const canvas = canvasRef.current
    if (!canvas || !viewport) return null
    const rect = canvas.getBoundingClientRect()
    return toMeters(viewport, {
      x: (event.clientX - rect.left) * dpr,
      y: (event.clientY - rect.top) * dpr,
    })
  }

  const hitAt = (pos: Vec2): Hit => {
    if (!schematic || !viewport || mode !== 'edit') return null
    const theme = THEMES[settings.theme]
    const perPx = dpr / viewport.scale
    return hitTest(schematic, pos, {
      token: theme.tokenRadius * perPx,
      handle: (theme.handleRadius + 3) * perPx,
      line: 6 * perPx,
    })
  }

  // Wheel zoom around the cursor (non passive listener to prevent page scrolling).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !viewport) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (usePlayerStore.getState().mode !== 'edit') return
      const rect = canvas.getBoundingClientRect()
      const at = toMeters(viewport, {
        x: (event.clientX - rect.left) * dpr,
        y: (event.clientY - rect.top) * dpr,
      })
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setEditFrame(zoomFrame(visibleBounds(viewport), at, factor))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [viewport, dpr])

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = toFieldPoint(event)
    if (!pos) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      event.preventDefault()
      panRef.current = { last: pos }
      return
    }
    if (event.button !== 0) return
    editorPointerDown({ pos, hit: hitAt(pos), shift: event.shiftKey })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = toFieldPoint(event)
    if (!pos || !viewport) return
    const pan = panRef.current
    if (pan) {
      if (usePlayerStore.getState().mode !== 'edit') return
      const visible = visibleBounds(viewport)
      setEditFrame(panFrame(visible, { x: pan.last.x - pos.x, y: pan.last.y - pos.y }))
      return
    }
    editorPointerMove(pos)
  }

  const onPointerUp = () => {
    if (panRef.current) {
      panRef.current = null
      return
    }
    editorPointerUp()
  }

  const viewportData = viewport
    ? JSON.stringify({
        scale: viewport.scale / dpr,
        originX: viewport.origin.x / dpr,
        originY: viewport.origin.y / dpr,
        ex: viewport.ex,
        ey: viewport.ey,
      })
    : ''

  return (
    <div className="field" ref={containerRef}>
      {play ? (
        <canvas
          ref={canvasRef}
          className={`field__canvas field__canvas--${tool}`}
          data-testid="field-canvas"
          data-viewport={viewportData}
          data-mode={mode}
          width={Math.round(cssWidth * dpr)}
          height={Math.round(cssHeight * dpr)}
          style={{ width: `${cssWidth}px`, height: `${cssHeight}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={editorPointerLeave}
          onDoubleClick={editorDoubleClick}
          onContextMenu={(event) => {
            event.preventDefault()
            const pos = toFieldPoint(event)
            if (pos) editorContextMenu(hitAt(pos))
          }}
          onAuxClick={(event) => {
            event.preventDefault()
          }}
        />
      ) : (
        <p className="field__empty">
          Ouvrez une combinaison dans la bibliothèque ou créez-en une nouvelle.
        </p>
      )}
    </div>
  )
}
