import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Exercise, FormAnalysis } from '../types'
import { EXERCISE_LABELS } from '../types'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { analyzeForm } from '../pose/formAnalyzer'
import { RepDetector } from '../pose/repDetector'
import { CONNECTIONS } from '../pose/landmarks'

const JOINT_COLOR_MAP = { green: '#00c853', yellow: '#ffd600', red: '#ff1744' }
const DEFAULT_JOINT = '#00e5ff'
const BONE_COLOR = 'rgba(255,255,255,0.5)'

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

  const [cameraReady, setCameraReady] = useState(false)
  const [isCalibrating, setIsCalibrating] = useState(true)
  const [countdown, setCountdown] = useState(3)
  const [repCount, setRepCount] = useState(0)
  const [cue, setCue] = useState('')
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

  // Draw skeleton on canvas
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
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (const [a, b] of CONNECTIONS) {
        const la = lms[a], lb = lms[b]
        if (!la || !lb || (la.visibility ?? 0) < 0.4 || (lb.visibility ?? 0) < 0.4) continue
        ctx.beginPath()
        ctx.moveTo(x(la), y(la))
        ctx.lineTo(x(lb), y(lb))
        ctx.stroke()
      }

      // Joints
      lms.forEach((lm, i) => {
        if ((lm.visibility ?? 0) < 0.4) return
        const color = analysis.jointColors.get(i)
        ctx.fillStyle = color ? JOINT_COLOR_MAP[color] : DEFAULT_JOINT
        ctx.beginPath()
        ctx.arc(x(lm), y(lm), 7, 0, Math.PI * 2)
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
          setCue(analysis.cue)
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

      {/* Bottom feedback */}
      {!isCalibrating && (
        <div style={styles.feedback}>
          <p style={styles.cueText}>{cue || 'Start your set'}</p>
        </div>
      )}

      {/* Back button */}
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
  loadingText: { color: '#888', fontSize: 18 },
  calibTitle: { color: '#fff', fontSize: 24, fontWeight: 700 },
  calibSub: { color: '#888', fontSize: 15, marginTop: 8 },
  countdown: { color: '#00e5ff', fontSize: 80, fontWeight: 700, marginTop: 24 },
  hud: {
    position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.6)', borderRadius: 12,
    padding: '8px 20px', display: 'flex', gap: 16, alignItems: 'center',
    fontFamily: 'system-ui, sans-serif',
  },
  hudExercise: { color: '#fff', fontSize: 15, fontWeight: 700 },
  hudReps: { color: '#00e5ff', fontSize: 15, fontWeight: 700 },
  feedback: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    background: 'rgba(0,0,0,0.75)', borderRadius: 16, padding: '14px 20px',
    fontFamily: 'system-ui, sans-serif',
  },
  cueText: { color: '#fff', fontSize: 18, fontWeight: 500, textAlign: 'center' },
  backBtn: {
    position: 'absolute', top: 40, left: 12,
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
    fontSize: 15, cursor: 'pointer', padding: 8,
    fontFamily: 'system-ui, sans-serif',
  },
}
