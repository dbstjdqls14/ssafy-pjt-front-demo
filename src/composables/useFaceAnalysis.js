import { computed, onBeforeUnmount, ref } from 'vue'

// MediaPipe FaceLandmarker로 카메라 프레임을 브라우저 안에서 분석한다.
// 프레임이 서버로 전송되지 않는 완전한 프론트 처리다.
// - 시선 안정도(gazeScore): 최근 샘플 중 정면 응시(고개 회전이 작음) 비율 %
// - 시선 이탈 횟수(gazeDeviationCount): 정면을 보다가 벗어난 "순간"의 누적 횟수
// - 자세(postureLabel): 고개 기울기(roll)·얼굴 감지 여부 기반 라벨
// - 기울어짐 비율(tiltScore): 최근 샘플 중 기울어진(±10도 이상) 비율 %
//
// 모델(.task ~3MB)과 wasm은 공식 CDN에서 최초 1회 내려받는다(https라 http 페이지
// 에서도 로드 가능). 로드 실패 시 지표는 null로 남고 화면은 '--'를 보여준다.

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const SAMPLE_INTERVAL_MS = 300
const GAZE_WINDOW = 20 // 최근 6초(300ms×20) 기준 — 길게 잡으면 두리번거려도 %가 굼뜨게 움직인다
const GAZE_HORIZONTAL_THRESHOLD = 0.4
const GAZE_UP_THRESHOLD = 0.4
const GAZE_DOWN_THRESHOLD = 0.65
const GAZE_YAW_THRESHOLD = 0.28
const GAZE_DEVIATION_CONFIRM_SAMPLES = 2

// FaceMesh 랜드마크 인덱스: 33 = 오른눈 바깥, 263 = 왼눈 바깥, 1 = 코끝
const RIGHT_EYE = 33
const LEFT_EYE = 263
const NOSE_TIP = 1

