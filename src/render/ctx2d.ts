// Minimal 2D context used by the renderer (SPEC 3.3.2). A displayed canvas, an OffscreenCanvas,
// @napi-rs/canvas in tests and the jsPDF context (lot 2) all satisfy it. Gradients, patterns,
// shadows and filters are deliberately absent (SPEC 3.3.3).
// jsPDF applies transformations when points are added and loses a path built between save() and
// restore(): shapes are built in device units, a transformation only places a whole drawing
// (D-071).
export interface Ctx2D {
  save(): void
  restore(): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void
  /** Clips to the current path (a PDF page, unlike a canvas, does not clip at its edges). */
  clip(): void
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void
  rect(x: number, y: number, w: number, h: number): void
  fill(): void
  stroke(): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  measureText(text: string): { width: number }
  setLineDash(segments: number[]): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  scale(x: number, y: number): void
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  lineCap: 'butt' | 'round' | 'square'
  lineJoin: 'bevel' | 'miter' | 'round'
  font: string
  textAlign: 'center' | 'end' | 'left' | 'right' | 'start'
  textBaseline: 'alphabetic' | 'bottom' | 'hanging' | 'ideographic' | 'middle' | 'top'
}
