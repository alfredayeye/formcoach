import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Exercise, FormAnalysis, JointColor } from '../types'
import { angleBetween, angleFromVertical } from './angleDetector'
import { LM, betterSide, sideLMs } from './landmarks'

export function analyzeForm(
  exercise: Exercise,
  lms: NormalizedLandmark[],
): FormAnalysis {
  const colors = new Map<number, JointColor>()
  const side = betterSide(lms)
  const idx = sideLMs(side)

  const s = lms[idx.shoulder]
  const e = lms[idx.elbow]
  const w = lms[idx.wrist]
  const h = lms[idx.hip]
  const k = lms[idx.knee]
  const a = lms[idx.ankle]

  if (!s || !e || !w || !h || !k || !a) return { jointColors: colors, cue: '' }

  switch (exercise) {
    case 'DEADLIFT':
      return analyzeDeadlift(lms, colors, idx, s, e, w, h, k, a)
    case 'OVERHEAD_PRESS':
      return analyzeOHP(lms, colors, idx, s, e, w, h, k, a)
    case 'BENCH_PRESS':
      return analyzeBench(lms, colors, idx, s, e, w, h, k, a)
    case 'LAT_PULLDOWN':
      return analyzeLatPulldown(lms, colors, idx, s, e, w, h, k, a)
  }
}

// ─── DEADLIFT ───────────────────────────────────────────────────────────────

function analyzeDeadlift(
  lms: NormalizedLandmark[],
  colors: Map<number, JointColor>,
  idx: ReturnType<typeof sideLMs>,
  s: NormalizedLandmark, _e: NormalizedLandmark, _w: NormalizedLandmark,
  h: NormalizedLandmark, k: NormalizedLandmark, a: NormalizedLandmark,
): FormAnalysis {
  const hipAngle = angleBetween(s, h, k)
  const spineAngle = angleFromVertical(h, s) // torso tilt from vertical

  let cue = ''

  // Spine / upper back check: if torso lean is extreme and we're not at the bottom
  if (hipAngle > 120 && spineAngle > 55) {
    colors.set(idx.shoulder, 'yellow')
    colors.set(idx.hip, 'yellow')
    cue = 'Hinge more — push hips back'
  }

  // Knee cave / tracking: knee should stay over ankle in side view
  // In a side view, knee.x and ankle.x should be close (within ~0.05)
  const kneeDrift = Math.abs(k.x - a.x)
  if (kneeDrift > 0.08) {
    colors.set(idx.knee, 'red')
    colors.set(idx.ankle, 'yellow')
    if (!cue) cue = 'Knees track over toes'
  } else if (kneeDrift > 0.04) {
    colors.set(idx.knee, 'yellow')
    if (!cue) cue = 'Watch knee position'
  }

  // Head neutral: check nose vs shoulder vertical alignment
  const nose = lms[LM.NOSE]
  if (nose && nose.y < s.y - 0.05) {
    // head cranked back
    colors.set(LM.NOSE, 'yellow')
    if (!cue) cue = 'Neutral head — eyes forward'
  }

  // All looks good
  if (!cue) {
    colors.set(idx.hip, 'green')
    colors.set(idx.knee, 'green')
    cue = hipAngle < 100 ? 'Good depth' : 'Drive through the floor'
  }

  return { jointColors: colors, cue }
}

// ─── OVERHEAD PRESS ─────────────────────────────────────────────────────────

function analyzeOHP(
  _lms: NormalizedLandmark[],
  colors: Map<number, JointColor>,
  idx: ReturnType<typeof sideLMs>,
  s: NormalizedLandmark, e: NormalizedLandmark, w: NormalizedLandmark,
  h: NormalizedLandmark, _k: NormalizedLandmark, a: NormalizedLandmark,
): FormAnalysis {
  const elbowAngle = angleBetween(s, e, w)

  // Wrist stacked over elbow: in side view, x should be close
  const wristElbowOffset = Math.abs(w.x - e.x)

  let cue = ''

  // Elbow flare at start: elbow should be just in front of bar
  if (elbowAngle < 60) {
    colors.set(idx.elbow, 'red')
    cue = 'Elbows slightly forward of bar'
  } else if (elbowAngle < 80) {
    colors.set(idx.elbow, 'yellow')
    if (!cue) cue = 'Open elbows slightly'
  }

  // Wrist alignment
  if (wristElbowOffset > 0.07) {
    colors.set(idx.wrist, 'red')
    if (!cue) cue = 'Stack wrists over elbows'
  } else if (wristElbowOffset > 0.04) {
    colors.set(idx.wrist, 'yellow')
    if (!cue) cue = 'Straighten wrists'
  }

  // Hip thrust / anterior tilt: hip shouldn't push forward
  // If hip.x is significantly in front of ankle.x the person is arching
  const hipThrust = Math.abs(h.x - a.x)
  if (hipThrust > 0.1) {
    colors.set(idx.hip, 'yellow')
    if (!cue) cue = 'Brace core — no hip thrust'
  }

  if (!cue) {
    colors.set(idx.shoulder, 'green')
    colors.set(idx.elbow, 'green')
    colors.set(idx.wrist, 'green')
    cue = elbowAngle > 150 ? 'Lock it out' : 'Press tall'
  }

  return { jointColors: colors, cue }
}

