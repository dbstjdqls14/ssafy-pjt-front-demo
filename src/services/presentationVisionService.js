const MEDIAPIPE_VERSION = '0.10.35'
const DEFAULT_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const DEFAULT_FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const DEFAULT_POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const clampScore = (value) => Math.round(Math.min(100, Math.max(0, value)))
const safeRatio = (value, base) => (Math.abs(base) < 0.0001 ? 0 : value / Math.abs(base))

const averageCategoryScore = (categories, names) => {
  const values = names
    .map((name) => categories.find((category) => category.categoryName === name)?.score)
    .filter((score) => Number.isFinite(score))
  return values.length
    ? values.reduce((total, score) => total + score, 0) / values.length
    : 0
}

export const scoreFaceAlignment = (landmarks = [], blendshapes = []) => {
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

  const geometryScore = 100 - irisOffset * 150 - headOffset * 110
  if (!blendshapes.length) return clampScore(geometryScore)

  const lookLeft = averageCategoryScore(blendshapes, ['eyeLookOutLeft', 'eyeLookInRight'])
  const lookRight = averageCategoryScore(blendshapes, ['eyeLookInLeft', 'eyeLookOutRight'])
  const lookUp = averageCategoryScore(blendshapes, ['eyeLookUpLeft', 'eyeLookUpRight'])
  const lookDown = averageCategoryScore(blendshapes, ['eyeLookDownLeft', 'eyeLookDownRight'])
  const horizontalPenalty = Math.max(lookLeft, lookRight) * 100
  const verticalPenalty = Math.max(lookUp, Math.max(0, lookDown - 0.2)) * 80

  return clampScore(geometryScore - horizontalPenalty - verticalPenalty)
}

export const scorePosture = (landmarks = [], aspectRatio = 1) => {
  if (landmarks.length < 13) return null

  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]

  if (![leftShoulder, rightShoulder].every(Boolean)) return null

  const shoulderWidth = Math.max(Math.abs(rightShoulder.x - leftShoulder.x), 0.01)
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y)
    / (shoulderWidth * safeAspectRatio)
  const shoulderVisibility = Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1)

  if (shoulderVisibility < 0.35) return null

  let score = 100 - shoulderTilt * 180
  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const hipVisibility = Math.min(leftHip?.visibility ?? 0, rightHip?.visibility ?? 0)
  if (leftHip && rightHip && hipVisibility >= 0.25) {
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
    const hipCenterX = (leftHip.x + rightHip.x) / 2
    const torsoLean = Math.abs(shoulderCenterX - hipCenterX) / shoulderWidth
    score -= torsoLean * 220
  }

  return clampScore(score)
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
    outputFaceBlendshapes: true,
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
  const faceBlendshapes = faceResult.faceBlendshapes?.[0]?.categories ?? []
  const poseLandmarks = poseResult.landmarks?.[0] ?? []
  const aspectRatio = video.videoWidth && video.videoHeight
    ? video.videoWidth / video.videoHeight
    : 1

  return {
    gazeScore: scoreFaceAlignment(faceLandmarks, faceBlendshapes),
    postureScore: scorePosture(poseLandmarks, aspectRatio),
    faceDetected: faceLandmarks.length > 0,
    poseDetected: poseLandmarks.length > 0,
    delegate: models.delegate,
  }
}
