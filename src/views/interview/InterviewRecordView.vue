<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useFaceAnalysis } from '../../composables/useFaceAnalysis.js'
import { getStreamAspectRatio, INTERVIEW_MEDIA_CONSTRAINTS, useMediaDevices } from '../../composables/useMediaDevices.js'
import { useRecorder } from '../../composables/useRecorder.js'
import { PcmWavCapture } from '../../services/pcmWavCapture.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useInterviewStore } from '../../stores/interviewStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import { createFillerAccumulator } from '../../utils/interviewAudioAnalysis.js'
import { readBooleanStorage, writeBooleanStorage } from '../../utils/storage.js'

const router = useRouter()
const auth = useAuthStore()
const interview = useInterviewStore()
const recording = useRecordingStore()
const { stream, checkDevices, stopStream } = useMediaDevices()
const recorder = useRecorder()
// MediaPipe 시선·자세 실시간 분석(카메라 프레임을 브라우저 안에서만 처리)
const {
  tiltScore,
  gazeDeviationCount,
  prepare: prepareFaceAnalysis,
  start: startFaceAnalysis,
  stop: stopFaceAnalysis,
  getSessionSummary,
} = useFaceAnalysis()

// 세션 전체 오디오 레코더(비디오와 별개, 같은 스트림의 오디오 트랙만 사용).
// 종료 시 complete 멀티파트로 업로드한다. 10초 청크 분석용 레코더는 아래에 따로 있다.
const fullAudioRecorder = useRecorder()
let interviewPcmCapture = null
const audioOnlyStream = () => {
  const tracks = stream.value?.getAudioTracks() ?? []
  return tracks.length ? new MediaStream(tracks) : null
}
const startAudioRecorder = (audioRecorder) => {
  const audioStream = audioOnlyStream()
  if (!audioStream) return
  try {
    audioRecorder.start(audioStream, { mimeType: 'audio/webm' })
  } catch {
    try { audioRecorder.start(audioStream) } catch { /* 오디오 녹음 불가 — UI는 계속 */ }
  }
}

// 앞 단계에서 고른 면접관 한 명 — 이름만 상단 정보 카드에 텍스트로 표시한다.
const PERSONAS = {
  practical: { name: '실무 중심형' },
  growth: { name: '성장 코치형' },
  pressure: { name: '압박 검증형' },
}
const interviewer = computed(() => PERSONAS[interview.interviewerStyle] ?? PERSONAS.practical)

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

// 영상 녹화는 TTS 재생 중에도 멈추지 않고 계속되므로, 영상의 "실제" 경과
// 시간은 recording.elapsedSeconds(TTS 중엔 멈춤)와 별도로 따로 세야 한다.
// 이 값 기준으로 TTS 구간(ttsWindows)을 기록해두면, 리포트 화면이 영상을
// 재생하면서 그 구간엔 "TTS 재생 중"이라고 표시하고, 그 이후의 자막·그래프
// 시각을 이 값만큼 밀어서 영상과 정확히 맞출 수 있다.
const videoElapsedSeconds = ref(0)
const ttsWindows = ref([]) // [{ questionIndex, start, end }] — videoElapsedSeconds 기준

// 실시간 자막: Web Speech API(브라우저 STT). 질문별 최종(final) 문장을 누적해
// complete의 answer 텍스트로도 쓴다. 미지원 브라우저에서는 자막 없이 진행된다.
const SpeechRecognitionCtor = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null
const sttSupported = Boolean(SpeechRecognitionCtor)
let recognition = null
let recognitionActive = false
const finalLines = ref([]) // 현재 질문에서 확정된 문장들
const interimLine = ref('') // 아직 확정되지 않은 중간 인식 문장
const currentAnswerText = computed(() => finalLines.value.join(' '))
const transcript = computed(() => {
  const lines = interimLine.value ? [...finalLines.value, interimLine.value] : finalLines.value
  return lines.slice(-3)
})