// ─── BENCH PRESS ────────────────────────────────────────────────────────────

function analyzeBench(
  _lms: NormalizedLandmark[],
  colors: Map<number, JointColor>,
  idx: ReturnType<typeof sideLMs>,
  s: NormalizedLandmark, e: NormalizedLandmark, w: NormalizedLandmark,
  _h: NormalizedLandmark, _k: NormalizedLandmark, _a: NormalizedLandmark,
): FormAnalysis {
  const elbowAngle = angleBetween(s, e, w)
  // Wrist over elbow: in side view wrist.x ≈ elbow.x
  const wristOver = Math.abs(w.x - e.x)

  let cue = ''

  // At the bottom of the press, elbow angle should be ~75–100°
  if (elbowAngle < 60) {
    colors.set(idx.elbow, 'red')
    cue = 'Too deep — protect your shoulders'
  } else if (elbowAngle < 75) {
    colors.set(idx.elbow, 'yellow')
    cue = 'Slight touch and go'
  } else if (elbowAngle > 110 && elbowAngle < 160) {
    colors.set(idx.elbow, 'yellow')
    cue = 'Come down further'
  }

  // Wrist alignment
  if (wristOver > 0.07) {
    colors.set(idx.wrist, 'red')
    if (!cue) cue = 'Stack wrists over elbows'
  } else if (wristOver > 0.04) {
    colors.set(idx.wrist, 'yellow')
    if (!cue) cue = 'Check wrist position'
  }

  if (!cue) {
    colors.set(idx.elbow, 'green')
    colors.set(idx.wrist, 'green')
    cue = elbowAngle > 155 ? 'Full lockout' : 'Good depth'
  }

  return { jointColors: colors, cue }
}

// ─── LAT PULLDOWN ────────────────────────────────────────────────────────────

function analyzeLatPulldown(
  _lms: NormalizedLandmark[],
  colors: Map<number, JointColor>,
  idx: ReturnType<typeof sideLMs>,
  s: NormalizedLandmark, e: NormalizedLandmark, w: NormalizedLandmark,
  h: NormalizedLandmark, k: NormalizedLandmark, _a: NormalizedLandmark,
): FormAnalysis {
  const elbowAngle = angleBetween(s, e, w)
  const torsoLean = angleFromVertical(h, s) // how far torso is from vertical

  let cue = ''

  // Full extension at top: elbow should be near straight
  if (elbowAngle > 155) {
    colors.set(idx.elbow, 'green')
    cue = 'Good — full stretch'
  }

  // At bottom of pull: elbow should come well below shoulder
  if (elbowAngle < 50) {
    colors.set(idx.elbow, 'green')
    if (!cue) cue = 'Good pull depth'
  } else if (elbowAngle > 90 && elbowAngle < 150) {
    colors.set(idx.elbow, 'yellow')
    if (!cue) cue = 'Pull bar down to chin'
  }

  // Excessive torso lean
  if (torsoLean > 35) {
    colors.set(idx.hip, 'red')
    colors.set(idx.shoulder, 'yellow')
    if (!cue) cue = 'Sit upright — less lean'
  } else if (torsoLean > 20) {
    colors.set(idx.hip, 'yellow')
    if (!cue) cue = 'Reduce torso lean'
  }

  // Knee position — should stay under pad (k.y should be around h.y or lower)
  if (k.y < h.y - 0.05) {
    colors.set(idx.knee, 'yellow')
    if (!cue) cue = 'Keep knees under the pad'
  }

  if (!cue) {
    colors.set(idx.shoulder, 'green')
    cue = 'Looking good'
  }

  return { jointColors: colors, cue }
}
