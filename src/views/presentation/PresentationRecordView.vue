<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import RequiredMediaPermissionModal from '../../components/common/RequiredMediaPermissionModal.vue'
import PresentationSlideZoomControl from '../../components/presentation/PresentationSlideZoomControl.vue'
import { useActionInterlock } from '../../composables/useActionInterlock.js'
import { useCaptureBridge } from '../../composables/useCaptureBridge.js'
import { useFaceAnalysis } from '../../composables/useFaceAnalysis.js'
import {
  INTERVIEW_MEDIA_CONSTRAINTS,
  useMediaDevices,
} from '../../composables/useMediaDevices.js'
import { useMicLevel } from '../../composables/useMicLevel.js'
import {
  calculateSyllablesPerSecond,
  calculateWpm,
} from '../../composables/useRealtimePresentationAnalysis.js'
import { useRecorder } from '../../composables/useRecorder.js'
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js'
import { PcmWavCapture } from '../../services/pcmWavCapture.js'
import { useAuthStore } from '../../stores/authStore.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import {
  PresentationDetectionAccumulator,
  toInterviewAlignedDetectionSample,
} from '../../utils/presentationArtifacts.js'
import { createFillerAccumulator } from '../../utils/interviewAudioAnalysis.js'
import { formatCount, formatDecimal } from '../../utils/displayFormatters.js'
import {
  clearActiveRecording,
  markActiveRecording,
  queueRecordingResetNotice,
  shouldResetRecordingAfterReload,
} from '../../utils/recordingRefreshRecovery.js'
import { speechPaceDetail, speechPaceLabel, speechPaceLevel } from '../../utils/speechPace.js'
import { readBooleanStorage, writeBooleanStorage } from '../../utils/storage.js'

const router = useRouter()
const auth = useAuthStore()
const presentation = usePresentationStore()
const recording = useRecordingStore()
const transitionGate = useActionInterlock({ cooldownMs: 1000 })
const deviceBlocked = ref(false)
const deviceRetrying = ref(false)
const showResumeConfirm = ref(false)
let freezeForDeviceLoss = () => {}
let resumeAfterDeviceRecovery = false
const {
  stream,
  videoTrack,
  audioTrack,
  videoPermissionState,
  audioPermissionState,
  checkDevices,
  requestRequiredDevices,
  requestVideo,
  requestAudio,
  refreshPermissionStates,
  releaseVideo,
  releaseAudio,
  stopStream,
} = useMediaDevices({ onRequiredDeviceLost: (event) => freezeForDeviceLoss(event) })
const recorder = useRecorder()
const speech = useSpeechRecognition()
const faceAnalysis = useFaceAnalysis()
const { level: micLevel, start: startMicLevel, stop: stopMicLevel } = useMicLevel()

const videoEl = ref(null)
const camOn = ref(true)
const micOn = ref(true)
const hasStarted = ref(false)
const showExit = ref(false)
const slideIndex = ref(0)
const isStarting = ref(false)
const isFinishing = ref(false)
const sessionError = ref('')
const slideZoom = ref(1)
const isPortraitSlide = ref(false)

const slides = computed(() => presentation.slides)
const currentSlide = computed(() => slides.value[slideIndex.value] ?? { title: presentation.title })
const hasSlides = computed(() => presentation.hasRenderableSlides && slides.value.length > 0)
// 순환 없이: 처음/마지막 슬라이드에선 이전/다음 미리보기가 없다.
const prevSlideIndex = computed(() => slideIndex.value - 1)
const prevSlideData = computed(() => slides.value[prevSlideIndex.value] ?? null)
const nextSlideIndex = computed(() => slideIndex.value + 1)
const nextSlideData = computed(() => slides.value[nextSlideIndex.value] ?? null)
// 상단 진행 바: 세그먼트가 아니라 하나의 연속 바로 대략적 진행(전반/후반) 표시.
const progressPercent = computed(() =>
  slides.value.length ? `${((slideIndex.value + 1) / slides.value.length) * 100}%` : '0%',
)
const isPdfSource = computed(() => (
  presentation.sourceFile?.type === 'application/pdf'
  || String(presentation.sourceFile?.name ?? '').toLowerCase().endsWith('.pdf')
))
const canZoomSlide = computed(() => isPdfSource.value || isPortraitSlide.value)

const resetSlideZoom = () => {
  slideZoom.value = 1
  isPortraitSlide.value = false
}
const onSlideImageLoad = (event) => {
  const image = event.currentTarget
  isPortraitSlide.value = Number(image?.naturalHeight) > Number(image?.naturalWidth)
}
watch(() => currentSlide.value.previewUrl, resetSlideZoom)

let tickId = null
let processedTranscriptCount = 0
let captureStopPromise = null
let pcmCapture = null
let captureBridge = null
let detectionAccumulator = null
let pendingExitLocation = null
let allowRouteLeave = false

