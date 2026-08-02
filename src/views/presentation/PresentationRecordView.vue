<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useFaceAnalysis } from '../../composables/useFaceAnalysis.js'
import { useMediaDevices } from '../../composables/useMediaDevices.js'
import { useMicLevel } from '../../composables/useMicLevel.js'
import {
  calculateWpm,
  countFillerWords,
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
import { readBooleanStorage, writeBooleanStorage } from '../../utils/storage.js'

const router = useRouter()
const auth = useAuthStore()
const presentation = usePresentationStore()
const recording = useRecordingStore()
const { stream, checkDevices, stopStream } = useMediaDevices()
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

let tickId = null
let processedTranscriptCount = 0
let captureStopPromise = null
let pcmCapture = null
let detectionAccumulator = null

const transcriptLines = computed(() => {
  const lines = speech.finalSegments.value.length
    ? speech.finalSegments.value
    : recording.transcriptSegments
  return lines.slice(-4)
})

const wpmLabel = computed(() => recording.stats.wpm ?? '--')
const gazeLabel = computed(() => faceAnalysis.gazeDeviationCount.value)
const postureLabel = computed(() => (
  faceAnalysis.tiltScore.value == null ? '--' : `${faceAnalysis.tiltScore.value}%`
))
const micPercent = computed(() => Math.round(micLevel.value * 100))
const micStateLabel = computed(() => {
  if (!micOn.value) return '꺼짐'
  if (micLevel.value < 0.08) return '작음'
  if (micLevel.value > 0.7) return '큼'
  return '안정'
})
const audioAnalysisState = computed(() => presentation.audioAnalysisState)
const latestAudioAnalysis = computed(() => presentation.audioAnalysisResults.at(-1) ?? null)
const audioAnalysisErrorMeta = computed(() => {
  const error = audioAnalysisState.value.error
  if (!error) return ''
  return [
    error.status ? `HTTP ${error.status}` : '',
    error.code ? `code ${error.code}` : '',
  ].filter(Boolean).join(' · ')
})
const statusLabel = computed(() => (recording.isPaused ? '일시정지' : '녹화 중'))
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
  stream.value?.getVideoTracks().forEach((track) => { track.enabled = camOn.value })
  stream.value?.getAudioTracks().forEach((track) => { track.enabled = micOn.value })
  if (stream.value && micOn.value) startMicLevel(stream.value)
  else stopMicLevel()
}
const toggleCam = () => { camOn.value = !camOn.value; applyTrackState() }
const toggleMic = () => { micOn.value = !micOn.value; applyTrackState() }

const moveSlide = (nextIndex) => {
  if (!slides.value.length || nextIndex === slideIndex.value) return
  const previousIndex = slideIndex.value
  slideIndex.value = nextIndex
  if (hasStarted.value) {
    void presentation.recordSlideTransition(previousIndex, nextIndex, recording.elapsedSeconds)
  }
}
const prevSlide = () => { if (slideIndex.value > 0) moveSlide(slideIndex.value - 1) }
const nextSlide = () => { if (slideIndex.value < slides.value.length - 1) moveSlide(slideIndex.value + 1) }

