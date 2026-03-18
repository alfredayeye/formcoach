export type Exercise = 'BENCH_PRESS' | 'OVERHEAD_PRESS' | 'DEADLIFT' | 'LAT_PULLDOWN'

export const EXERCISE_LABELS: Record<Exercise, string> = {
  BENCH_PRESS: 'Bench Press',
  OVERHEAD_PRESS: 'Overhead Press',
  DEADLIFT: 'Deadlift',
  LAT_PULLDOWN: 'Lat Pulldown',
}

export type JointColor = 'green' | 'yellow' | 'red'

export interface FormAnalysis {
  // landmark index → color override (omit = default cyan)
  jointColors: Map<number, JointColor>
  cue: string
}

export type AppScreen = 'select' | 'session'