export const useFaceAnalysis = () => {
  const ready = ref(false)
  const failed = ref(false)
  const faceDetected = ref(false)
  const gazeScore = ref(null) // 0~100(%), 아직 샘플 없으면 null
  const headTiltDeg = ref(null)
  const tiltScore = ref(null) // 0~100(%) — 최근 샘플 중 기울어진 비율
  const gazeDeviationCount = ref(0) // 화면을 보다가 벗어난 "횟수"(계속 벗어나 있는 동안은 1회로만 센다)
  const gazeFrontal = ref(null)
  const postureTilted = ref(null)

  let landmarker = null
  let loadPromise = null
  let timerId = null
  let videoEl = null
  let lastVideoTime = -1
  const gazeSamples = []
  const tiltSamples = []
  let wasFrontal = null
  let consecutiveDeviationSamples = 0

  // 리포트의 몸짓 그래프(구간별 그래프)가 실제로 움직이려면 "언제 무슨 일이
  // 있었는지" 시간 정보가 있어야 한다 — 세션 전체 요약(카운트/퍼센트) 하나만
  // 보내던 것에 더해, 시선 이탈은 발생 시각을, 기울기는 10초 구간별 비율을
  // 같이 모아뒀다가 세션 요약에 실어 보낸다.
  let activeElapsedMs = 0
  let activeStartedAt = 0
  let gazeEvents = []
  let tiltBucketCounts = [] // index=버킷 번호(10초 단위), { tiltCount, sampleCount }
  const TILT_BUCKET_SEC = 10
  const elapsedSec = () => Math.max(0, (
    activeElapsedMs + (activeStartedAt ? performance.now() - activeStartedAt : 0)
  ) / 1000)

  const postureLabel = computed(() => {
    if (!ready.value || headTiltDeg.value == null) return null
    if (!faceDetected.value) return '화면 이탈'
    return Math.abs(headTiltDeg.value) < 10 ? '안정' : '기울어짐'
  })

  // 녹화 완료 시 요청 본문에 실어 보낼 세션 전체 요약. gazeEvents·tiltBuckets가
  // 백엔드가 구간별 그래프를 그릴 수 있는 시간 정보다(postureTiltPercent·
  // sampleCount는 tiltBuckets로 대체 가능한 중복 요약값이라 제거함).
  const getSessionSummary = () => ({
    gazeDeviationCount: gazeDeviationCount.value,
    gazeEvents: gazeEvents.map((e) => ({ ...e })),
    tiltBuckets: tiltBucketCounts.map((bucket, index) => ({
      startSec: index * TILT_BUCKET_SEC,
      endSec: (index + 1) * TILT_BUCKET_SEC,
      tiltPct: bucket.sampleCount ? Math.round((bucket.tiltCount / bucket.sampleCount) * 100) : 0,
    })),
  })
  const resetSessionSummary = () => {
    gazeDeviationCount.value = 0
    gazeFrontal.value = null
    postureTilted.value = null
    wasFrontal = null
    activeElapsedMs = 0
    activeStartedAt = 0
    gazeEvents = []
    tiltBucketCounts = []
    consecutiveDeviationSamples = 0
  }

  const loadLandmarker = async () => {
    if (landmarker || failed.value) return landmarker
    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
          const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
          landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            // 눈동자 방향 지표(eyeLook* 블렌드셰이프) — 시선 판정에 사용
            outputFaceBlendshapes: true,
          })
          ready.value = true
        } catch (error) {
          failed.value = true
          if (import.meta.env?.DEV) {
            console.info('[AIVO] MediaPipe 로드 실패(시선·자세 분석 없이 진행):', error?.message ?? error)
          }
        }
        return landmarker
      })().finally(() => { loadPromise = null })
    }
    return loadPromise
  }

  const pushGazeSample = (isFrontal) => {
    gazeFrontal.value = Boolean(isFrontal)
    gazeSamples.push(isFrontal)
    if (gazeSamples.length > GAZE_WINDOW) gazeSamples.shift()
    gazeScore.value = Math.round((gazeSamples.filter(Boolean).length / gazeSamples.length) * 100)
    // 정면(frontal)이다가 벗어난 "순간"만 1회로 센다 — 계속 벗어나 있는 동안
    // 매 프레임(300ms)마다 세면 몇 초 만에 수십 회가 돼 의미가 없어진다.
    if (isFrontal) {
      consecutiveDeviationSamples = 0
      wasFrontal = true
      return
    }
    if (wasFrontal === true) {
      consecutiveDeviationSamples += 1
      if (consecutiveDeviationSamples >= GAZE_DEVIATION_CONFIRM_SAMPLES) {
        gazeDeviationCount.value += 1
        gazeEvents.push({ atSec: Math.round(elapsedSec()) })
        consecutiveDeviationSamples = 0
        wasFrontal = false
      }
      return
    }
    consecutiveDeviationSamples = 0
    wasFrontal = false
  }
  // postureLabel과 같은 기준(±10도 또는 얼굴 미검출 = 기울어짐)으로 세션 누적치를 센다.
  const trackPostureSample = (isTilted) => {
    postureTilted.value = Boolean(isTilted)
    tiltSamples.push(isTilted)
    if (tiltSamples.length > GAZE_WINDOW) tiltSamples.shift()
    tiltScore.value = Math.round((tiltSamples.filter(Boolean).length / tiltSamples.length) * 100)

    // 10초 구간별 기울기 비율 — 그래프가 실제 시간 흐름에 따라 움직이도록
    // 버킷마다 표본/기울어진 표본 수를 따로 쌓아둔다.
    const bucketIndex = Math.floor(elapsedSec() / TILT_BUCKET_SEC)
    while (tiltBucketCounts.length <= bucketIndex) tiltBucketCounts.push({ tiltCount: 0, sampleCount: 0 })
    tiltBucketCounts[bucketIndex].sampleCount += 1
    if (isTilted) tiltBucketCounts[bucketIndex].tiltCount += 1
  }

  const analyzeFrame = () => {
    if (!landmarker || !videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return
    // 같은 프레임을 두 번 분석하지 않는다(탭 백그라운드 등으로 영상이 멈춘 경우).
    if (videoEl.currentTime === lastVideoTime) return
    lastVideoTime = videoEl.currentTime

    let result
    try {
      result = landmarker.detectForVideo(videoEl, performance.now())
    } catch {
      return
    }
    const landmarks = result?.faceLandmarks?.[0]
    if (!landmarks) {
      faceDetected.value = false
      headTiltDeg.value = headTiltDeg.value ?? 0
      pushGazeSample(false)
      trackPostureSample(true)
      return
    }
    faceDetected.value = true

    // 랜드마크는 가로·세로가 각각 0~1로 정규화돼 있어 16:9 화면에서는 세로가
    // 1.78배 부풀려진다 → 픽셀 좌표로 되돌려 실제 비율·각도로 계산한다.
    const vw = videoEl.videoWidth || 1
    const vh = videoEl.videoHeight || 1
    const toPx = (lm) => ({ x: lm.x * vw, y: lm.y * vh })
    const eyeR = toPx(landmarks[RIGHT_EYE])
    const eyeL = toPx(landmarks[LEFT_EYE])
    const nose = toPx(landmarks[NOSE_TIP])
    const eyeDist = Math.hypot(eyeL.x - eyeR.x, eyeL.y - eyeR.y) || 1
    const midX = (eyeL.x + eyeR.x) / 2
    const midY = (eyeL.y + eyeR.y) / 2

    // roll: 두 눈을 잇는 선의 기울기 → 고개가 좌우로 기울어진 정도(실제 각도)
    const roll = (Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x) * 180) / Math.PI
    headTiltDeg.value = Math.round(roll)
    trackPostureSample(Math.abs(headTiltDeg.value) >= 10)

    // 고개 좌우 회전(yaw) 근사 — 시선 판정의 보조 조건(고개를 옆으로 돌린 채
    // 곁눈질로 화면을 보는 경우까지 정면으로 치지 않게 느슨하게만 건다).
    const yawRatio = (nose.x - midX) / eyeDist

    // 시선은 고개(코) 방향이 아니라 '눈동자 방향'(eyeLook* 블렌드셰이프)으로
    // 판정한다. 카메라가 화면 위에 있어 화면 응시 = 살짝 아래 보기이므로
    // 아래 방향은 임계값을 후하게 준다.
    const categories = result?.faceBlendshapes?.[0]?.categories
    if (categories?.length) {
      const score = {}
      for (const c of categories) score[c.categoryName] = c.score
      const pair = (a, b) => ((score[a] ?? 0) + (score[b] ?? 0)) / 2
      const lookLeft = pair('eyeLookOutLeft', 'eyeLookInRight')
      const lookRight = pair('eyeLookInLeft', 'eyeLookOutRight')
      const lookUp = pair('eyeLookUpLeft', 'eyeLookUpRight')
      const lookDown = pair('eyeLookDownLeft', 'eyeLookDownRight')
      // 자연스러운 눈 움직임은 정면 범위로 허용하고, 지속되는 이탈만 별도로 확정한다.
      const eyesOnScreen = Math.max(lookLeft, lookRight) < GAZE_HORIZONTAL_THRESHOLD
        && lookUp < GAZE_UP_THRESHOLD
        && lookDown < GAZE_DOWN_THRESHOLD
      pushGazeSample(eyesOnScreen && Math.abs(yawRatio) < GAZE_YAW_THRESHOLD)
    } else {
      // 블렌드셰이프가 없으면(모델 옵션 미지원) 기하 근사로 대체
      const pitchRatio = (nose.y - midY) / eyeDist
      pushGazeSample(Math.abs(yawRatio) < GAZE_YAW_THRESHOLD && pitchRatio > 0.3 && pitchRatio < 1.0)
    }
  }

  let analysisGeneration = 0

  const beginAnalysis = async (targetVideoEl, { reset = false } = {}) => {
    const generation = ++analysisGeneration
    videoEl = targetVideoEl ?? videoEl
    if (!videoEl || timerId) return
    if (reset) resetSessionSummary()
    await loadLandmarker()
    if (generation !== analysisGeneration || !landmarker || !videoEl || timerId) return
    activeStartedAt = performance.now()
    timerId = window.setInterval(analyzeFrame, SAMPLE_INTERVAL_MS)
  }

  const suspend = ({ clearTarget = false } = {}) => {
    analysisGeneration += 1
    if (activeStartedAt) {
      activeElapsedMs += performance.now() - activeStartedAt
      activeStartedAt = 0
    }
    if (timerId) {
      window.clearInterval(timerId)
      timerId = null
    }
    // A pause/resume boundary is not a gaze-deviation event. The first sample
    // after resuming only establishes the new baseline.
    wasFrontal = null
    consecutiveDeviationSamples = 0
    if (clearTarget) videoEl = null
  }

  const start = (targetVideoEl) => beginAnalysis(targetVideoEl, { reset: true })
  const resume = (targetVideoEl) => beginAnalysis(targetVideoEl, { reset: false })
  const pause = () => suspend()
  const stop = () => suspend({ clearTarget: true })

  onBeforeUnmount(() => {
    stop()
    landmarker?.close?.()
    landmarker = null
  })

  return {
    ready,
    failed,
    faceDetected,
    gazeScore,
    headTiltDeg,
    postureLabel,
    tiltScore,
    gazeDeviationCount,
    gazeFrontal,
    postureTilted,
    prepare: loadLandmarker,
    start,
    pause,
    resume,
    stop,
    getSessionSummary,
  }
}