const onTick = () => {
  if (!recording.isRecording) return
  recording.tick()
  const transcript = speech.transcript.value
  recording.setStats({
    wpm: calculateWpm(transcript, recording.elapsedSeconds),
    fillerCount: countFillerWords(transcript),
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

const startPresentation = async () => {
  if (hasStarted.value || isStarting.value) return
  if (!hasSlides.value) {
    sessionError.value = '변환된 발표 슬라이드가 없습니다. 발표 자료를 다시 업로드해 주세요.'
    return
  }
  isStarting.value = true
  sessionError.value = ''
  try {
    await presentation.startRecordingSession()
    hasStarted.value = true
    processedTranscriptCount = 0
    recording.start()
    speech.reset()
    detectionAccumulator = new PresentationDetectionAccumulator()
    if (stream.value) {
      recorder.start(stream.value)
      pcmCapture = new PcmWavCapture({
        onChunk: ({ blob, sequence }) => presentation.analyzeAudioChunk({ blob, sequence }),
      })
      await pcmCapture.start(stream.value)
    }
    try {
      speech.start({ lang: 'ko-KR' })
    } catch (error) {
      sessionError.value = '이 브라우저는 실시간 음성 인식을 지원하지 않아요. 시선 및 자세(몸짓) 분석은 계속됩니다.'
    }
    tickId = window.setInterval(onTick, 1000)
  } catch (error) {
    sessionError.value = error?.message || '발표 세션을 시작하지 못했습니다.'
    hasStarted.value = false
    recording.reset()
  } finally {
    isStarting.value = false
  }
}

const togglePause = () => {
  if (!hasStarted.value) return
  if (recording.isPaused) {
    recording.resume()
    recorder.resume()
    pcmCapture?.resume()
    speech.start?.({ lang: 'ko-KR' })
  } else {
    recording.pause()
    recorder.pause()
    pcmCapture?.pause()
    speech.stop()
  }
}

const stopCapture = () => {
  if (captureStopPromise) return captureStopPromise
  captureStopPromise = (async () => {
    if (tickId) window.clearInterval(tickId)
    tickId = null
    speech.stop()
    const [blob, pcmResult] = await Promise.all([
      recorder.stop(),
      pcmCapture?.stop() ?? Promise.resolve({ wavBlob: null, chunks: [] }),
    ])
    faceAnalysis.stop()
    stopMicLevel()
    recording.stop(blob)
    stopStream()
    return { webmBlob: blob, wavBlob: pcmResult.wavBlob, chunks: pcmResult.chunks }
  })()
  return captureStopPromise
}

const teardown = () => {
  if (tickId) window.clearInterval(tickId)
  tickId = null
  void stopCapture()
}

const endRecording = async () => {
  if (!hasStarted.value || isFinishing.value) return
  isFinishing.value = true
  sessionError.value = ''
  const durationSeconds = recording.elapsedSeconds
  const metrics = { ...recording.stats }
  try {
    const { webmBlob, wavBlob } = await stopCapture()
    presentation.setRecordingArtifacts({
      webmBlob,
      wavBlob,
      detects: detectionAccumulator?.finish(durationSeconds * 1_000) ?? [],
      durationMs: durationSeconds * 1_000,
      metrics,
    })
    await router.push('/presentation/artifacts')
  } catch (error) {
    sessionError.value = error?.message || '녹화 결과를 저장하지 못했습니다. 다시 시도해 주세요.'
    isFinishing.value = false
  }
}

const confirmExit = async () => {
  await stopCapture()
  await router.push('/presentation/setup')
}

// ── 진입할 때마다 단계별 튜토리얼(코치마크): 대상만 강조하고 나머지는 어둡게 ──
const showTutorial = ref(false)
const tutorialStep = ref(0)
const tutorialSteps = [
  { sel: '.record-stage-card', title: '발표 슬라이드', desc: '지금 발표 중인 슬라이드가 여기 크게 표시돼요.' },
  { sel: '.record-side-slides', title: '슬라이드 이동', desc: '오른쪽에서 이전·다음 슬라이드를 미리 보고, 아래 ‹ › 버튼으로 넘길 수 있어요.' },
  { sel: '.record-progress-bar', title: '진행 상태', desc: '위 상태바로 발표가 얼마나 진행됐는지(전반/후반)를 알 수 있어요.' },
  { sel: '.record-bottom-actions', title: '발표 시작 · 마치기', desc: "'발표 시작하기'를 누르면 녹화가 시작되고 시간이 표시돼요. 끝나면 '발표 마치기'를 누르세요." },
  { sel: '.record-rail', title: '실시간 발화 · 분석', desc: '말한 내용이 자막으로, 말하기 속도·필러워드·시선·자세가 실시간 분석으로 왼쪽에 표시돼요.' },
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
  if (!hasSeenTutorial()) {
    rememberTutorialSeen()
    openTutorial()
  }
  window.addEventListener('resize', measureTutorial)
})
onBeforeUnmount(() => window.removeEventListener('resize', measureTutorial))

onMounted(async () => {
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
    await checkDevices({ video: true, audio: true })
    applyTrackState()
    if (videoEl.value) {
      videoEl.value.srcObject = stream.value ?? null
      void faceAnalysis.start(videoEl.value)
    }
  } catch {
    /* placeholder stays if permission denied */
  }
})

onBeforeUnmount(teardown)
</script>

<template>
  <main class="page-shell wide">
    <div class="record-shell">
      <aside class="record-rail">
        <div class="record-session-head">
          <button type="button" aria-label="연습 설정으로 돌아가기" @click="showExit = true">←</button>
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
          <div class="rail-transcript" aria-live="polite">
            <p v-if="!transcriptLines.length" style="color:rgba(255,255,255,.45);">
              발표를 시작하면 말한 내용이 최근 문장 위주로 표시됩니다.
            </p>
            <p
              v-for="(line, i) in transcriptLines"
              :key="i"
              class="transcript-line"
              :class="i === transcriptLines.length - 1 ? 'transcript-line-current' : 'transcript-line-past'"
            >{{ line }}</p>
          </div>
        </section>

        <section class="rail-section rail-analysis-section">
          <div class="rail-section-head">
            <span>실시간 분석</span>
            <span class="coach-model-state" :class="`is-${modelStatus}`">{{ modelStatusLabel }}</span>
          </div>
          <div class="rail-stat-grid">
            <div><strong>{{ wpmLabel }}</strong><small>말하기속도 WPM</small></div>
            <div><strong>{{ recording.stats.fillerCount }}</strong><small>필러워드 회</small></div>
            <div><strong>{{ gazeLabel }}</strong><small>시선 이탈 회</small></div>
            <div><strong>{{ postureLabel }}</strong><small>기울어짐</small></div>
          </div>
          <p class="coach-audio-state">
            음성 크기 <strong>{{ recording.stats.voice }}</strong>
            <span>입력 {{ micPercent }}%</span>
          </p>
          <div
            data-audio-analysis-state
            class="coach-audio-analysis"
            :class="`is-${audioAnalysisState.status}`"
            aria-live="polite"
          >
            <template v-if="audioAnalysisState.status === 'idle'">
              <strong>첫 10초 분석 대기 중</strong>
              <span>발표를 시작하면 WAV를 10초마다 서버로 전송합니다.</span>
            </template>
            <template v-else-if="audioAnalysisState.status === 'sending'">
              <strong>10초 분석 #{{ audioAnalysisState.sequence }} 전송 중</strong>
              <span>서버 응답을 기다리고 있습니다.</span>
            </template>
            <template v-else-if="audioAnalysisState.status === 'error'">
              <strong>10초 분석 #{{ audioAnalysisState.sequence }} 실패</strong>
              <span>{{ audioAnalysisState.error?.message }}</span>
              <small v-if="audioAnalysisErrorMeta">{{ audioAnalysisErrorMeta }}</small>
            </template>
            <template v-else>
              <strong>10초 분석 #{{ audioAnalysisState.sequence }} 수신 완료</strong>
              <span>{{ latestAudioAnalysis?.feedback || '서버 분석을 받았습니다.' }}</span>
              <small>
                필러 {{ latestAudioAnalysis?.fillerCount ?? 0 }}회
                · 침묵 {{ latestAudioAnalysis?.silenceDetected ? '감지' : '없음' }}
                <template v-if="latestAudioAnalysis?.averageWpm != null">
                  · 속도 {{ latestAudioAnalysis.averageWpm }}
                </template>
              </small>
            </template>
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
            <img
              v-if="currentSlide.previewUrl"
              class="record-slide-image"
              :src="currentSlide.previewUrl"
              :alt="`${slideIndex + 1}번 발표 슬라이드`"
            />
            <div v-else class="record-slide-unavailable">
              <span class="record-question-tag">SPEECH COACH</span>
              <h3>슬라이드 이미지를 불러올 수 없어요.</h3>
              <p>발표 자료 업로드 화면에서 변환 상태를 확인해 주세요.</p>
            </div>
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
                :disabled="!hasSlides || slideIndex === 0"
                @click="prevSlide"
              >‹</button>
              <span>{{ slideIndex + 1 }} / {{ slides.length }}</span>
              <button
                type="button"
                aria-label="다음 슬라이드"
                :disabled="!hasSlides || slideIndex === slides.length - 1"
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
              :disabled="isStarting || !hasSlides"
              @click="startPresentation"
            >{{ isStarting ? '세션 준비 중…' : '발표 시작하기' }}</button>
            <template v-else>
              <span class="record-timer-clock">{{ recording.elapsedLabel }}</span>
              <button type="button" class="record-timer-pause" :aria-label="recording.isPaused ? '녹화 재개' : '일시정지'" :class="{ 'is-paused': recording.isPaused }" @click="togglePause">
                {{ recording.isPaused ? '▶' : '❚❚' }}
              </button>
              <span class="record-timer-status">{{ statusLabel }}</span>
            </template>
          </div>
          <button
            type="button"
            class="record-end-btn"
            :disabled="!hasStarted || isFinishing"
            :aria-disabled="!hasStarted || isFinishing"
            @click="endRecording"
          >{{ isFinishing ? '저장 중…' : '발표 마치기' }}</button>
        </div>
      </section>
    </div>
  </main>

  <div v-if="showExit" class="record-exit-modal" role="dialog" aria-modal="true" aria-labelledby="recordExitTitle">
    <div class="record-exit-dialog">
      <h2 id="recordExitTitle">녹화를 종료하고 이동할까요?</h2>
      <p>연습 설정 페이지로 되돌아갑니다. 괜찮으신가요?</p>
      <div class="record-exit-actions">
        <button type="button" @click="showExit = false">취소</button>
        <button type="button" @click="confirmExit">이동하기</button>
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

.coach-audio-analysis {
  display: grid;
  gap: 4px;
  margin-top: 9px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 10px;
  background: rgba(255, 255, 255, .06);
  color: rgba(255, 255, 255, .72);
  font-size: 11px;
  line-height: 1.45;
}
.coach-audio-analysis strong {
  color: #fff;
  font-size: 12px;
}
.coach-audio-analysis span,
.coach-audio-analysis small {
  overflow-wrap: anywhere;
}
.coach-audio-analysis.is-sending {
  border-color: rgba(129, 140, 248, .55);
}
.coach-audio-analysis.is-success {
  border-color: rgba(52, 211, 153, .55);
}
.coach-audio-analysis.is-error {
  border-color: rgba(248, 113, 113, .65);
  background: rgba(127, 29, 29, .28);
}

@media (prefers-reduced-motion: reduce) {
  .rec-tut-spot { transition: none; }
}
</style>
