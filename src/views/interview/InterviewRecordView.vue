<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getStreamAspectRatio, useMediaDevices } from '../../composables/useMediaDevices.js'
import { useRecorder } from '../../composables/useRecorder.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useInterviewStore } from '../../stores/interviewStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import { readBooleanStorage, writeBooleanStorage } from '../../utils/storage.js'

const router = useRouter()
const auth = useAuthStore()
const interview = useInterviewStore()
const recording = useRecordingStore()
const { stream, checkDevices, stopStream } = useMediaDevices()
const recorder = useRecorder()

// 앞 단계에서 고른 면접관 한 명.
const PERSONAS = {
  practical: { name: '실무 중심형', desc: '논리적인 직무 질문', img: '/interviewers/1.png', emoji: '🧑‍💼' },
  growth: { name: '성장 코치형', desc: '친절한 후속 질문', img: '/interviewers/2.png', emoji: '👩‍🏫' },
  pressure: { name: '압박 검증형', desc: '꼬리 질문 중심', img: '/interviewers/3.png', emoji: '🧐' },
}
const interviewer = computed(() => PERSONAS[interview.interviewerStyle] ?? PERSONAS.practical)
const imgFailed = ref(false)

const videoEl = ref(null)
const cameraAspectRatio = ref(16 / 9)
const qlistEl = ref(null)
const camOn = ref(true)
const micOn = ref(true)
const qIndex = ref(0)

// 새 방식: 면접 시작 → 5초 카운트다운 → TTS로 질문 읽고 쭉 녹화. 질문마다 1분,
// 사용자는 '다음 질문'만 누르거나 1분이 지나면 자동으로 넘어간다(넘어갈 때마다 TTS).
const started = ref(false)
const isFinishing = ref(false)
const recordingError = ref('')

const PER_QUESTION_LIMIT = 60 // 질문당 1분
const perQuestionRemaining = ref(PER_QUESTION_LIMIT)

// 면접 시작 전 5초 카운트다운.
const countdown = ref(0)
let countdownId = null

// 답변 구간(전체 발화 → 백엔드 전달용). 질문이 바뀔 때마다 구간을 닫고 다시 연다.
const answerSegments = ref([])
let currentSegmentStart = 0

// 좌측 하단 실시간 자막 · 분석 (데모).
const DEMO_TRANSCRIPT = [
  '네, 안녕하세요. 지원자 서가은입니다.',
  '대학에서 컴퓨터공학을 전공하며 서버 개발에 관심을 가졌습니다.',
  '팀 프로젝트에서 API 설계와 성능 개선을 맡았고,',
  '응답 속도를 40% 개선한 경험이 가장 기억에 남습니다.',
]
const transcript = ref([])
const wpm = ref(0)
const filler = ref(0)
let transcriptIdx = 0
let answerTicks = 0

const answered = ref(new Set()) // 지나간(완료된) 질문 index

