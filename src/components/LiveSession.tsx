import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Exercise, FormAnalysis, JointColor } from '../types'
import { EXERCISE_LABELS } from '../types'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { analyzeForm } from '../pose/formAnalyzer'
import { RepDetector } from '../pose/repDetector'
import { CONNECTIONS, LM } from '../pose/landmarks'

const JOINT_COLOR_MAP = { green: '#00c853', yellow: '#ffd600', red: '#ff1744' }
const DEFAULT_JOINT = '#00e5ff'
const BONE_COLOR = 'rgba(255,255,255,0.45)'

// Don't draw dots on face — only body joints
const FACE_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

// Joints used for the form score calculation
const SCORE_JOINTS = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,    LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,    LM.RIGHT_WRIST,
  LM.LEFT_HIP,      LM.RIGHT_HIP,
  LM.LEFT_KNEE,     LM.RIGHT_KNEE,
]

function computeRawScore(colors: Map<number, JointColor>): number {
  let sum = 0
  for (const joint of SCORE_JOINTS) {
    const c = colors.get(joint)
    sum += c === 'red' ? 0 : c === 'yellow' ? 0.5 : 1.0
  }
  return sum / SCORE_JOINTS.length
}

/**
 * Stabilises the cue string.
 * A new cue must be seen consistently for THRESHOLD frames before it replaces
 * the current one — prevents single-frame jitter from showing on screen.
 */
class CueStabilizer {
  private current = ''
  private pending = ''
  private pendingCount = 0
  private readonly threshold: number

  constructor(threshold = 22) { this.threshold = threshold }

  update(newCue: string): string {
    if (newCue === this.current) {
      this.pending = ''
      this.pendingCount = 0
      return this.current
    }
    if (newCue === this.pending) {
      this.pendingCount++
      if (this.pendingCount >= this.threshold) {
        this.current = newCue
        this.pending = ''
        this.pendingCount = 0
      }
    } else {
      this.pending = newCue
      this.pendingCount = 1
    }
    return this.current
  }

  reset() { this.current = ''; this.pending = ''; this.pendingCount = 0 }
}

