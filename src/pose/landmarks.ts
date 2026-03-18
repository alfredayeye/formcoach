import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// MediaPipe Pose landmark indices
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,     RIGHT_HEEL: 30,
} as const

// Skeleton bone connections to draw
export const CONNECTIONS: [number, number][] = [
  [LM.LEFT_SHOULDER,  LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER,  LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP,       LM.RIGHT_HIP],
  [LM.LEFT_SHOULDER,  LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW,     LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW,    LM.RIGHT_WRIST],
  [LM.LEFT_HIP,       LM.LEFT_KNEE],
  [LM.LEFT_KNEE,      LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE,     LM.LEFT_HEEL],
  [LM.RIGHT_HIP,      LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE,     LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE,    LM.RIGHT_HEEL],
]

/**
 * Return the side (left/right indices) with higher average visibility.
 * Used to pick the side facing the camera in a side-view shot.
 */
export function betterSide(lms: NormalizedLandmark[]): 'left' | 'right' {
  const leftVis = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_HIP, LM.LEFT_KNEE]
    .reduce((s, i) => s + (lms[i]?.visibility ?? 0), 0)
  const rightVis = [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_HIP, LM.RIGHT_KNEE]
    .reduce((s, i) => s + (lms[i]?.visibility ?? 0), 0)
  return leftVis >= rightVis ? 'left' : 'right'
}

export function sideLMs(side: 'left' | 'right') {
  return side === 'left'
    ? { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST, hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE }
    : { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE }
}
