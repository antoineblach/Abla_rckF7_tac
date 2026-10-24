// Number formatting of the interface, in French (D-117). The code and the files stay in metres,
// seconds and m/s; speeds are shown in m/s and km/h, segment speeds and thresholds typed in km/h.

/** km/h in one m/s. */
export const KMH_PER_MPS = 3.6

export function mpsToKmh(mps: number): number {
  return mps * KMH_PER_MPS
}

export function kmhToMps(kmh: number): number {
  return kmh / KMH_PER_MPS
}

/** French decimal: « 5,5 ». */
export function decimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',')
}

/** « 19,8 km/h ». */
export function formatKmh(mps: number): string {
  return `${decimal(mpsToKmh(mps))} km/h`
}

/** « 5,5 m/s ». */
export function formatMps(mps: number): string {
  return `${decimal(mps)} m/s`
}

/** « 5,5 m/s (19,8 km/h) ». */
export function formatSpeed(mps: number): string {
  return `${formatMps(mps)} (${formatKmh(mps)})`
}

/** « 1,2 s ». */
export function formatSeconds(seconds: number): string {
  return `${decimal(seconds)} s`
}

/** « 24,3 m ». */
export function formatMeters(metres: number): string {
  return `${decimal(metres)} m`
}