export function LiveSession({
  exercise,
  onBack,
}: {
  exercise: Exercise
  onBack: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const repDetectorRef = useRef(new RepDetector(exercise))
  const cueStabilizer = useRef(new CueStabilizer())
  const smoothScoreRef = useRef(1.0)   // EMA, never causes re-render by itself
  const frameCount = useRef(0)

  const [cameraReady, setCameraReady] = useState(false)
  const [isCalibrating, setIsCalibrating] = useState(true)
  const [countdown, setCountdown] = useState(3)
  const [repCount, setRepCount] = useState(0)
  const [stableCue, setStableCue] = useState('')
  const [displayScore, setDisplayScore] = useState(100)

  const { isReady, detect } = usePoseLandmarker()

  // Start camera
  useEffect(() => {
    let stream: MediaStream
    ;(async () => {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play()
          setCameraReady(true)
        }
      }
    })()
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  // Calibration countdown
  useEffect(() => {
    if (!cameraReady) return
    let n = 3
    setCountdown(n)
    const id = setInterval(() => {
      n -= 1
      setCountdown(n)
      if (n === 0) { clearInterval(id); setIsCalibrating(false) }
    }, 1000)
    return () => clearInterval(id)
  }, [cameraReady])

  const drawFrame = useCallback(
    (lms: NormalizedLandmark[], analysis: FormAnalysis) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const x = (lm: NormalizedLandmark) => lm.x * canvas.width
      const y = (lm: NormalizedLandmark) => lm.y * canvas.height

      // Bones
      ctx.strokeStyle = BONE_COLOR
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      for (const [a, b] of CONNECTIONS) {
        const la = lms[a], lb = lms[b]
        if (!la || !lb || (la.visibility ?? 0) < 0.4 || (lb.visibility ?? 0) < 0.4) continue
        ctx.beginPath()
        ctx.moveTo(x(la), y(la))
        ctx.lineTo(x(lb), y(lb))
        ctx.stroke()
      }

      // Joints — skip face
      lms.forEach((lm, i) => {
        if (FACE_INDICES.has(i)) return
        if ((lm.visibility ?? 0) < 0.4) return
        const color = analysis.jointColors.get(i)
        ctx.fillStyle = color ? JOINT_COLOR_MAP[color] : DEFAULT_JOINT
        ctx.beginPath()
        ctx.arc(x(lm), y(lm), 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(x(lm), y(lm), 3, 0, Math.PI * 2)
        ctx.fill()
      })
    },
    [],
  )

  // Detection loop
  useEffect(() => {
    if (!isReady || !cameraReady || isCalibrating) return

    const loop = () => {
      const video = videoRef.current
      if (video && video.readyState >= 2) {
        const result = detect(video, performance.now())
        if (result?.landmarks?.[0]) {
          const lms = result.landmarks[0]
          const analysis = analyzeForm(exercise, lms)

          drawFrame(lms, analysis)

          // Stabilise cue — only update React state when it actually changes
          const nextCue = cueStabilizer.current.update(analysis.cue)
          setStableCue((prev) => (prev !== nextCue ? nextCue : prev))

          // EMA score — update display every 10 frames to avoid excessive renders
          const rawScore = computeRawScore(analysis.jointColors)
          smoothScoreRef.current = 0.92 * smoothScoreRef.current + 0.08 * rawScore
          frameCount.current++
          if (frameCount.current % 10 === 0) {
            setDisplayScore(Math.round(smoothScoreRef.current * 100))
          }

          if (repDetectorRef.current.addFrame(lms)) {
            setRepCount((c) => c + 1)
          }
        }
      }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [isReady, cameraReady, isCalibrating, exercise, detect, drawFrame])

  const loadingMessage = !cameraReady
    ? 'Starting camera…'
    : !isReady
      ? 'Loading pose model…'
      : null

  const scoreColor =
    displayScore >= 85 ? '#00c853' : displayScore >= 65 ? '#ffd600' : '#ff1744'

  const cueToShow = stableCue || (isCalibrating ? '' : 'Start your set')

  return (
    <div style={styles.screen}>
      <video ref={videoRef} style={styles.video} muted playsInline />
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Loading */}
      {loadingMessage && (
        <div style={styles.overlay}>
          <p style={styles.loadingText}>{loadingMessage}</p>
        </div>
      )}

      {/* Calibration */}
      {cameraReady && isReady && isCalibrating && (
        <div style={styles.overlay}>
          <p style={styles.calibTitle}>Stand in frame</p>
          <p style={styles.calibSub}>Detecting camera angle…</p>
          <p style={styles.countdown}>{countdown}</p>
        </div>
      )}

      {/* Top HUD */}
      {!isCalibrating && (
        <div style={styles.hud}>
          <span style={styles.hudExercise}>{EXERCISE_LABELS[exercise]}</span>
          <span style={styles.hudReps}>Rep {repCount}</span>
        </div>
      )}

      {/* Score badge — top right */}
      {!isCalibrating && (
        <div style={{ ...styles.scoreBadge, borderColor: scoreColor }}>
          <span style={{ ...styles.scoreNumber, color: scoreColor }}>{displayScore}</span>
          <span style={styles.scoreLabel}>%</span>
        </div>
      )}

      {/* Bottom cue — stable, only renders when text actually changes */}
      {!isCalibrating && (
        <div style={styles.feedback}>
          <p style={styles.cueText}>{cueToShow}</p>
        </div>
      )}

      <button style={styles.backBtn} onClick={onBack}>← Back</button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  screen: { position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' },
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
  overlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { color: '#888', fontSize: 18, fontFamily: 'system-ui, sans-serif' },
  calibTitle: { color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: 'system-ui, sans-serif' },
  calibSub: { color: '#888', fontSize: 15, marginTop: 8, fontFamily: 'system-ui, sans-serif' },
  countdown: { color: '#00e5ff', fontSize: 80, fontWeight: 700, marginTop: 24, fontFamily: 'system-ui, sans-serif' },
  hud: {
    position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.55)', borderRadius: 12,
    padding: '8px 20px', display: 'flex', gap: 16, alignItems: 'center',
    fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap',
  },
  hudExercise: { color: '#fff', fontSize: 15, fontWeight: 700 },
  hudReps: { color: '#00e5ff', fontSize: 15, fontWeight: 700 },
  scoreBadge: {
    position: 'absolute', top: 44, right: 16,
    width: 58, height: 58,
    borderRadius: '50%', border: '3px solid',
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 0,
    fontFamily: 'system-ui, sans-serif',
  },
  scoreNumber: { fontSize: 20, fontWeight: 800, lineHeight: 1 },
  scoreLabel: { fontSize: 11, color: '#888', alignSelf: 'flex-end', marginBottom: 3 },
  feedback: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    background: 'rgba(0,0,0,0.7)', borderRadius: 16, padding: '16px 20px',
    fontFamily: 'system-ui, sans-serif',
  },
  cueText: { color: '#fff', fontSize: 19, fontWeight: 500, textAlign: 'center', lineHeight: 1.4 },
  backBtn: {
    position: 'absolute', top: 40, left: 12,
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    fontSize: 15, cursor: 'pointer', padding: 8,
    fontFamily: 'system-ui, sans-serif',
  },
}