const questions = computed(() =>
  interview.questions.length ? interview.questions : [{ text: '자기소개를 해주세요.', cat: '공통' }],
)
const currentQuestion = computed(() => questions.value[qIndex.value])
const isLast = computed(() => qIndex.value === questions.value.length - 1)
const jobLabel = computed(() => interview.position || interview.field || '직무 미정')
const typeLabel = computed(() => (interview.keywords.length ? interview.keywords.slice(0, 3).join(' · ') : '인성 및 기술'))
const progressWidth = computed(() => `${((qIndex.value + 1) / questions.value.length) * 100}%`)
const perQuestionLabel = computed(() => {
  const s = Math.max(0, perQuestionRemaining.value)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

// 좌측 질문 리스트: 현재 질문이 목록 최상단에 오도록 자동 스크롤.
const railQuestions = computed(() =>
  questions.value.map((q, i) => ({ ...q, i, answered: answered.value.has(i), current: i === qIndex.value })),
)
const scrollCurrentToTop = () => {
  nextTick(() => {
    const container = qlistEl.value
    const el = container?.querySelector('.ivr-qitem.current')
    if (container && el) {
      container.scrollTo({
        top: container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top,
        behavior: 'smooth',
      })
    }
  })
}

const resetLive = () => {
  transcript.value = []
  transcriptIdx = 0
  answerTicks = 0
  wpm.value = 0
  filler.value = 0
}

// ── TTS: 질문을 음성으로 읽어준다(브라우저 SpeechSynthesis). ──
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const isSpeaking = ref(false) // 질문 TTS 재생 중 (읽는 동안에도 녹음 계속 안내용)
const speakQuestion = (text) => {
  if (!ttsSupported || !text) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 1
    utterance.onstart = () => { isSpeaking.value = true }
    utterance.onend = () => { isSpeaking.value = false }
    utterance.onerror = () => { isSpeaking.value = false }
    window.speechSynthesis.speak(utterance)
  } catch {
    isSpeaking.value = false
  }
}
const stopTts = () => {
  if (ttsSupported) { try { window.speechSynthesis.cancel() } catch {} }
  isSpeaking.value = false
}
// 오른쪽 패널의 단일 주요 버튼 라벨: 시작 전 '면접 시작' → 시작 후 '다음 질문'
// → 마지막 질문에선 '종료하기'.
const primaryLabel = computed(() => {
  if (isFinishing.value) return '저장 중…'
  if (!started.value) return countdown.value > 0 ? String(countdown.value) : '면접 시작'
  return isLast.value ? '종료하기' : '다음 질문'
})

const markAnswered = (i) => { answered.value = new Set(answered.value).add(i) }

// 현재 질문 구간을 닫아 기록에 추가.
const closeSegment = () => {
  const question = currentQuestion.value
  answerSegments.value = [
    ...answerSegments.value,
    {
      questionId: question.id ?? null,
      questionIndex: qIndex.value,
      question: question.text,
      category: question.cat ?? question.category ?? '',
      startedAtSeconds: currentSegmentStart,
      endedAtSeconds: recording.elapsedSeconds,
      durationSeconds: Math.max(0, recording.elapsedSeconds - currentSegmentStart),
    },
  ]
  markAnswered(qIndex.value)
}
// 새 질문 구간을 연다(타이머·자막 리셋 + TTS + 스크롤).
const openSegment = () => {
  currentSegmentStart = recording.elapsedSeconds
  perQuestionRemaining.value = PER_QUESTION_LIMIT
  resetLive()
  speakQuestion(currentQuestion.value.text)
  scrollCurrentToTop()
}

const clearCountdown = () => {
  if (countdownId) { window.clearInterval(countdownId); countdownId = null }
  countdown.value = 0
}

// ── 녹화/타이머 ──
let tickId = null
let captureStopPromise = null

const syncCameraAspectRatio = () => {
  const videoRatio = videoEl.value?.videoWidth > 0 && videoEl.value?.videoHeight > 0
    ? videoEl.value.videoWidth / videoEl.value.videoHeight
    : getStreamAspectRatio(stream.value)
  cameraAspectRatio.value = Number.isFinite(videoRatio) && videoRatio >= 1 && videoRatio <= 2.4
    ? videoRatio
    : 16 / 9
}

watch(stream, (value) => {
  if (videoEl.value) videoEl.value.srcObject = value ?? null
  syncCameraAspectRatio()
})
watch(qIndex, scrollCurrentToTop)

const applyTrackState = () => {
  stream.value?.getVideoTracks().forEach((track) => { track.enabled = camOn.value })
  stream.value?.getAudioTracks().forEach((track) => { track.enabled = micOn.value })
}
const toggleCam = () => { camOn.value = !camOn.value; applyTrackState() }
const toggleMic = () => { micOn.value = !micOn.value; applyTrackState() }

const stopCapture = () => {
  if (captureStopPromise) return captureStopPromise
  if (tickId) window.clearInterval(tickId)
  tickId = null
  captureStopPromise = (async () => {
    const blob = await recorder.stop()
    recording.stop(blob)
    stopStream()
    return blob
  })()
  return captureStopPromise
}

const teardown = () => {
  clearCountdown()
  stopTts()
  void stopCapture()
}

// 면접 시작: 5초 카운트다운 후 실제 시작.
const beginStartCountdown = () => {
  clearCountdown()
  countdown.value = 5
  countdownId = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearCountdown()
      actuallyStart()
    }
  }, 1000)
}
const actuallyStart = () => {
  started.value = true
  recording.reset()
  recording.start()
  if (stream.value) {
    try { recorder.start(stream.value) } catch { /* codec 문제여도 UI는 계속 */ }
  }
  currentSegmentStart = 0
  perQuestionRemaining.value = PER_QUESTION_LIMIT
  resetLive()
  speakQuestion(currentQuestion.value.text)
  scrollCurrentToTop()
}

