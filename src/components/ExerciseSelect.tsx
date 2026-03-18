import type { Exercise } from '../types'
import { EXERCISE_LABELS } from '../types'

const exercises = Object.keys(EXERCISE_LABELS) as Exercise[]

export function ExerciseSelect({ onSelect }: { onSelect: (e: Exercise) => void }) {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>FormCoach</h1>
        <p style={styles.subtitle}>Select your exercise</p>
      </div>

      <div style={styles.list}>
        {exercises.map((ex) => (
          <button key={ex} style={styles.card} onClick={() => onSelect(ex)}>
            <span style={styles.cardLabel}>{EXERCISE_LABELS[ex]}</span>
            <span style={styles.arrow}>→</span>
          </button>
        ))}
      </div>

      <p style={styles.hint}>
        Mount your phone on the magnetic holder before starting.
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    width: '100%', height: '100%',
    background: '#0a0a0a',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 24px 32px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: { textAlign: 'center', marginBottom: 48 },
  title: { fontSize: 36, fontWeight: 700, color: '#00e5ff', margin: 0 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  list: { width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    width: '100%', padding: '20px 24px',
    background: '#1a1a1a', border: 'none', borderRadius: 16,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cardLabel: { fontSize: 20, fontWeight: 500, color: '#fff' },
  arrow: { fontSize: 20, color: '#00e5ff' },
  hint: { marginTop: 40, fontSize: 13, color: '#444', textAlign: 'center', lineHeight: 1.6 },
}