// 자막은 말한 문장이 아래에서부터 쌓이고, 새 문장이 들어오면 위로 밀려 올라간다.
// (예전에는 확정 문장 전체를 한 덩어리로 잘라 보여줘서, 말할수록 앞 문장이
//  사라지고 한 줄만 남았다.)
const TRANSCRIPT_LINE_LIMIT = 12

const transcriptLines = computed(() => {
  const interimText = String(speech.interimText.value ?? '').trim()
  const finalized = (speech.finalSegments.value.length ? speech.finalSegments.value : recording.transcriptSegments)
    .map((segment) => String(segment ?? '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  const lines = finalized
    .slice(-TRANSCRIPT_LINE_LIMIT)
    .map((text, index) => ({
      id: `final-${finalized.length - Math.min(finalized.length, TRANSCRIPT_LINE_LIMIT) + index}`,
      text,
      isCurrent: false,
    }))

  if (interimText) lines.push({ id: 'interim', text: interimText, isCurrent: true })
  // 아직 인식 중인 문장이 없으면 마지막 확정 문장을 현재 문장으로 강조한다.
  else if (lines.length) lines[lines.length - 1].isCurrent = true

  return lines
})

// 새 자막이 들어오면 항상 가장 아래(최신)가 보이게 스크롤을 따라 내린다.
const transcriptBox = ref(null)
watch(transcriptLines, () => {
  nextTick(() => {
    const box = transcriptBox.value
    if (box) box.scrollTop = box.scrollHeight
  })
})

// 말하기 속도는 숫자(WPM) 대신 느림/보통/빠름으로 보여준다. 숫자는 툴팁에 남긴다.
const paceLabel = computed(() => speechPaceLabel(recording.stats.syllablesPerSecond, 'syllablesPerSecond'))
const paceLevel = computed(() => speechPaceLevel(recording.stats.syllablesPerSecond, 'syllablesPerSecond'))
const paceDetail = computed(() => speechPaceDetail(recording.stats.syllablesPerSecond, 'syllablesPerSecond'))
const gazeLabel = computed(() => formatCount(faceAnalysis.gazeDeviationCount.value, '--'))
const postureLabel = computed(() => (
  faceAnalysis.tiltScore.value == null
    ? '--'
    : `${formatDecimal(faceAnalysis.tiltScore.value, { minimum: 0, maximum: 100, fallback: '--' })}%`
))
const mediaControlsLocked = computed(() => (hasStarted.value && !recording.isPaused) || deviceRetrying.value)
const canChangeSlide = computed(() => (
  hasSlides.value
  && !recording.isPaused
  && !isFinishing.value
  && !deviceBlocked.value
  && !transitionGate.isLocked.value
))
const canAdvanceSlide = computed(() => (
  canChangeSlide.value && slideIndex.value < slides.value.length - 1
))
const canPause = computed(() => (
  hasStarted.value && !isFinishing.value && !deviceBlocked.value && !transitionGate.isLocked.value
))
const canFinish = computed(() => (
  hasStarted.value && !isFinishing.value && !deviceBlocked.value && !transitionGate.isLocked.value
))
// 음성 크기는 화면에 표시하지 않지만(레일에서 제거), 리포트로 넘기는 stats에는
// 그대로 담아야 해서 계산은 유지한다.
const micStateLabel = computed(() => {
  if (!micOn.value) return '꺼짐'
  if (micLevel.value < 0.08) return '작음'
  if (micLevel.value > 0.7) return '큼'
  return '안정'
})
const cumulativeFillerCount = computed(() => {
  const accumulator = createFillerAccumulator()
  return presentation.audioAnalysisResults.reduce((total, analysis) => (
    accumulator.apply(analysis, analysis.sequence)
  ), 0)
})
const statusLabel = computed(() => (recording.isPaused ? '일시정지' : '녹화 중'))
const resumeDeviceWarning = computed(() => {
  if (!camOn.value && !micOn.value) {
    return {
      title: '카메라와 마이크가 꺼져 있습니다',
      message: '카메라와 마이크를 직접 켠 뒤 일시정지 해제를 다시 눌러 주세요.',
    }
  }
  if (!camOn.value) {
    return {
      title: '카메라가 꺼져 있습니다',
      message: '왼쪽의 카메라 버튼으로 화면을 직접 켠 뒤 일시정지 해제를 다시 눌러 주세요.',
    }
  }
  return {
    title: '마이크가 꺼져 있습니다',
    message: '왼쪽의 마이크 버튼으로 음성을 직접 켠 뒤 일시정지 해제를 다시 눌러 주세요.',
  }
})
const modelStatus = computed(() => {
  if (faceAnalysis.failed.value) return 'error'
  if (faceAnalysis.ready.value) return hasStarted.value ? 'running' : 'ready'
  return 'loading'
})
const modelStatusLabel = computed(() => {
  if (modelStatus.value === 'running') return 'AI 분석 중'
  if (modelStatus.value === 'loading') return 'AI 모델 준비 중'
  if (modelStatus.value === 'error') return 'AI 분석 연결 오류'
  if (modelStatus.value === 'ready') return 'AI 분석 준비 완료'
  return 'AI 분석 대기'
})

watch(stream, (value) => {
  if (videoEl.value) videoEl.value.srcObject = value ?? null
})

watch(() => speech.finalSegments.value.length, (length) => {
  for (let index = processedTranscriptCount; index < length; index += 1) {
    const text = speech.finalSegments.value[index]
    recording.addTranscript(text)
    presentation.addTranscriptEvent({
      text,
      slideIndex: slideIndex.value,
      atSeconds: recording.elapsedSeconds,
    })
  }
  processedTranscriptCount = length
})

const applyTrackState = () => {
  camOn.value = Boolean(videoTrack.value && videoTrack.value.readyState !== 'ended')
  micOn.value = Boolean(audioTrack.value && audioTrack.value.readyState !== 'ended')
  if (stream.value && micOn.value) startMicLevel(stream.value)
  else stopMicLevel()
}
const toggleCam = async () => {
  if (mediaControlsLocked.value) return
  sessionError.value = ''
  try {
    if (camOn.value) {
      captureBridge?.disconnectVideo()
      releaseVideo()
      camOn.value = false
      return
    }
    const track = await requestVideo(INTERVIEW_MEDIA_CONSTRAINTS.video)
    if (captureBridge) await captureBridge.connectVideoTrack(track)
    camOn.value = true
  } catch (error) {
    camOn.value = false
    sessionError.value = error?.message || '카메라 권한을 허용해 주세요.'
  }
}
const toggleMic = async () => {
  if (mediaControlsLocked.value) return
  sessionError.value = ''
  try {
    if (micOn.value) {
      captureBridge?.disconnectAudio()
      releaseAudio()
      micOn.value = false
      stopMicLevel()
      return
    }
    const track = await requestAudio(INTERVIEW_MEDIA_CONSTRAINTS.audio)
    if (captureBridge) await captureBridge.connectAudioTrack(track)
    micOn.value = true
    if (stream.value) startMicLevel(stream.value)
  } catch (error) {
    micOn.value = false
    sessionError.value = error?.message || '마이크 권한을 허용해 주세요.'
  }
}

const connectCaptureSources = async () => {
  if (!videoTrack.value || !audioTrack.value) await requestRequiredDevices(INTERVIEW_MEDIA_CONSTRAINTS)
  if (!videoTrack.value || !audioTrack.value) {
    throw new Error('발표를 진행하려면 카메라와 마이크 권한이 모두 필요합니다.')
  }
  if (!captureBridge) captureBridge = useCaptureBridge()
  await captureBridge.connectVideoTrack(videoTrack.value)
  await captureBridge.connectAudioTrack(audioTrack.value)
  camOn.value = true
  micOn.value = true
  if (stream.value) startMicLevel(stream.value)
  return captureBridge.outputStream
}

const pauseForDeviceLoss = () => {
  if (!recording.isRecording || recording.isPaused) return
  recording.pause()
  recorder.pause()
  pcmCapture?.pause()
  speech.pause?.()
  faceAnalysis.pause()
}

freezeForDeviceLoss = ({ kind } = {}) => {
  if (!hasStarted.value || isFinishing.value || deviceBlocked.value) return
  deviceBlocked.value = true
  resumeAfterDeviceRecovery = recording.isRecording && !recording.isPaused
  pauseForDeviceLoss()
  if (kind === 'video') {
    camOn.value = false
    captureBridge?.disconnectVideo()
  }
  if (kind === 'audio') {
    micOn.value = false
    captureBridge?.disconnectAudio()
    stopMicLevel()
  }
}

const resumeCapture = () => {
  recording.resume()
  recorder.resume()
  pcmCapture?.resume()
  speech.resume?.({ lang: 'ko-KR' })
  if (videoEl.value) {
    const resumeFaceAnalysis = faceAnalysis.resume ?? faceAnalysis.start
    void resumeFaceAnalysis(videoEl.value)
  }
}

const requestDevicesAfterLoss = async () => {
  if (deviceRetrying.value) return false
  deviceRetrying.value = true
  sessionError.value = ''
  try {
    const needsVideo = !videoTrack.value || videoTrack.value.readyState === 'ended'
    const needsAudio = !audioTrack.value || audioTrack.value.readyState === 'ended'
    await requestRequiredDevices({
      video: needsVideo ? INTERVIEW_MEDIA_CONSTRAINTS.video : false,
      audio: needsAudio ? INTERVIEW_MEDIA_CONSTRAINTS.audio : false,
    })
    await connectCaptureSources()
    deviceBlocked.value = false
    if (resumeAfterDeviceRecovery) resumeCapture()
    resumeAfterDeviceRecovery = false
    return true
  } catch {
    deviceBlocked.value = true
    return false
  } finally {
    deviceRetrying.value = false
  }
}

const performNextSlide = async () => {
  const previousIndex = slideIndex.value
  const nextIndex = previousIndex + 1
  if (!slides.value[nextIndex]) return
  if (hasStarted.value) {
    await presentation.recordSlideTransition(previousIndex, nextIndex, recording.elapsedSeconds)
  }
  slideIndex.value = nextIndex
}
const nextSlide = () => {
  if (!canAdvanceSlide.value) return
  sessionError.value = ''
  return transitionGate.runExclusive('advance-presentation-slide', performNextSlide)
    .catch((error) => {
      sessionError.value = error?.message || '슬라이드 이동 기록을 저장하지 못했습니다.'
    })
}

const onTick = () => {
  if (!recording.isRecording || recording.isPaused) return
  recording.tick()
  const transcript = speech.transcript.value
  recording.setStats({
    wpm: calculateWpm(transcript, recording.elapsedSeconds),
    syllablesPerSecond: calculateSyllablesPerSecond(transcript, recording.elapsedSeconds),
    fillerCount: cumulativeFillerCount.value,
    gazeHold: faceAnalysis.gazeScore.value,
    posture: faceAnalysis.tiltScore.value == null ? null : 100 - faceAnalysis.tiltScore.value,
    voice: micStateLabel.value,
    voiceDb: null,
  })
  const sample = toInterviewAlignedDetectionSample({
    faceDetected: faceAnalysis.faceDetected.value,
    gazeFrontal: faceAnalysis.gazeFrontal.value,
    postureTilted: faceAnalysis.postureTilted.value,
  })
  if (sample) {
    detectionAccumulator?.add({
      timestamp: recording.elapsedSeconds * 1_000,
      ...sample,
    })
  }
}

const performStartPresentation = async () => {
  if (hasStarted.value || isStarting.value) return
  if (!hasSlides.value) {
    sessionError.value = '변환된 발표 슬라이드가 없습니다. 발표 자료를 다시 업로드해 주세요.'
    return
  }
  isStarting.value = true
  sessionError.value = ''
  try {
    await refreshPermissionStates({ notify: false })
    if (videoPermissionState.value === 'denied' || audioPermissionState.value === 'denied') {
      showResumeConfirm.value = false
      deviceBlocked.value = true
      applyTrackState()
      return
    }
    if (!camOn.value || !micOn.value) {
      showResumeConfirm.value = true
      return
    }
    showResumeConfirm.value = false
    const captureStream = await connectCaptureSources()
    await presentation.startRecordingSession()
    hasStarted.value = true
    if (videoEl.value) void faceAnalysis.start(videoEl.value)
    processedTranscriptCount = 0
    recording.start()
    speech.reset()
    detectionAccumulator = new PresentationDetectionAccumulator()
    if (captureStream) {
      recorder.start(captureStream)
      pcmCapture = new PcmWavCapture({
        onChunk: ({ blob, sequence }) => presentation.analyzeAudioChunk({ blob, sequence }),
      })
      await pcmCapture.start(captureStream)
    }
    try {
      speech.start({ lang: 'ko-KR' })
    } catch (error) {
      sessionError.value = '이 브라우저는 실시간 음성 인식을 지원하지 않아요. 시선 및 자세(몸짓) 분석은 계속됩니다.'
    }
    markActiveRecording('presentation')
    tickId = window.setInterval(onTick, 1000)
  } catch (error) {
    const missingVideo = !videoTrack.value || videoTrack.value.readyState === 'ended'
    const missingAudio = !audioTrack.value || audioTrack.value.readyState === 'ended'
    const mediaErrorNames = new Set([
      'NotAllowedError',
      'PermissionDeniedError',
      'SecurityError',
      'NotFoundError',
      'DevicesNotFoundError',
      'NotReadableError',
      'TrackStartError',
    ])
    if (missingVideo || missingAudio || mediaErrorNames.has(error?.name)) {
      applyTrackState()
      deviceBlocked.value = true
      sessionError.value = ''
    } else {
      sessionError.value = error?.message || '발표 세션을 시작하지 못했습니다.'
    }
    hasStarted.value = false
    recording.reset()
  } finally {
    isStarting.value = false
  }
}
const startPresentation = () => {
  if (hasStarted.value || isStarting.value || deviceBlocked.value) return
  return transitionGate.runExclusive('start-presentation', performStartPresentation)
}

const performTogglePause = () => {
  if (recording.isPaused) {
    if (!camOn.value || !micOn.value) {
      showResumeConfirm.value = true
      return
    }
    resumeCapture()
  } else {
    recording.pause()
    recorder.pause()
    pcmCapture?.pause()
    speech.pause?.()
    faceAnalysis.pause()
  }
}
const togglePause = () => {
  if (!canPause.value) return
  return transitionGate.runExclusive('toggle-presentation-pause', performTogglePause)
}

const dismissResumeWarning = () => {
  showResumeConfirm.value = false
}

const stopCapture = () => {
  if (captureStopPromise) return captureStopPromise
  captureStopPromise = (async () => {
    if (tickId) window.clearInterval(tickId)
    tickId = null
    const trailingInterim = String(speech.interimText.value ?? '').trim()
    speech.stop()
    const [blob, pcmResult] = await Promise.all([
      recorder.stop(),
      pcmCapture?.stop() ?? Promise.resolve({ wavBlob: null, chunks: [] }),
    ])
    faceAnalysis.stop()
    stopMicLevel()
    recording.stop(blob)
    await captureBridge?.dispose?.()
    captureBridge = null
    stopStream()
    return {
      webmBlob: blob,
      wavBlob: pcmResult.wavBlob,
      chunks: pcmResult.chunks,
      trailingInterim,
    }
  })()
  return captureStopPromise
}

const teardown = () => {
  if (tickId) window.clearInterval(tickId)
  tickId = null
  void stopCapture()
}

const performEndRecording = async () => {
  if (!hasStarted.value || isFinishing.value || deviceBlocked.value) return
  isFinishing.value = true
  sessionError.value = ''
  const durationSeconds = recording.elapsedSeconds
  const metrics = { ...recording.stats, fillerCount: cumulativeFillerCount.value }
  try {
    const { webmBlob, wavBlob, trailingInterim } = await stopCapture()
    if (trailingInterim) {
      presentation.addTranscriptEvent({
        text: trailingInterim,
        slideIndex: slideIndex.value,
        atMs: Math.max(0, durationSeconds * 1_000 - 1),
      })
    }
    presentation.setRecordingArtifacts({
      webmBlob,
      wavBlob,
      nonverbal: detectionAccumulator?.finishNonverbal(durationSeconds * 1_000),
      durationMs: durationSeconds * 1_000,
      metrics,
    })
    await router.push({ path: '/presentation/analyzing', query: { phase: 'complete' } })
  } catch (error) {
    sessionError.value = error?.message || '녹화 결과를 저장하지 못했습니다. 다시 시도해 주세요.'
    isFinishing.value = false
  }
}
const endRecording = () => {
  if (!canFinish.value) return
  return transitionGate.runExclusive('finish-presentation', performEndRecording)
}

const confirmExit = async () => {
  if (isFinishing.value) return
  const exitLocation = { path: '/practice/folders', query: { type: 'presentation' } }
  isFinishing.value = true
  allowRouteLeave = true
  showExit.value = false
  try {
    await stopCapture()
  } finally {
    clearActiveRecording('presentation')
    presentation.reset()
    recording.reset()
    hasStarted.value = false
    deviceBlocked.value = false
    pendingExitLocation = null
    await router.push(exitLocation)
  }
}

const requestExit = async () => {
  if (!hasStarted.value || isFinishing.value) {
    allowRouteLeave = true
    await router.push({ path: '/practice/folders', query: { type: 'presentation' } })
    return
  }
  pendingExitLocation = '/practice/folders?type=presentation'
  showExit.value = true
}

const cancelExit = () => {
  pendingExitLocation = null
  showExit.value = false
}

const shouldWarnBeforeExit = () => (
  hasStarted.value && !isFinishing.value && !allowRouteLeave
)

const onBeforeUnload = (event) => {
  if (!shouldWarnBeforeExit()) return
  event.preventDefault()
  event.returnValue = true
}

onBeforeRouteLeave((to) => {
  if (!shouldWarnBeforeExit()) return true
  pendingExitLocation = to.fullPath
  showExit.value = true
  return false
})

// ── 진입할 때마다 단계별 튜토리얼(코치마크): 대상만 강조하고 나머지는 어둡게 ──
const showTutorial = ref(false)
const tutorialStep = ref(0)
const tutorialSteps = [
  { sel: '.record-stage-card', title: '발표 슬라이드', desc: '지금 발표 중인 슬라이드가 여기 크게 표시돼요.' },
  { sel: '.record-side-slides', title: '슬라이드 이동', desc: '오른쪽에서 이전·다음 슬라이드를 미리 보고, 아래 ‹ › 버튼으로 넘길 수 있어요.' },
  { sel: '.record-progress-bar', title: '진행 상태', desc: '위 상태바로 발표가 얼마나 진행됐는지(전반/후반)를 알 수 있어요.' },
  { sel: '.record-bottom-actions', title: '발표 시작 · 마치기', desc: "'발표 시작하기'를 누르면 녹화가 시작되고 시간이 표시돼요. 끝나면 '발표 마치기'를 누르세요." },
  { sel: '.record-rail', title: '실시간 발화 · 분석', desc: '말한 내용이 자막으로, 말하기 속도·추임새·시선·자세가 실시간 분석으로 왼쪽에 표시돼요.' },
]
const currentTut = computed(() => tutorialSteps[tutorialStep.value])
const isLastTut = computed(() => tutorialStep.value === tutorialSteps.length - 1)
const spotStyle = ref({ display: 'none' })
const tipStyle = ref({})
const tutorialStorageKey = computed(() => {
  const accountId = auth.user?.id ?? auth.user?.email ?? auth.user?.nickname ?? 'guest'
  return `aivo.presentation-record-tutorial-seen:${accountId}`
})
const hasSeenTutorial = () => readBooleanStorage(localStorage, tutorialStorageKey.value)
const rememberTutorialSeen = () => writeBooleanStorage(localStorage, tutorialStorageKey.value)
const openTutorial = () => {
  showTutorial.value = true
  tutorialStep.value = 0
  nextTick(measureTutorial)
}

const measureTutorial = () => {
  if (!showTutorial.value) return
  nextTick(() => {
    const step = tutorialSteps[tutorialStep.value]
    const el = step && document.querySelector(step.sel)
    if (!el) { spotStyle.value = { display: 'none' }; return }
    const rect = el.getBoundingClientRect()
    const pad = 10
    spotStyle.value = {
      top: `${rect.top - pad}px`,
      left: `${rect.left - pad}px`,
      width: `${rect.width + pad * 2}px`,
      height: `${rect.height + pad * 2}px`,
    }
    // 안내 카드는 대상의 좌/우에 배치(오른쪽 공간 있으면 오른쪽, 없으면 왼쪽),
    // 세로는 대상 중앙에 맞추되 화면 밖으로 안 나가게 clamp.
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tipW = 288
    const gap = 16
    const edge = 12
    const tipEl = document.querySelector('.rec-tut-tip')
    const tipH = tipEl ? tipEl.getBoundingClientRect().height : 180
    const placeRight = rect.right + gap + tipW <= vw - edge
    let left = placeRight ? rect.right + gap : rect.left - gap - tipW
    left = Math.min(Math.max(left, edge), vw - tipW - edge)
    let top = rect.top + rect.height / 2 - tipH / 2
    top = Math.min(Math.max(top, edge), vh - tipH - edge)
    tipStyle.value = { top: `${top}px`, left: `${left}px` }
  })
}
const nextTut = () => {
  if (isLastTut.value) closeTutorial()
  else { tutorialStep.value += 1; measureTutorial() }
}
const prevTut = () => { if (tutorialStep.value > 0) { tutorialStep.value -= 1; measureTutorial() } }
const closeTutorial = () => {
  rememberTutorialSeen()
  showTutorial.value = false
}

onMounted(() => {
  if (presentation.sessionStatus === 'completed') return
  if (!hasSeenTutorial()) {
    rememberTutorialSeen()
    openTutorial()
  }
  window.addEventListener('resize', measureTutorial)
})
onBeforeUnmount(() => window.removeEventListener('resize', measureTutorial))

const redirectCompletedSession = async () => {
  if (presentation.sessionStatus !== 'completed') return false
  allowRouteLeave = true
  clearActiveRecording('presentation')
  recording.reset()
  queueRecordingResetNotice('presentation', 'completed-session')
  await router.replace('/')
  return true
}

onMounted(async () => {
  if (await redirectCompletedSession()) return
  if (shouldResetRecordingAfterReload('presentation')) {
    allowRouteLeave = true
    clearActiveRecording('presentation')
    presentation.reset()
    recording.reset()
    queueRecordingResetNotice('presentation')
    await router.replace('/')
    return
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  recording.reset()
  captureStopPromise = null
  pcmCapture = null
  detectionAccumulator = null
  await presentation.ensureSlidesLoaded()
  if (!hasSlides.value) {
    sessionError.value = '변환된 발표 슬라이드가 없습니다. 발표 자료를 다시 업로드해 주세요.'
    return
  }
  try {
    await checkDevices(INTERVIEW_MEDIA_CONSTRAINTS)
    applyTrackState()
    if (videoEl.value) {
      videoEl.value.srcObject = stream.value ?? null
      void faceAnalysis.prepare()
    }
  } catch {
    /* placeholder stays if permission denied */
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  teardown()
})
</script>

<template>
  <main class="page-shell wide" :class="{ 'is-device-blocked': deviceBlocked }">
    <div class="record-shell">
      <aside class="record-rail">
        <div class="record-session-head">
          <button type="button" aria-label="연습 설정으로 돌아가기" @click="requestExit">←</button>
          <div>
            <strong>{{ presentation.title }} 연습</strong>
            <small>발표 · 슬라이드 {{ slides.length }}장</small>
          </div>
        </div>

        <div class="rail-camera-box" :style="{ '--camera-zoom': recording.cameraZoom }">
          <video v-show="camOn" ref="videoEl" autoplay muted playsinline></video>
          <span v-show="!camOn">촬영 화면</span>
        </div>

        <div class="record-media-controls" aria-label="카메라와 마이크 제어">
          <button
            type="button"
            class="record-media-toggle"
            :class="{ 'is-off': !camOn }"
            :disabled="mediaControlsLocked"
            :aria-pressed="camOn"
            :aria-label="`카메라 ${camOn ? '끄기' : '켜기'}`"
            @click="toggleCam"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2"></rect><path d="m16 10 5-3v10l-5-3z"></path></svg>
          </button>
          <button
            type="button"
            class="record-media-toggle"
            :class="{ 'is-off': !micOn }"
            :disabled="mediaControlsLocked"
            :aria-pressed="micOn"
            :aria-label="`마이크 ${micOn ? '끄기' : '켜기'}`"
            @click="toggleMic"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"></path></svg>
          </button>
        </div>

        <section class="rail-section rail-transcript-section">
          <div class="rail-section-head">
            <span>실시간 발화 내용</span>
            <span class="live-badge"><i></i>LIVE</span>
          </div>
          <div ref="transcriptBox" class="rail-transcript" aria-live="polite">
            <p v-if="!transcriptLines.length" style="color:rgba(255,255,255,.45);">
              발표를 시작하면 말한 내용이 최근 문장 위주로 표시됩니다.
            </p>
            <p
              v-for="line in transcriptLines"
              :key="line.id"
              class="transcript-line"
              :class="line.isCurrent ? 'transcript-line-current' : 'transcript-line-past'"
            >{{ line.text }}</p>
          </div>
        </section>

        <section class="rail-section rail-analysis-section">
          <div class="rail-section-head">
            <span>실시간 분석</span>
            <span class="coach-model-state" :class="`is-${modelStatus}`">{{ modelStatusLabel }}</span>
          </div>
          <div class="rail-stat-grid">
            <div class="rail-pace-cell" :class="paceLevel ? `is-${paceLevel}` : ''" :title="paceDetail">
              <strong data-live-pace-label>{{ paceLabel }}</strong><small>말하기 속도</small>
            </div>
            <div><strong data-live-filler-count>{{ cumulativeFillerCount }}</strong><small>추임새 회</small></div>
            <div><strong>{{ gazeLabel }}</strong><small>시선 이탈 회</small></div>
            <div><strong>{{ postureLabel }}</strong><small>기울어짐</small></div>
          </div>
        </section>
      </aside>

      <section class="record-main">
        <div class="record-main-top">
          <button type="button" class="record-tutorial-replay" @click="openTutorial">
            튜토리얼 다시 보기
          </button>
          <div class="record-progress-bar" role="progressbar" aria-label="발표 진행률">
            <span class="record-progress-fill" :style="{ width: progressPercent }"></span>
          </div>
        </div>

        <p v-if="sessionError" class="record-session-error" role="status">{{ sessionError }}</p>

        <div class="record-stage-wrap">
          <div class="record-stage-card">
            <div
              v-if="currentSlide.previewUrl"
              class="record-slide-viewport"
              :class="{ 'is-zoomable': canZoomSlide }"
              :style="{ '--slide-zoom': slideZoom }"
            >
              <img
                class="record-slide-image"
                :src="currentSlide.previewUrl"
                :alt="`${slideIndex + 1}번 발표 슬라이드`"
                @load="onSlideImageLoad"
              />
            </div>
            <div v-else class="record-slide-unavailable">
              <span class="record-question-tag">SPEECH COACH</span>
              <h3>슬라이드 이미지를 불러올 수 없어요.</h3>
              <p>발표 자료 업로드 화면에서 변환 상태를 확인해 주세요.</p>
            </div>
            <PresentationSlideZoomControl
              v-if="currentSlide.previewUrl && canZoomSlide"
              v-model="slideZoom"
            />
          </div>

          <aside class="record-side-slides" aria-label="슬라이드 미리보기와 이동">
            <div class="record-side-slide">
              <span class="record-side-label">‹‹ 이전</span>
              <div class="record-side-thumb">
                <img
                  v-if="prevSlideData?.previewUrl"
                  class="record-side-image"
                  :src="prevSlideData.previewUrl"
                  :alt="`${slideIndex}번 이전 슬라이드`"
                />
                <span v-else class="record-side-empty">처음 슬라이드예요</span>
              </div>
            </div>

            <div class="record-side-divider" aria-hidden="true"></div>

            <div class="record-side-slide">
              <span class="record-side-label">다음 ››</span>
              <div class="record-side-thumb">
                <img
                  v-if="nextSlideData?.previewUrl"
                  class="record-side-image"
                  :src="nextSlideData.previewUrl"
                  :alt="`${nextSlideIndex + 1}번 다음 슬라이드`"
                />
                <span v-else class="record-side-empty">마지막 슬라이드예요</span>
              </div>
            </div>

            <div class="record-nav-counter" role="group" aria-label="슬라이드 이동">
              <button
                type="button"
                aria-label="이전 슬라이드"
                disabled
              >‹</button>
              <span>{{ slideIndex + 1 }} / {{ slides.length }}</span>
              <button
                type="button"
                aria-label="다음 슬라이드"
                :disabled="!canAdvanceSlide"
                @click="nextSlide"
              >›</button>
            </div>
          </aside>
        </div>

        <div class="record-bottom-actions">
          <div class="record-timer-pill" :class="{ 'is-ready': !hasStarted, 'is-paused': recording.isPaused }">
            <button
              v-if="!hasStarted"
              type="button"
              class="record-start-btn"
              :disabled="isStarting || !hasSlides || deviceBlocked || transitionGate.isLocked.value"
              @click="startPresentation"
            >{{ isStarting ? '세션 준비 중…' : '발표 시작하기' }}</button>
            <template v-else>
              <span class="record-timer-clock">{{ recording.elapsedLabel }}</span>
              <button type="button" class="record-timer-pause" :disabled="!canPause" :aria-label="recording.isPaused ? '녹화 재개' : '일시정지'" :class="{ 'is-paused': recording.isPaused }" @click="togglePause">
                {{ recording.isPaused ? '▶' : '❚❚' }}
              </button>
              <span class="record-timer-status">{{ statusLabel }}</span>
            </template>
          </div>
          <button
            type="button"
            class="record-end-btn"
            :disabled="!canFinish"
            :aria-disabled="!canFinish"
            :aria-busy="isFinishing"
            @click="endRecording"
          >
            <span v-if="isFinishing" class="record-end-spinner" aria-hidden="true"></span>
            <span>{{ isFinishing ? '마치는 중…' : '발표 마치기' }}</span>
          </button>
        </div>
      </section>
    </div>
  </main>

  <div v-if="showExit" class="record-exit-modal" role="dialog" aria-modal="true" aria-labelledby="recordExitTitle">
    <div class="record-exit-dialog">
      <h2 id="recordExitTitle">발표를 종료하고 나갈까요?</h2>
      <p>지금 나가면 녹화·발화·시선·자세 등 모든 발표 기록이 저장되지 않으며 리포트도 생성되지 않습니다.</p>
      <div class="record-exit-actions">
        <button type="button" @click="cancelExit">계속 발표하기</button>
        <button id="recordExitConfirmBtn" type="button" @click="confirmExit">기록 삭제하고 나가기</button>
      </div>
    </div>
  </div>

  <RequiredMediaPermissionModal
    v-if="deviceBlocked"
    :busy="deviceRetrying || isFinishing"
    @confirm="requestDevicesAfterLoss"
  />

  <div v-if="showResumeConfirm" class="record-exit-modal record-resume-modal" role="dialog" aria-modal="true" aria-labelledby="recordResumeTitle">
    <div class="record-exit-dialog">
      <h2 id="recordResumeTitle">{{ resumeDeviceWarning.title }}</h2>
      <p>{{ resumeDeviceWarning.message }}</p>
      <div class="record-exit-actions">
        <button data-testid="dismiss-presentation-resume-warning" type="button" @click="dismissResumeWarning">확인</button>
      </div>
    </div>
  </div>

  <!-- 처음 진입 시 단계별 튜토리얼 -->
  <div v-if="showTutorial" class="rec-tut" role="dialog" aria-modal="true" aria-label="발표 녹화 사용법 안내">
    <div class="rec-tut-spot" :style="spotStyle" aria-hidden="true"></div>
    <div class="rec-tut-tip" :style="tipStyle">
      <span class="rec-tut-step">{{ tutorialStep + 1 }} / {{ tutorialSteps.length }}</span>
      <strong class="rec-tut-title">{{ currentTut.title }}</strong>
      <p class="rec-tut-desc">{{ currentTut.desc }}</p>
      <div class="rec-tut-actions">
        <button type="button" class="rec-tut-skip" @click="closeTutorial">건너뛰기</button>
        <div class="rec-tut-nav">
          <button v-if="tutorialStep > 0" type="button" class="rec-tut-prev" @click="prevTut">이전</button>
          <button type="button" class="rec-tut-next" @click="nextTut">{{ isLastTut ? '시작하기' : '다음' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-shell.is-device-blocked .record-shell {
  filter: brightness(.35);
  pointer-events: none;
  user-select: none;
}
.record-resume-modal {
  z-index: 1400;
}
/* 단계별 튜토리얼(코치마크) — 면접 녹화와 동일한 형식 */
.rec-tut {
  position: fixed;
  inset: 0;
  z-index: 1200;
}
.rec-tut-spot {
  position: fixed;
  border-radius: 14px;
  box-shadow: 0 0 0 9999px rgba(12, 15, 34, .72);
  outline: 2px solid rgba(124, 138, 246, .9);
  pointer-events: none;
  transition: top .22s ease, left .22s ease, width .22s ease, height .22s ease;
}
.rec-tut-tip {
  position: fixed;
  width: 288px;
  max-width: calc(100vw - 32px);
  padding: 13px 15px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(16, 20, 46, .26);
}
.rec-tut-step {
  display: inline-block;
  margin-bottom: 4px;
  color: #6b73dc;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .02em;
}
.rec-tut-title {
  display: block;
  color: #1b1f45;
  font-size: 14px;
  font-weight: 850;
}
.rec-tut-desc {
  margin: 5px 0 0;
  color: #4a5270;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}
.rec-tut-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 13px;
}
.rec-tut-nav { display: flex; gap: 7px; }
.rec-tut-skip {
  border: 0;
  background: transparent;
  color: #8a92a8;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.rec-tut-prev,
.rec-tut-next {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.rec-tut-prev {
  border: 1px solid #d5dcea;
  background: #fff;
  color: #3a445f;
}
.rec-tut-next {
  border: 0;
  background: #5b63d6;
  color: #fff;
}
.rec-tut-next:hover { background: #4a52c4; }

@media (prefers-reduced-motion: reduce) {
  .rec-tut-spot { transition: none; }
}
</style>