// 오른쪽 패널 단일 버튼: 시작 전엔 면접 시작(5초 카운트다운), 시작 후엔 다음 질문
// (마지막 질문이면 advanceQuestion 내부에서 종료 처리).
const onPrimaryButton = () => {
  if (countdown.value > 0 || isFinishing.value) return
  if (!started.value) beginStartCountdown()
  else void advanceQuestion()
}

const advanceQuestion = async () => {
  if (!started.value || isFinishing.value || countdown.value > 0) return
  closeSegment()
  if (!isLast.value) {
    qIndex.value += 1
    openSegment()
  } else {
    await endInterview()
  }
}

const endInterview = async () => {
  if (isFinishing.value) return
  isFinishing.value = true
  recordingError.value = ''
  clearCountdown()
  stopTts()
  if (started.value) closeSegment() // 마지막 구간 저장
  try {
    const durationSeconds = recording.elapsedSeconds
    const blob = await stopCapture()
    await interview.finishRecording({
      blob,
      durationSeconds,
      answers: answerSegments.value,
    })
    await router.push('/interview/analyzing')
  } catch (error) {
    recordingError.value = error?.message || interview.saveError || '녹화 파일 저장에 실패했습니다. 다시 시도해주세요.'
    isFinishing.value = false
  }
}

const onTick = () => {
  if (!started.value) return
  recording.tick()
  // 실시간 자막·분석 (데모).
  answerTicks += 1
  wpm.value = 112 + Math.floor(Math.random() * 26)
  if (answerTicks % 3 === 1 && transcriptIdx < DEMO_TRANSCRIPT.length) {
    transcript.value = [...transcript.value, DEMO_TRANSCRIPT[transcriptIdx]].slice(-3)
    transcriptIdx += 1
  }
  if (answerTicks % 4 === 0 && Math.random() > 0.6) filler.value += 1
  // 질문당 1분 카운트다운 → 0이면 자동으로 다음 질문.
  perQuestionRemaining.value -= 1
  if (perQuestionRemaining.value <= 0) void advanceQuestion()
}