const startRecognition = () => {
  if (!SpeechRecognitionCtor || recognition) return
  recognition = new SpeechRecognitionCtor()
  recognition.lang = 'ko-KR'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      const text = result[0]?.transcript?.trim() ?? ''
      if (!text) continue
      if (result.isFinal) finalLines.value = [...finalLines.value, text]
      else interim += text
    }
    interimLine.value = interim
  }
  // continuous여도 브라우저가 수시로 세션을 끊는다 → 녹화 중이면 이어 붙인다.
  recognition.onend = () => {
    if (recognitionActive) {
      try { recognition.start() } catch { /* 연속 재시작 예외 무시 */ }
    }
  }
  recognition.onerror = () => {}
  recognitionActive = true
  try { recognition.start() } catch { /* 권한 거부 등 — 자막 없이 진행 */ }
}
// TTS가 질문을 읽는 동안에는 STT를 멈춰 질문이 자막·답변에 섞이지 않게 한다.
const pauseRecognition = () => {
  if (!recognition) return
  recognitionActive = false
  try { recognition.abort() } catch {}
}
const resumeRecognition = () => {
  if (!recognition || !started.value || isFinishing.value) return
  recognitionActive = true
  try { recognition.start() } catch {}
}
const stopRecognition = () => {
  recognitionActive = false
  if (recognition) {
    try { recognition.stop() } catch {}
    recognition = null
  }
  interimLine.value = ''
}

// 실시간 분석 표시 원칙:
// - 말속도: 백엔드 공식 단위가 '초당 음절'(팀 확인)이라 자막의 한글 음절 수 기반
//   으로 초당 음절을 추정 — 침묵이면 0. (API 필드명은 averageWpm이지만 값은 초당 음절)
// - 필러: 서버(10초 청크 audio-analysis) 확정치만 누적. 자막 기반 추정은 하지
//   않는다 — Chrome STT가 추임새를 걸러 자막에 안 남기는 데다, '그'·'이제' 같은
//   일반 단어를 필러로 오인하는 오탐이 생기기 때문.
const syllablesPerSec = ref(0)
const completedFillerCount = ref(0) // 백엔드가 확정한 지난 청크 필러 누적
const filler = computed(() => completedFillerCount.value)
const fillerAccumulator = createFillerAccumulator()

const analysisToast = ref(null) // { sequence, feedback, averageWpm, fillerCount }
let toastTimer = null

// 서버 feedback 문장에서 말더듬 언급을 걸러낸다 — stutterDetected가 명세 실수로
// 확인된 뒤에도 문구 템플릿에는 '반복/말더듬 후보 N회' 문장이 남아 있어서,
// 백엔드가 문구를 정리할 때까지 프론트에서 숨긴다. ('감지되지 않았습니다' 같은
// 미감지 요약 문장은 남긴다.)
const sanitizeFeedback = (text) => String(text ?? '')
  .split(/(?<=\.)\s+/)
  .filter((sentence) => !(sentence.includes('말더듬') && !sentence.includes('않았습니다')))
  .join(' ')
  .trim()

const showAnalysisToast = (analysis) => {
  analysisToast.value = { ...analysis, feedback: sanitizeFeedback(analysis.feedback) }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { analysisToast.value = null }, 6500)
}

// TTS가 질문을 읽는 동안에는 업로드용 녹음(세션 전체 오디오·10초 청크)도 멈춘다.
// 스피커로 나온 질문 소리가 마이크로 되돌아 들어가 말속도·필러 분석에 잡히는 것을
// 막기 위함이다(자막 STT도 같은 이유로 이미 일시정지한다). 영상 녹화는 계속된다.
const pauseUploadRecorders = () => {
  fullAudioRecorder.pause()
  interviewPcmCapture?.pause()
}
const resumeUploadRecorders = () => {
  fullAudioRecorder.resume()
  interviewPcmCapture?.resume()
}

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
  finalLines.value = []
  interimLine.value = ''
  syllablesPerSec.value = 0
}

