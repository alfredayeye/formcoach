import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'

export function usePoseLandmarker() {
  const [isReady, setIsReady] = useState(false)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      )
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      if (!cancelled) {
        landmarkerRef.current = landmarker
        setIsReady(true)
      }
    })()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
    }
  }, [])

  function detect(video: HTMLVideoElement, timestamp: number) {
    return landmarkerRef.current?.detectForVideo(video, timestamp) ?? null
  }

  return { isReady, detect }
}
