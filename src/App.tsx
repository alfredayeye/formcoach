import { useState } from 'react'
import type { Exercise } from './types'
import { ExerciseSelect } from './components/ExerciseSelect'
import { LiveSession } from './components/LiveSession'

export function App() {
  const [exercise, setExercise] = useState<Exercise | null>(null)

  if (exercise) {
    return <LiveSession exercise={exercise} onBack={() => setExercise(null)} />
  }

  return <ExerciseSelect onSelect={setExercise} />
}
