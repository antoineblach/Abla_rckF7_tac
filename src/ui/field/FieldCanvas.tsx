import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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
  fitView,
  panView,
  toMeters,
  viewportFromView,
  visibleBounds,
  zoomView,
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
import {
  savedFrame,
  setCanvasSize,
  setView,
  setVisibleArea,
  useViewStore,
} from '../../state/viewStore'
import { useElementSize } from '../hooks/useElementSize'
import { isTypingTarget } from '../hooks/typing'
import { useFieldFont } from '../hooks/useFieldFont'

const ZOOM_STEP = 1.15

/** The field: schematic of the selected phase in edit mode, scene at t during playback (D-010).
 * The displayed area is the view of viewStore: the canvas size never changes it (D-048). */
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
  const settings = useSettingsStore((s) => s.settings)
  const cursor = useInteractionStore((s) => s.cursor)
  const selectionBox = useInteractionStore((s) => s.selectionBox)
  const storedView = useViewStore((s) => s.view)

  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const aspect = ORIENTATION_ASPECT[orientation]
  let cssWidth = size.width
  let cssHeight = size.height
  if (cssWidth > 0 && cssHeight > 0) {
    if (cssWidth / cssHeight > aspect) cssWidth = Math.floor(cssHeight * aspect)
    else cssHeight = Math.floor(cssWidth / aspect)
  }

  // Fit of the saved view, used until a view is stored (opening, orientation, D-048).
  const fitted = useMemo(() => {
    if (!play || cssWidth <= 0 || cssHeight <= 0) return null
    return fitView(savedFrame(play), cssWidth, cssHeight, orientation, play.attackingTeam)
  }, [play, cssWidth, cssHeight, orientation])
  const view = storedView ?? fitted

  useLayoutEffect(() => {
    if (cssWidth > 0 && cssHeight > 0) setCanvasSize({ width: cssWidth, height: cssHeight })
  }, [cssWidth, cssHeight])
  useLayoutEffect(() => {
    if (!storedView && fitted) setView(fitted)
  }, [storedView, fitted])

  const attackingTeam = play?.attackingTeam
  const viewport = useMemo<Viewport | null>(() => {
    if (!view || !attackingTeam || cssWidth <= 0 || cssHeight <= 0) return null
    return viewportFromView({
      widthPx: Math.round(cssWidth * dpr),
      heightPx: Math.round(cssHeight * dpr),
      pixelRatio: dpr,
      view,
      orientation,
      attackingTeam,
    })
  }, [view, attackingTeam, cssWidth, cssHeight, dpr, orientation])

  // Viewport-dependent helpers for the interactions.
  useEffect(() => {
    if (!viewport) return
    setVisibleArea(visibleBounds(viewport))
    const { ex, ey } = viewport
    useInteractionStore.setState({
      screenToField: (dx, dy) => ({ x: dx * ex.x + dy * ex.y, y: dx * ey.x + dy * ey.y }),
      metersPerPx: viewport.pixelRatio / viewport.scale,
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
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isTypingTarget(e.target)) {
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

  // Wheel zoom around the cursor, in edit mode and during playback (non passive listener to
  // prevent page scrolling, D-049).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !viewport || !view) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const at = toMeters(viewport, {
        x: (event.clientX - rect.left) * dpr,
        y: (event.clientY - rect.top) * dpr,
      })
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setView(zoomView(view, at, factor))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [viewport, view, dpr])

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
      // The grabbed point stays under the pointer.
      if (view) setView(panView(view, { x: pan.last.x - pos.x, y: pan.last.y - pos.y }))
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