// ── TTS: 질문을 음성으로 읽어준다(브라우저 SpeechSynthesis). ──
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const isSpeaking = ref(false) // 질문 TTS 재생 중 (읽는 동안에도 녹음 계속 안내용)
let ttsRunId = 0
const speakQuestion = (text) => {
  if (!ttsSupported || !text) return
  const runId = ++ttsRunId
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 1
    // onstart는 실제 소리가 난 뒤 호출될 수 있다. speak() 전에 먼저 녹음기를
    // 멈춰 질문 첫 음절이 10초 청크에 섞이는 경합을 차단한다.
    isSpeaking.value = true
    pauseRecognition()
    pauseUploadRecorders()
    const windowStart = videoElapsedSeconds.value
    const windowQuestionIndex = qIndex.value
    const finishSpeaking = () => {
      if (runId !== ttsRunId) return
      isSpeaking.value = false
      resumeRecognition()
      resumeUploadRecorders()
      ttsWindows.value = [...ttsWindows.value, {
        questionIndex: windowQuestionIndex,
        start: windowStart,
        end: videoElapsedSeconds.value,
      }]
    }
    utterance.onend = finishSpeaking
    utterance.onerror = finishSpeaking
    window.speechSynthesis.speak(utterance)
  } catch {
    if (runId === ttsRunId) {
      isSpeaking.value = false
      resumeRecognition()
      resumeUploadRecorders()
    }
  }
}
const stopTts = () => {
  ttsRunId += 1
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

// 현재 질문 구간을 닫아 기록에 추가한다(답변 텍스트는 complete의 answers로 쓴다).
// 오디오 분석은 질문과 무관하게 10초 청크 사이클이 따로 처리한다.
const closeSegment = () => {
  const question = currentQuestion.value
  answerSegments.value = [
    ...answerSegments.value,
    {
      questionId: question.questionId ?? question.id ?? null,
      questionIndex: qIndex.value,
      question: question.text,
      category: question.cat ?? question.category ?? '',
      answer: currentAnswerText.value,
      startTime: currentSegmentStart,
      endTime: recording.elapsedSeconds,
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
    stopRecognition()
    const [audioBlob, videoBlob] = await Promise.all([
      fullAudioRecorder.stop(),
      recorder.stop(),
      interviewPcmCapture?.stop(),
    ])
    recording.stop(videoBlob)
    stopStream()
    return { videoBlob, audioBlob }
  })()
  return captureStopPromise
}

const teardown = () => {
  clearCountdown()
  stopTts()
  stopFaceAnalysis()
  if (toastTimer) window.clearTimeout(toastTimer)
  void stopCapture()
}

// 왼쪽 상단 뒤로가기 → 확인 모달 → 면접 설정으로 이동(녹화 중단).
const showExit = ref(false)
const confirmExit = async () => {
  clearCountdown()
  stopTts()
  await stopCapture()
  await router.push('/interview/setup')
}

// 면접 시작: 5초 카운트다운 후 실제 시작.
const beginStartCountdown = () => {
  clearCountdown()
  countdown.value = 5
  countdownId = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearCountdown()
      void actuallyStart().catch((error) => {
        recordingError.value = error?.message || '면접 녹음을 시작하지 못했습니다.'
        started.value = false
      })
    }
  }, 1000)
}
const actuallyStart = async () => {
  started.value = true
  fillerAccumulator.reset()
  completedFillerCount.value = 0
  videoElapsedSeconds.value = 0
  ttsWindows.value = []
  recording.reset()
  recording.start()
  void startFaceAnalysis(videoEl.value)
  if (stream.value) {
    try { recorder.start(stream.value) } catch { /* codec 문제여도 UI는 계속 */ }
  }
  startAudioRecorder(fullAudioRecorder)
  if (stream.value) {
    interviewPcmCapture = new PcmWavCapture({
      onChunk: async ({ blob, sequence }) => {
        const result = await interview.analyzeAnswerAudio({ blob, sequence })
        if (result) {
          completedFillerCount.value = fillerAccumulator.apply(result, sequence)
          showAnalysisToast(result)
        }
        return result
      },
    })
    await interviewPcmCapture.start(stream.value)
  }
  startRecognition()
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
    const { videoBlob, audioBlob } = await stopCapture()
    interview.finishRecording({
      videoBlob,
      audioBlob,
      durationSeconds,
      answers: answerSegments.value,
      nonverbal: getSessionSummary(),
      ttsWindows: ttsWindows.value,
    })
    await router.push('/interview/analyzing')
  } catch (error) {
    recordingError.value = error?.message || interview.saveError || '녹화 파일 저장에 실패했습니다. 다시 시도해주세요.'
    isFinishing.value = false
  }
}

