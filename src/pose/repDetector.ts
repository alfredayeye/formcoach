import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Exercise } from '../types'
import { angleBetween } from './angleDetector'
import { betterSide, sideLMs } from './landmarks'

type Phase = 'waiting' | 'in_rep' | 'bottom'

/**
 * Simple rep counter using a primary joint angle state machine.
 * waiting → in_rep (angle > topThreshold)
 * in_rep  → bottom (angle < bottomThreshold)
 * bottom  → waiting + fire rep (angle > topThreshold again)
 */
export class RepDetector {
  private phase: Phase = 'waiting'
  private readonly topThreshold: number
  private readonly bottomThreshold: number

  constructor(exercise: Exercise) {
    switch (exercise) {
      case 'DEADLIFT':
      case 'OVERHEAD_PRESS':
      case 'BENCH_PRESS':
        this.topThreshold = 150
        this.bottomThreshold = 90
        break
      case 'LAT_PULLDOWN':
        this.topThreshold = 150   // arms extended
        this.bottomThreshold = 70 // elbows pulled down
        break
    }
  }

  /** Returns true when a rep is completed. */
  addFrame(lms: NormalizedLandmark[]): boolean {
    const angle = this.getPrimaryAngle(lms)
    if (angle === null) return false

    switch (this.phase) {
      case 'waiting':
        if (angle > this.topThreshold) this.phase = 'in_rep'
        break
      case 'in_rep':
        if (angle < this.bottomThreshold) this.phase = 'bottom'
        break
      case 'bottom':
        if (angle > this.topThreshold) {
          this.phase = 'in_rep'
          return true // rep complete
        }
        break
    }
    return false
  }

  reset() {
    this.phase = 'waiting'
  }

  private getPrimaryAngle(lms: NormalizedLandmark[]): number | null {
    const side = betterSide(lms)
    const idx = sideLMs(side)
    const s = lms[idx.shoulder], h = lms[idx.hip], k = lms[idx.knee]
    const e = lms[idx.elbow], w = lms[idx.wrist]
    if (!s || !h || !k || !e || !w) return null

    // For pulldown use elbow angle, for everything else use hip angle
    if (this.bottomThreshold === 70) return angleBetween(s, e, w)
    return angleBetween(s, h, k)
  }
}
