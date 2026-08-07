const MEDIAPIPE_VERSION = '0.10.35'
const DEFAULT_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const DEFAULT_FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const DEFAULT_POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const clampScore = (value) => Math.round(Math.min(100, Math.max(0, value)))
const safeRatio = (value, base) => (Math.abs(base) < 0.0001 ? 0 : value / Math.abs(base))

export const scoreFaceAlignment = (landmarks = []) => {
  if (landmarks.length < 474) return null

  const leftEyeOuter = landmarks[33]
  const leftEyeInner = landmarks[133]
  const rightEyeInner = landmarks[362]
  const rightEyeOuter = landmarks[263]
  const leftIris = landmarks[468]
  const rightIris = landmarks[473]
  const nose = landmarks[1]

  if (![leftEyeOuter, leftEyeInner, rightEyeInner, rightEyeOuter, leftIris, rightIris, nose].every(Boolean)) {
    return null
  }

  const leftRatio = safeRatio(leftIris.x - leftEyeOuter.x, leftEyeInner.x - leftEyeOuter.x)
  const rightRatio = safeRatio(rightIris.x - rightEyeInner.x, rightEyeOuter.x - rightEyeInner.x)
  const eyesCenter = (leftEyeOuter.x + rightEyeOuter.x) / 2
  const faceWidth = Math.abs(rightEyeOuter.x - leftEyeOuter.x)
  const headOffset = safeRatio(Math.abs(nose.x - eyesCenter), faceWidth)
  const irisOffset = (Math.abs(leftRatio - 0.5) + Math.abs(rightRatio - 0.5)) / 2

  return clampScore(100 - irisOffset * 150 - headOffset * 110)
}

export const scorePosture = (landmarks = []) => {
  if (landmarks.length < 25) return null

  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const leftHip = landmarks[23]
  const rightHip = landmarks[24]

  if (![leftShoulder, rightShoulder, leftHip, rightHip].every(Boolean)) return null

  const shoulderWidth = Math.max(Math.abs(rightShoulder.x - leftShoulder.x), 0.01)
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
  const hipCenterX = (leftHip.x + rightHip.x) / 2
  const torsoLean = Math.abs(shoulderCenterX - hipCenterX) / shoulderWidth
  const shoulderVisibility = Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1)
  const hipVisibility = Math.min(leftHip.visibility ?? 1, rightHip.visibility ?? 1)

  if (Math.min(shoulderVisibility, hipVisibility) < 0.35) return null

  return clampScore(100 - shoulderTilt * 180 - torsoLean * 220)
}

let modelPromise = null

const createModels = async (delegate) => {
  const { FaceLandmarker, FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  const wasmRoot = import.meta.env?.VITE_MEDIAPIPE_WASM_URL || DEFAULT_WASM_ROOT
  const vision = await FilesetResolver.forVisionTasks(wasmRoot)
  const baseOptions = (modelAssetPath) => ({
    modelAssetPath,
    ...(delegate ? { delegate } : {}),
  })

  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: baseOptions(import.meta.env?.VITE_MEDIAPIPE_FACE_MODEL_URL || DEFAULT_FACE_MODEL),
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  try {
    const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: baseOptions(import.meta.env?.VITE_MEDIAPIPE_POSE_MODEL_URL || DEFAULT_POSE_MODEL),
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    return { faceLandmarker, poseLandmarker, delegate: delegate || 'CPU' }
  } catch (error) {
    faceLandmarker.close()
    throw error
  }
}

export const loadPresentationVisionModels = () => {
  if (!modelPromise) {
    modelPromise = createModels('GPU').catch(() => createModels(undefined)).catch((error) => {
      modelPromise = null
      throw error
    })
  }
  return modelPromise
}

export const analyzePresentationFrame = async (video, timestampMs) => {
  const models = await loadPresentationVisionModels()
  const faceResult = models.faceLandmarker.detectForVideo(video, timestampMs)
  const poseResult = models.poseLandmarker.detectForVideo(video, timestampMs)

  const faceLandmarks = faceResult.faceLandmarks?.[0] ?? []
  const poseLandmarks = poseResult.landmarks?.[0] ?? []

  return {
    gazeScore: scoreFaceAlignment(faceLandmarks),
    postureScore: scorePosture(poseLandmarks),
    faceDetected: faceLandmarks.length > 0,
    poseDetected: poseLandmarks.length > 0,
    delegate: models.delegate,
  }
}
