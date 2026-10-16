// Layers that can be switched on and off separately (SPEC 7).
export interface Layers {
  /** Traces: current phase emphasised, previous phases faded. */
  traces: boolean
  /** Instruction in a banner. */
  instruction: boolean
  /** Gain line in thin dashes. */
  gainLine: boolean
  /** Badge on the forward passes (SPEC 5.7, D-085); never in the exports (D-086). */
  forwardPass: boolean
  /** Lot 4: defence indicators (declared only). */
  defenseIndicators?: boolean
  /** Lot 4: offside line (declared only). */
  offsideLine?: boolean
}

export const DEFAULT_LAYERS: Layers = {
  traces: true,
  instruction: true,
  gainLine: true,
  forwardPass: true,
}