// ── 진입할 때마다 단계별 튜토리얼(코치마크): 대상만 강조하고 나머지는 어둡게 ──
const showTutorial = ref(false)
const tutorialStep = ref(0)
const tutorialSteps = [
  { sel: '.ivr-qlist', title: '질문 목록', desc: '이번 면접의 전체 질문 목록이에요. 진행 중인 질문이 항상 맨 위로 올라옵니다.' },
  { sel: '.ivr-next-side', title: '면접 시작 → 다음 질문', desc: "'면접 시작'을 누르면 5초 뒤 첫 질문이 음성으로 나오고 녹화가 시작돼요. 이후 '다음 질문', 마지막 질문에선 '종료하기'로 바뀝니다." },
  { sel: '.ivr-video-area', title: '질문 · 남은 시간', desc: '질문마다 1분이 주어져요. 남은 시간은 화면 오른쪽 위에 표시되고, 1분이 지나면 자동으로 다음 질문으로 넘어갑니다.' },
  { sel: '.ivr-rail-live', title: '실시간 자막 · 분석', desc: '답변하는 동안 말한 내용이 자막으로, 말하기 속도(WPM)와 필러워드가 실시간 분석으로 표시돼요.' },
]
const currentTut = computed(() => tutorialSteps[tutorialStep.value])
const isLastTut = computed(() => tutorialStep.value === tutorialSteps.length - 1)
const spotStyle = ref({ display: 'none' })
const tipStyle = ref({})
const tutorialStorageKey = computed(() => {
  const accountId = auth.user?.id ?? auth.user?.email ?? auth.user?.nickname ?? 'guest'
  return `aivo.interview-record-tutorial-seen:${accountId}`
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
    // 안내 카드는 대상의 '좌우'에 배치(상하 X). 오른쪽에 공간이 있으면 오른쪽,
    // 아니면 왼쪽. 세로는 대상 중앙에 맞추되 화면 밖으로 나가지 않게 clamp.
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tipW = 288
    const gap = 16
    const edge = 12
    const tipEl = document.querySelector('.ivr-tut-tip')
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

onMounted(async () => {
  recording.reset()
  tickId = window.setInterval(onTick, 1000)
  scrollCurrentToTop()
  // 이 화면에 들어올 때마다(전 단계 → 녹화) 튜토리얼을 처음부터 보여준다.
  if (!hasSeenTutorial()) {
    rememberTutorialSeen()
    openTutorial()
  }
  window.addEventListener('resize', measureTutorial)
  try {
    await checkDevices({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
      audio: true,
    })
    applyTrackState()
    syncCameraAspectRatio()
  } catch {
    /* 권한 거부 시 미리보기 자리표시 유지 */
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureTutorial)
  teardown()
})
</script>

<template>
  <main class="page-shell wide ivr-shell-wrap">
    <div class="ivr-shell">
      <aside class="ivr-rail">
        <div class="ivr-rail-head">면접 질문</div>
        <ul class="ivr-qlist" ref="qlistEl">
          <li
            v-for="q in railQuestions"
            :key="q.i"
            class="ivr-qitem"
            :class="{ current: q.current, done: q.answered }"
          >
            <span class="ivr-qitem-no">Q{{ q.i + 1 }}</span>
            <div class="ivr-qitem-body">
              <small>{{ q.cat }}</small>
              <strong>{{ q.text }}</strong>
            </div>
            <span v-if="q.answered" class="ivr-qitem-check" aria-hidden="true">✓</span>
          </li>
        </ul>
      </aside>

      <section class="ivr-stage">
        <button type="button" class="ivr-tutorial-replay" @click="openTutorial">
          튜토리얼 다시 보기
        </button>
        <header class="ivr-question">
          <span class="ivr-q-tag">Q{{ qIndex + 1 }} · {{ interviewer.name }}</span>
          <h1 class="ivr-q-text">{{ currentQuestion.text }}</h1>
          <div class="ivr-q-dots">
            <span v-for="(q, i) in questions" :key="i" :class="{ active: i <= qIndex }"></span>
          </div>
        </header>

        <div class="ivr-video-area">
          <div
            class="ivr-video"
            :class="{ 'is-counting': countdown > 0 }"
            :style="{ '--ivr-camera-ratio': cameraAspectRatio }"
          >
            <video v-show="camOn" ref="videoEl" autoplay muted playsinline @loadedmetadata="syncCameraAspectRatio"></video>
            <span v-show="!camOn" class="ivr-video-ph">카메라 미리보기</span>
            <div v-if="started" class="ivr-rec-badge"><i></i><span>{{ recording.elapsedLabel }}</span></div>

            <!-- 면접 시작 → 5초 카운트다운 (크게, 카메라 중앙) -->
            <div v-if="countdown > 0" class="ivr-countdown" aria-live="assertive">
              <span class="ivr-countdown-num" :key="countdown">{{ countdown }}</span>
              <span class="ivr-countdown-label">곧 첫 질문이 나옵니다</span>
            </div>

            <!-- 질문당 1분 카운트다운 (카메라 우상단) -->
            <div v-if="started" class="ivr-qtimer" :class="{ 'is-urgent': perQuestionRemaining <= 10 }" aria-live="polite">
              <strong>{{ perQuestionLabel }}</strong>
              <small>자동 넘김까지</small>
            </div>

            <!-- 질문을 읽어주는 동안에도 녹음이 계속됨을 알림 -->
            <div v-if="started && isSpeaking" class="ivr-speaking-notice" role="status">
              <i aria-hidden="true"></i><span>질문을 읽는 중에도 녹음은 계속돼요</span>
            </div>
          </div>
        </div>

        <div class="ivr-controls">
          <button type="button" class="ivr-toggle" :class="{ 'is-off': !camOn }" :aria-pressed="camOn" :aria-label="`카메라 ${camOn ? '끄기' : '켜기'}`" @click="toggleCam">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2"></rect><path d="m16 10 5-3v10l-5-3z"></path></svg>
          </button>
          <button type="button" class="ivr-toggle" :class="{ 'is-off': !micOn }" :aria-pressed="micOn" :aria-label="`마이크 ${micOn ? '끄기' : '켜기'}`" @click="toggleMic">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"></path></svg>
          </button>
          <button
            type="button"
            class="ivr-next-side ivr-control-primary"
            :class="{ 'is-end': started && isLast }"
            :disabled="isFinishing || countdown > 0"
            @click="onPrimaryButton"
          >{{ primaryLabel }}</button>
        </div>
      </section>

      <aside class="ivr-side">
        <p v-if="recordingError" class="ivr-recording-error" role="alert">{{ recordingError }}</p>

        <div class="ivr-info">
          <span class="ivr-info-eyebrow">면접 정보</span>
          <dl>
            <div><dt>직군</dt><dd>{{ jobLabel }}</dd></div>
            <div><dt>유형</dt><dd>{{ typeLabel }}</dd></div>
            <div><dt>진행</dt><dd>{{ qIndex + 1 }} / {{ questions.length }}</dd></div>
          </dl>
          <div class="ivr-progress"><span :style="{ width: progressWidth }"></span></div>
          <div class="ivr-timer"><span>면접 시간</span><strong>{{ started ? recording.elapsedLabel : '0:00' }}</strong></div>
        </div>

        <div class="ivr-interviewer-card">
          <span class="ivr-info-eyebrow">면접관</span>
          <div class="ivr-interviewer-profile">
            <span class="ivr-interviewer-avatar">
              <img v-if="!imgFailed" :src="interviewer.img" :alt="interviewer.name" @error="imgFailed = true" />
              <span v-else>{{ interviewer.emoji }}</span>
            </span>
            <div class="ivr-interviewer-text">
              <strong>{{ interviewer.name }}</strong>
              <small>{{ interviewer.desc }}</small>
            </div>
          </div>
        </div>

        <!-- 실시간 자막 · 분석 (왼쪽에서 오른쪽 패널로 이동) -->
        <div class="ivr-rail-live">
          <div class="ivr-live-head">
            <span>실시간 자막</span>
            <span class="ivr-live-badge"><i></i>LIVE</span>
          </div>
          <div class="ivr-transcript" aria-live="polite">
            <p v-if="!transcript.length" class="ivr-transcript-ph">면접이 시작되면 말한 내용이 실시간으로 표시됩니다.</p>
            <p
              v-for="(line, idx) in transcript"
              :key="idx"
              :class="{ 'is-latest': idx === transcript.length - 1 }"
            >{{ line }}</p>
          </div>

          <div class="ivr-live-head"><span>실시간 분석</span></div>
          <div class="ivr-analysis">
            <div><strong>{{ started ? wpm : '--' }}</strong><small>말하기속도 WPM</small></div>
            <div><strong>{{ filler }}</strong><small>필러워드 회</small></div>
          </div>
        </div>
      </aside>
    </div>

    <!-- 처음 진입 시 단계별 튜토리얼 -->
    <div v-if="showTutorial" class="ivr-tut" role="dialog" aria-modal="true" aria-label="면접 녹화 사용법 안내">
      <div class="ivr-tut-spot" :style="spotStyle" aria-hidden="true"></div>
      <div class="ivr-tut-tip" :style="tipStyle">
        <span class="ivr-tut-step">{{ tutorialStep + 1 }} / {{ tutorialSteps.length }}</span>
        <strong class="ivr-tut-title">{{ currentTut.title }}</strong>
        <p class="ivr-tut-desc">{{ currentTut.desc }}</p>
        <div class="ivr-tut-actions">
          <button type="button" class="ivr-tut-skip" @click="closeTutorial">건너뛰기</button>
          <div class="ivr-tut-nav">
            <button v-if="tutorialStep > 0" type="button" class="ivr-tut-prev" @click="prevTut">이전</button>
            <button type="button" class="ivr-tut-next" @click="nextTut">{{ isLastTut ? '시작하기' : '다음' }}</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* 질문당 1분 카운트다운 (카메라 우상단) */
.ivr-qtimer {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(16, 20, 46, .68);
  color: #fff;
  backdrop-filter: blur(6px);
}
.ivr-qtimer strong {
  font-size: 22px;
  font-weight: 850;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ivr-qtimer small { font-size: 10px; font-weight: 700; opacity: .8; }
.ivr-qtimer.is-urgent { background: rgba(214, 58, 58, .82); }

/* 질문 TTS 재생 중 '녹음 계속' 안내 (카메라 하단 중앙) */
.ivr-speaking-notice {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: calc(100% - 28px);
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(214, 58, 58, .92);
  color: #fff;
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
  box-shadow: 0 8px 22px rgba(214, 58, 58, .3);
}
.ivr-speaking-notice i {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #fff;
  animation: ivrRecPulse 1s ease-in-out infinite;
}
@keyframes ivrRecPulse { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ivr-speaking-notice i { animation: none; } }

/* 오른쪽 주요 버튼: 마지막 질문의 '종료하기'는 빨강으로 구분 */
.ivr-next-side.is-end {
  background: #e04a4a !important;
  border-color: #e04a4a !important;
  color: #fff !important;
}
.ivr-next-side.is-end:hover:not(:disabled) { background: #cc3d3d !important; }

/* ── 단계별 튜토리얼(코치마크) ── */
.ivr-tut {
  position: fixed;
  inset: 0;
  z-index: 1200;
}
/* 대상만 밝게, 나머지는 큰 box-shadow로 어둡게 */
.ivr-tut-spot {
  position: fixed;
  border-radius: 14px;
  box-shadow: 0 0 0 9999px rgba(12, 15, 34, .72);
  outline: 2px solid rgba(124, 138, 246, .9);
  outline-offset: 0;
  pointer-events: none;
  transition: top .22s ease, left .22s ease, width .22s ease, height .22s ease;
}
.ivr-tut-tip {
  position: fixed;
  width: 288px;
  max-width: calc(100vw - 32px);
  padding: 13px 15px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(16, 20, 46, .26);
}
.ivr-tut-step {
  display: inline-block;
  margin-bottom: 4px;
  color: #6b73dc;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .02em;
}
.ivr-tut-title {
  display: block;
  color: #1b1f45;
  font-size: 14px;
  font-weight: 850;
}
.ivr-tut-desc {
  margin: 5px 0 0;
  color: #4a5270;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}
.ivr-tut-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 13px;
}
.ivr-tut-nav { display: flex; gap: 7px; }
.ivr-tut-skip {
  border: 0;
  background: transparent;
  color: #8a92a8;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.ivr-tut-prev,
.ivr-tut-next {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.ivr-tut-prev {
  border: 1px solid #d5dcea;
  background: #fff;
  color: #3a445f;
}
.ivr-tut-next {
  border: 0;
  background: #5b63d6;
  color: #fff;
}
.ivr-tut-next:hover { background: #4a52c4; }

@media (prefers-reduced-motion: reduce) {
  .ivr-tut-spot { transition: none; }
}
</style>