const onTick = () => {
  if (!started.value) return
  // 영상은 TTS 중에도 계속 녹화되므로 이 카운터는 절대 멈추지 않는다 —
  // ttsWindows(speakQuestion)가 이 값 기준으로 TTS 구간을 기록해, 리포트가
  // 영상 재생 시각과 정확히 맞춰 "TTS 재생 중" 표시·자막 위치를 계산한다.
  videoElapsedSeconds.value += 1
  // TTS가 질문을 읽어주는 동안에는 업로드용 오디오 녹음 자체가 멈춰있다
  // (pauseUploadRecorders). 여기서 elapsedSeconds를 계속 올리면 실제
  // 녹음 파일 길이보다 durationSec이 TTS 재생 시간만큼 부풀어서, 리포트의
  // 전체 길이·질문 종료 시각이 실제 오디오 파일과 어긋나게 된다 — 답변
  // 카운트다운과 마찬가지로 타이머 자체를 멈춘다.
  if (isSpeaking.value) return
  recording.tick()
  // 말속도(초당 음절): 이번 질문 구간 자막의 한글 음절 수 기반 — 아무 말도 없으면 0.
  const spoken = `${currentAnswerText.value} ${interimLine.value}`.trim()
  const syllables = (spoken.match(/[가-힣]/g) || []).length
  const segmentElapsedSec = Math.max(1, recording.elapsedSeconds - currentSegmentStart)
  syllablesPerSec.value = syllables ? Math.round((syllables / segmentElapsedSec) * 10) / 10 : 0
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
  { sel: '.ivr-rail-live', title: '실시간 자막 · 분석', desc: '답변하는 동안 말한 내용이 자막으로, 말하기 속도(초당 음절)·필러워드·시선·자세가 실시간 분석으로 표시돼요.' },
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
    await checkDevices(INTERVIEW_MEDIA_CONSTRAINTS)
    applyTrackState()
    syncCameraAspectRatio()
    // 모델은 미리 준비하되, 실제 카운트는 5초 카운트다운이 끝난 뒤 시작한다.
    void prepareFaceAnalysis()
    startAudioMeter()
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
        <div class="ivr-rail-top">
          <button type="button" class="ivr-back" aria-label="면접 종료하고 나가기" @click="showExit = true">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <div class="ivr-rail-head">면접 질문</div>
        </div>
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
            :style="{ '--ivr-camera-ratio': cameraAspectRatio, '--camera-zoom': recording.cameraZoom }"
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

            <!-- 질문을 읽어주는 동안에는 음성 분석·자막이 잠시 멈춤을 알림 -->
            <div v-if="started && isSpeaking" class="ivr-speaking-notice" role="status">
              <i aria-hidden="true"></i><span>질문을 읽는 중이에요 — 끝나면 답변을 시작하세요</span>
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
            <div><dt>면접관</dt><dd>{{ interviewer.name }}</dd></div>
            <div><dt>진행</dt><dd>{{ qIndex + 1 }} / {{ questions.length }}</dd></div>
          </dl>
          <div class="ivr-progress"><span :style="{ width: progressWidth }"></span></div>
          <div class="ivr-timer"><span>면접 시간</span><strong>{{ started ? recording.elapsedLabel : '0:00' }}</strong></div>
        </div>

        <!-- 실시간 자막 · 분석 (왼쪽에서 오른쪽 패널로 이동) -->
        <div class="ivr-rail-live">
          <div class="ivr-live-head">
            <span>실시간 자막</span>
            <span class="ivr-live-badge"><i></i>LIVE</span>
          </div>
          <div class="ivr-transcript" aria-live="polite">
            <p v-if="!transcript.length" class="ivr-transcript-ph">{{ sttSupported ? '면접이 시작되면 말한 내용이 실시간으로 표시됩니다.' : '이 브라우저는 실시간 자막(음성 인식)을 지원하지 않아요.' }}</p>
            <p
              v-for="(line, idx) in transcript"
              :key="idx"
              :class="{ 'is-latest': idx === transcript.length - 1 }"
            >{{ line }}</p>
          </div>

          <div class="ivr-live-head"><span>실시간 분석</span></div>
          <div class="ivr-analysis">
            <div><strong>{{ started ? syllablesPerSec.toFixed(1) : '--' }}</strong><small>초당 음절</small></div>
            <div><strong>{{ started ? filler : '--' }}</strong><small>필러워드 회</small></div>
            <div><strong>{{ started ? gazeDeviationCount : '--' }}</strong><small>시선 이탈 회</small></div>
            <div><strong>{{ started && tiltScore != null ? `${tiltScore}%` : '--' }}</strong><small>기울어짐</small></div>
          </div>
        </div>
      </aside>
    </div>

    <!-- 10초 청크 음성 분석 피드백 (왼쪽 하단 팝업) -->
    <Transition name="ivr-toast">
      <div v-if="analysisToast" class="ivr-analysis-toast" role="status" aria-live="polite">
        <div class="ivr-analysis-toast-head">
          <span class="ivr-analysis-toast-badge"><i aria-hidden="true"></i>음성 분석</span>
          <button type="button" class="ivr-analysis-toast-close" aria-label="분석 팝업 닫기" @click="analysisToast = null">×</button>
        </div>
        <p v-if="analysisToast.feedback" class="ivr-analysis-toast-feedback">{{ analysisToast.feedback }}</p>
        <small class="ivr-analysis-toast-stats">
          <!-- 말속도는 표기 보류: 청크 API의 averageWpm은 분당 단어(실측 검증)인데
               공식 지표 단위는 초당 음절이라, 백엔드가 단위를 통일하면 다시 노출한다. -->
          필러 {{ analysisToast.fillerCount ?? 0 }}회{{ analysisToast.silenceDetected ? ' · 침묵 감지' : '' }}
        </small>
      </div>
    </Transition>

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

  <!-- 뒤로가기 확인 모달 -->
  <div v-if="showExit" class="ivr-exit-modal" role="dialog" aria-modal="true" aria-labelledby="ivrExitTitle">
    <div class="ivr-exit-dialog">
      <h2 id="ivrExitTitle">면접을 종료하고 나갈까요?</h2>
      <p>지금까지의 녹화는 저장되지 않고 면접 설정 페이지로 돌아갑니다.</p>
      <div class="ivr-exit-actions">
        <button type="button" @click="showExit = false">취소</button>
        <button type="button" @click="confirmExit">나가기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 왼쪽 패널 상단: 뒤로가기 + '면접 질문' */
.ivr-rail-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ivr-back {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #e6eaf2;
  border-radius: 50%;
  background: #fff;
  color: #3f57a3;
  cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease, color .15s ease;
}
.ivr-back svg { width: 20px; height: 20px; }
.ivr-back:hover,
.ivr-back:focus-visible {
  border-color: #5968dc;
  background: #f5f6fb;
  color: #4453c4;
  outline: none;
}

/* 뒤로가기 확인 모달 */
.ivr-exit-modal {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(16, 20, 46, .5);
}
.ivr-exit-dialog {
  width: min(360px, 100%);
  padding: 26px 26px 20px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(16, 20, 46, .3);
  text-align: center;
}
.ivr-exit-dialog h2 {
  margin: 0;
  color: #1b1f45;
  font-size: 18px;
  font-weight: 850;
}
.ivr-exit-dialog p {
  margin: 10px 0 0;
  color: #5a6480;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.6;
}
.ivr-exit-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.ivr-exit-actions button {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}
.ivr-exit-actions button:first-child {
  border: 1px solid #d5dcea;
  background: #fff;
  color: #3a445f;
}
.ivr-exit-actions button:last-child {
  border: 0;
  background: #e04a4a;
  color: #fff;
}
.ivr-exit-actions button:last-child:hover {
  background: #cc3d3d;
}

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

/* ── 10초 청크 음성 분석 피드백 팝업 (왼쪽 하단) ── */
.ivr-analysis-toast {
  position: fixed;
  left: 18px;
  bottom: 18px;
  z-index: 1100;
  width: 300px;
  max-width: calc(100vw - 36px);
  padding: 13px 15px;
  border: 1px solid #e3e7f2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(16, 20, 46, .2);
}
.ivr-analysis-toast-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ivr-analysis-toast-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4453c4;
  font-size: 11.5px;
  font-weight: 850;
  letter-spacing: .02em;
}
.ivr-analysis-toast-badge i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5b63d6;
  animation: ivrRecPulse 1.2s ease-in-out infinite;
}
.ivr-analysis-toast-close {
  border: 0;
  padding: 0 2px;
  background: transparent;
  color: #9aa2b8;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.ivr-analysis-toast-feedback {
  margin: 7px 0 0;
  color: #2a3352;
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.55;
}
.ivr-analysis-toast-stats {
  display: block;
  margin-top: 7px;
  color: #7c86a0;
  font-size: 11px;
  font-weight: 700;
}
.ivr-toast-enter-active,
.ivr-toast-leave-active {
  transition: opacity .22s ease, transform .22s ease;
}
.ivr-toast-enter-from,
.ivr-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .ivr-analysis-toast-badge i { animation: none; }
  .ivr-toast-enter-active, .ivr-toast-leave-active { transition: none; }
}

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
