import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/** Angle in degrees at joint B, formed by A-B-C (2D, x/y only). */
export function angleBetween(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const abx = a.x - b.x, aby = a.y - b.y
  const cbx = c.x - b.x, cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const mag = Math.sqrt(abx ** 2 + aby ** 2) * Math.sqrt(cbx ** 2 + cby ** 2)
  if (mag === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

/**
 * Angle of the vector (from → to) from vertical (downward = 0°).
 * Useful for checking spine/torso lean.
 */
export function angleFromVertical(
  from: NormalizedLandmark,
  to: NormalizedLandmark,
): number {
  const dx = to.x - from.x
  const dy = to.y - from.y // positive = downward in image coords
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI
}
