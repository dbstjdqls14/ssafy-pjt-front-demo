<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import { buildVoicePaceMock, toClock, useVoicePaceGraph } from '../../composables/useVoicePaceGraph.js'
import { buildGestureSeriesMock, formatTiltPercent, useGestureGraph } from '../../composables/useGestureGraph.js'

const route = useRoute()
const archive = useArchiveStore()
const presentation = usePresentationStore()
const recording = useRecordingStore()
const recordId = computed(() => String(route.params.id || route.query.id || ''))
const detailedSession = ref(null)

const session = computed(
  () =>
    detailedSession.value ??
    archive.find(recordId.value) ??
    (recordId.value && recordId.value === String(presentation.sessionId)
      ? {
          id: recordId.value,
          type: 'presentation',
          title: presentation.title,
          durationSeconds: presentation.recordedSeconds,
          duration: `${Math.floor(presentation.recordedSeconds / 60)}분 ${String(presentation.recordedSeconds % 60).padStart(2, '0')}초`,
          score: presentation.report?.overallScore ?? 0,
          ...presentation.report,
          slides: Array.isArray(presentation.report?.slides) && presentation.report.slides.length
            ? presentation.report.slides
            : presentation.slides,
          transcripts: Array.isArray(presentation.report?.transcripts) && presentation.report.transcripts.length
            ? presentation.report.transcripts
            : presentation.transcriptEvents,
        }
      : null) ?? {
      id: 'missing',
      type: 'presentation',
      title: '제목 없는 발표',
      date: '-',
      time: '-',
      duration: '-',
      score: 0,
    },
)
const title = computed(() => session.value.title?.trim() || '제목 없는 발표')
const description = computed(() => session.value.description?.trim() || '')
const returnFolderId = computed(() => route.query.folderId ?? session.value.folderId ?? null)
const folderBackLink = computed(() => (
  returnFolderId.value
    ? `/archive/folders/${returnFolderId.value}?type=${route.query.type ?? session.value.type ?? 'presentation'}`
    : '/archive'
))

// 연습 날짜가 기록에 없으면(데모/방금 끝난 세션) 오늘 날짜로 표시한다.
const reportDate = computed(() => {
  const d = session.value.date
  if (d && d !== '-') return d
  const now = new Date()
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
})

const scoreMetrics = computed(() => ({
  voiceScore: Number(session.value.voiceScore ?? session.value.scores?.voice ?? 86),
  videoScore: Number(session.value.videoScore ?? session.value.scores?.video ?? 82),
  contentScore: Number(session.value.contentScore ?? session.value.scores?.content ?? 84),
}))
const finalScore = computed(() =>
  Number(session.value.overallScore ?? session.value.score) ||
  Math.round((scoreMetrics.value.voiceScore + scoreMetrics.value.videoScore + scoreMetrics.value.contentScore) / 3),
)

const FALLBACK_SLIDES = [
  { title: '서비스 소개 발표', summary: '발표 목표와 서비스가 해결하는 문제를 소개합니다.' },
  { title: '문제와 해결 방법', summary: '기존 발표 연습 과정의 불편과 AIVO의 해결 방식을 설명합니다.' },
  { title: '핵심 기능과 기대효과', summary: '실시간 분석과 반복 연습이 만드는 변화를 보여줍니다.' },
  { title: '마무리', summary: '핵심 가치를 요약하고 다음 행동을 제안합니다.' },
]
// 슬라이드 하나를 소개하는 데 한두 마디로는 부족해서, 실제 발표처럼 슬라이드당
// 여러 문장이 이어지도록 데모 발화를 채운다. text는 항상 실제 발화(내용 탭에서
// 그대로 이어붙임), reason은 코칭 피드백(몸짓 탭에서만 보여줌)으로 구분한다.
// 실제로는 백엔드 STT/MediaPipe 분석 결과가 이 자리에 들어온다.
const FALLBACK_TRANSCRIPTS = [
  { time: '00:00', slide: 0, kind: 'match', label: '핵심 내용', text: '안녕하세요, 오늘 발표를 맡은 발표자입니다.' },
  { time: '00:14', slide: 0, kind: 'match', label: '핵심 내용', text: '저희 팀은 발표와 면접을 준비하는 사람들이 겪는 어려움에 주목했습니다.' },
  { time: '00:30', slide: 0, kind: 'match', label: '핵심 내용', text: '긴장한 상태에서는 스스로 말하기 습관이나 시선 처리를 점검하기가 쉽지 않습니다.' },
  { time: '00:46', slide: 0, kind: 'filler', label: '필러 1회', text: '그래서 저희는, 음, 이 문제를 데이터로 풀어보고자 했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 발표 초반 집중도를 떨어뜨립니다.', stats: [{ label: '"음"', value: '1회' }] },
  { time: '01:02', slide: 1, kind: 'match', label: '핵심 내용', text: '저희 서비스는 발표와 면접 연습을 돕는 AI 코칭 플랫폼입니다.' },
  { time: '01:18', slide: 1, kind: 'match', label: '핵심 내용', text: '기존에는 녹화 영상을 처음부터 끝까지 직접 돌려보며 문제를 찾아야 했습니다.' },
  { time: '01:35', slide: 1, kind: 'gaze', label: '시선 이탈', text: '그 대신 이 부분에서는 슬라이드 노트를 오래 들여다보게 되네요.', reason: '카메라 정면 대신 슬라이드 노트를 오래 응시했어요. 카메라 정면을 더 오래 응시해보세요.' },
  { time: '01:50', slide: 1, kind: 'match', label: '핵심 내용', text: 'AIVO는 이 과정을 자동으로 분석해서 문제 구간만 짚어드립니다.' },
  { time: '02:05', slide: 2, kind: 'match', label: '핵심 내용', text: '핵심 기능은 실시간 음성 분석과 시선, 자세 분석입니다.' },
  { time: '02:18', slide: 2, kind: 'filler', label: '필러 2회', text: '사용자가 반복적으로, 음, 말하기 습관을 개선할 수 있도록 설계했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 핵심 메시지의 자신감을 낮춥니다.', stats: [{ label: '"음"', value: '2회' }, { label: '"어"', value: '1회' }, { label: '말 더듬음', value: '1회' }] },
  { time: '02:40', slide: 2, kind: 'motion', label: '몸 움직임', text: '이 기능을 설명하는 동안 상체가 좌우로 흔들렸습니다.', reason: '설명 중 상체가 좌우로 흔들렸어요. 어깨를 고정하고 무게중심을 유지해보세요.' },
  { time: '03:05', slide: 2, kind: 'match', label: '핵심 내용', text: '이 모든 데이터는 리포트로 정리되어 한눈에 확인할 수 있습니다.' },
  { time: '03:25', slide: 2, kind: 'match', label: '핵심 내용', text: '사용자는 리포트를 보고 다음 연습에서 무엇을 개선할지 바로 알 수 있습니다.' },
  { time: '03:47', slide: 2, kind: 'evidence', label: '근거 보완', text: '실시간 분석을 통해 발표 준비 시간을 줄일 수 있습니다.', reason: '시간을 얼마나 줄일 수 있는지 수치나 실제 사례가 없어 설득력이 약합니다.', stats: [{ label: '정량 근거', value: '0건' }, { label: '구체 사례', value: '0건' }] },
  { time: '03:58', slide: 3, kind: 'match', label: '핵심 내용', text: '지금까지 AIVO의 핵심 기능과 기대 효과를 말씀드렸습니다.' },
  { time: '04:14', slide: 3, kind: 'match', label: '핵심 내용', text: '저희는 반복 연습을 통해 실력이 눈에 보이게 성장하는 경험을 제공하고자 합니다.' },
  { time: '04:32', slide: 3, kind: 'match', label: '핵심 내용', text: '발표와 면접이 더 이상 두렵지 않은 순간을 만들어 드리겠습니다.' },
  { time: '04:48', slide: 3, kind: 'match', label: '핵심 내용', text: '들어주셔서 감사합니다.' },
]
const slides = computed(() => {
  const items = session.value.slides ?? session.value.slideSummaries
  if (!Array.isArray(items) || !items.length) return FALLBACK_SLIDES
  return items.map((item, index) => ({
    ...item,
    id: item.id ?? item.slideId ?? index + 1,
    title: item.title ?? item.name ?? `슬라이드 ${index + 1}`,
    summary: item.summary ?? item.keyPoints ?? item.coreContent ?? item.script ?? item.notes ?? item.extractedText ?? '',
    previewUrl: item.previewUrl ?? item.previewImageUrl ?? item.imageUrl ?? item.renderedImageUrl ?? item.convertedImageUrl ?? item.thumbnailUrl ?? item.fileUrl ?? null,
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnailImageUrl ?? item.previewUrl ?? item.previewImageUrl ?? item.imageUrl ?? null,
  }))
})
const transcripts = computed(() => {
  const items = session.value.transcripts ?? session.value.transcriptSegments
  if (!Array.isArray(items) || !items.length) return FALLBACK_TRANSCRIPTS
  return items.map((item) => ({
    ...item,
    time: item.time ?? item.timestamp ?? '00:00',
    slide: Number(item.slide ?? item.slideIndex ?? 0),
    kind: item.kind ?? item.type ?? 'match',
    label: item.label ?? item.feedbackLabel ?? '발화 구간',
    text: item.text ?? item.transcript ?? '',
  }))
})
const qnaAnswers = [
  { question: '기존 발표 코칭 서비스와 비교했을 때 AIVO만의 차별점은 무엇인가요?', answer: 'AIVO는 발표 자료와 실제 발화를 함께 분석합니다. 음, 그래서 내용 전달과 말하기 습관을 한 번에 확인할 수 있습니다.', problem: '음, 그래서 내용 전달과 말하기 습관을 한 번에 확인할 수 있습니다.', label: '불필요한 습관어', feedback: '"음"을 빼고 차별점을 바로 설명하면 답변이 더 명확하고 자신감 있게 들립니다.' },
  { question: '실제 사용자는 어떤 변화를 기대할 수 있나요?', answer: '반복 연습을 통해 발표 준비 시간을 줄이고 핵심 메시지를 더 분명하게 전달할 수 있습니다.', problem: '발표 준비 시간을 줄이고', label: '근거 보완', feedback: '시간 절감 효과를 수치나 실제 사례와 함께 제시하면 답변의 설득력이 높아집니다.' },
]

const timeToSeconds = (value) => {
  const parts = String(value || '0:00').split(':').map(Number)
  return parts.length === 2 ? parts[0] * 60 + parts[1] : Number(parts[0]) || 0
}
const durationSeconds = computed(() =>
  Math.max(
    Number(session.value.durationSeconds ?? 0),
    timeToSeconds(session.value.duration),
    ...transcripts.value.map((t) => timeToSeconds(t.time) + 20),
  ),
)

// 발화 이슈를 대분류(음성/몸짓/내용)로 매핑 — 음성 세부 지표(필러 등)는 위
// 요약 헤더에서 이미 보여주므로, 슬라이드별 "몸짓" 탭/"내용" 탭에서는 각각
// 몸짓·내용 카테고리만 걸러 쓴다.
const transcriptMetric = (item) => {
  if (item.metric) return item.metric
  if (item.kind === 'filler') return 'filler'
  if (item.kind === 'pace') return 'pace'
  if (item.kind === 'silence') return 'silence'
  if (item.kind === 'motion') return 'motion'
  if (item.kind === 'gaze') return 'gaze'
  return 'contentMatch'
}
const CATEGORY_BY_METRIC = { filler: 'voice', pace: 'voice', silence: 'voice', motion: 'video', gaze: 'video', contentMatch: 'content' }
const metricCategory = (key) => CATEGORY_BY_METRIC[key] ?? 'content'
const segmentCategory = (segment) => metricCategory(transcriptMetric(segment))

// 음성 세부 지표(요약 헤더 호버 전용 — 발표 전체 집계, 데모).
const VOICE_DETAIL = {
  filler: { total: 19, breakdown: '어 15회 · 그 3회 · 음 1회' },
  avgPace: '초당 3.9음절',
  longSilence: '0회',
}

// ── 슬라이드 단위 구간(면접의 질문 durationSec에 대응) ──
// 슬라이드별 실제 시작·종료 시각까지는 아직 없어서, 전체 길이를 슬라이드
// 수만큼 균등 분할한다(실측 타임스탬프가 생기면 이 부분만 교체하면 됨).
const slideDurationSec = computed(() => Math.max(1, Math.round(durationSeconds.value / Math.max(1, slides.value.length))))
const slideStartSecAt = (index) => index * slideDurationSec.value
const totalPresentationDurationSec = computed(() => durationSeconds.value)

const selectedSlide = ref(0)
const currentSlide = computed(() => slides.value[selectedSlide.value] ?? FALLBACK_SLIDES[0])
const selectReportSlide = (index) => {
  selectedSlide.value = Math.max(0, Math.min(slides.value.length - 1, index))
}

// ── 절대 재생 위치(전체 녹화 기준) — 그래프는 슬라이드 단위로 쪼개져도
// 영상·자막은 처음부터 끝까지 하나로 이어진다(면접 리포트와 동일한 설계). ──
const questionStartSec = computed(() => slideStartSecAt(selectedSlide.value))
const absoluteVideoSec = ref(null)
const activeSec = computed(() => (
  absoluteVideoSec.value == null ? null : absoluteVideoSec.value - questionStartSec.value
))
const seekAbsolute = (absSec) => {
  absoluteVideoSec.value = absSec
  const el = videoEl.value
  if (!el) return
  // 재생 중이 아니었다면(예: 아직 재생 전이거나 일시정지 상태) 이동만 하고
  // 멈춘 채로 둔다 — 클릭할 때마다 강제로 재생이 시작되면 오히려 불편하다.
  const wasPlaying = !el.paused
  el.currentTime = Math.min(absSec, Number.isFinite(el.duration) ? el.duration : absSec)
  if (wasPlaying) {
    const p = el.play()
    if (p?.catch) p.catch(() => {})
  }
}
const seekVoice = (relSec) => seekAbsolute(questionStartSec.value + relSec)
const onVideoTimeUpdate = () => {
  const el = videoEl.value
  if (!el) return
  absoluteVideoSec.value = el.currentTime
}
const selectSlideAndSeek = (index) => {
  selectReportSlide(index)
  seekVoice(0)
}
const prevSlide = () => { if (selectedSlide.value > 0) selectSlideAndSeek(selectedSlide.value - 1) }
const nextSlide = () => { if (selectedSlide.value < slides.value.length - 1) selectSlideAndSeek(selectedSlide.value + 1) }

// ── 섹션1: 음성/몸짓 탭(슬라이드 단위) — 그래프 엔진은 면접 리포트와 공용. ──
const metricTab = ref('voice')
const currentSlideVoicePace = computed(() => buildVoicePaceMock(slideDurationSec.value, selectedSlide.value))

// 몸짓 탭 그래프 — 기울기는 계속 바뀌는 연속값이라 라인으로, 시선 이탈은
// "몇 번 벗어났는지"만 의미 있는 사건이라 음성 탭 필러처럼 점으로 찍는다.
const currentGestureSeries = computed(() => buildGestureSeriesMock(slideDurationSec.value, selectedSlide.value))
const {
  chartEl: gestureChartEl,
  tiltYBounds,
  tiltYFor,
  tiltValueAtSec,
  avgTiltPct,
  avgTiltLineStyle,
  tiltLinePath,
  gazeDotPositions,
} = useGestureGraph(currentGestureSeries, slideDurationSec)
const seekFromGestureClientX = (clientX) => {
  const rect = gestureChartEl.value?.getBoundingClientRect()
  if (!rect) return
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  seekVoice(pct * slideDurationSec.value)
}
const isDraggingGesturePlayhead = ref(false)
const onGesturePlayheadPointerDown = (event) => {
  event.stopPropagation()
  event.target.setPointerCapture(event.pointerId)
  isDraggingGesturePlayhead.value = true
  seekFromGestureClientX(event.clientX)
}
const onGesturePlayheadPointerMove = (event) => {
  if (event.buttons !== 1) return
  seekFromGestureClientX(event.clientX)
}
const onGesturePlayheadPointerUp = () => { isDraggingGesturePlayhead.value = false }

const gestureHoverPct = ref(null)
const gestureHoverSec = ref(null)
const onGestureChartPointerDown = (event) => {
  event.currentTarget.setPointerCapture(event.pointerId)
  seekFromGestureClientX(event.clientX)
}
const onGestureChartPointerMove = (event) => {
  if (isDraggingGesturePlayhead.value) return
  const rect = gestureChartEl.value?.getBoundingClientRect()
  if (rect) {
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    gestureHoverPct.value = pct * 100
    gestureHoverSec.value = pct * slideDurationSec.value
  }
  if (event.buttons === 1) seekFromGestureClientX(event.clientX)
}
const onGestureHoverLeave = () => {
  gestureHoverPct.value = null
  gestureHoverSec.value = null
}
const gesturePlayheadPct = computed(() => (
  activeSec.value != null && activeSec.value >= 0 && activeSec.value <= slideDurationSec.value
    ? (activeSec.value / slideDurationSec.value) * 100
    : null
))
const gesturePlayheadYPct = computed(() => (
  gesturePlayheadPct.value == null ? null : tiltYFor(tiltValueAtSec(activeSec.value))
))

const {
  paceChartEl,
  pcOfSec,
  paceChartPath,
  avgLineStyle,
  paceMarkers,
  paceYBounds,
  paceYFor,
  paceAtSec,
  fillerDotPositions,
  rangeOverlays,
  silenceSegments,
} = useVoicePaceGraph(currentSlideVoicePace, slideDurationSec)

const playheadPct = computed(() => (
  activeSec.value != null && activeSec.value >= 0 && activeSec.value <= slideDurationSec.value
    ? pcOfSec(activeSec.value)
    : null
))
const playheadYPct = computed(() => (
  playheadPct.value == null ? null : paceYFor(paceAtSec(activeSec.value))
))
const seekFromClientX = (clientX) => {
  const rect = paceChartEl.value?.getBoundingClientRect()
  if (!rect) return
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  seekVoice(pct * slideDurationSec.value)
}
const isDraggingPlayhead = ref(false)
const onPlayheadPointerDown = (event) => {
  event.stopPropagation()
  event.target.setPointerCapture(event.pointerId)
  isDraggingPlayhead.value = true
  seekFromClientX(event.clientX)
}
const onPlayheadPointerMove = (event) => {
  if (event.buttons !== 1) return
  seekFromClientX(event.clientX)
}
const onPlayheadPointerUp = () => { isDraggingPlayhead.value = false }

// 마우스를 올린 위치의 정확한 시각·속도를 보여주는 크로스헤어 — 드래그하지
// 않고 그냥 가리키기만 해도 값을 확인할 수 있게 한다.
const hoverPct = ref(null)
const hoverSec = ref(null)
const pointFromClientX = (clientX) => {
  const rect = paceChartEl.value?.getBoundingClientRect()
  if (!rect) return null
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return { pct: pct * 100, sec: pct * slideDurationSec.value }
}
const onChartHoverLeave = () => {
  hoverPct.value = null
  hoverSec.value = null
}
// 필러 점·마커뿐 아니라 그래프 어디를 누르든 그 위치로 재생 헤드가 오도록.
const onChartPointerDown = (event) => {
  event.currentTarget.setPointerCapture(event.pointerId)
  const p = pointFromClientX(event.clientX)
  if (p) { hoverPct.value = p.pct; hoverSec.value = p.sec }
  seekFromClientX(event.clientX)
}
const onChartPointerMove = (event) => {
  if (isDraggingPlayhead.value) return
  const p = pointFromClientX(event.clientX)
  if (p) { hoverPct.value = p.pct; hoverSec.value = p.sec }
  if (event.buttons === 1) seekFromClientX(event.clientX)
}

// ── 섹션2: 좌 영상 / 우 슬라이드+현재 위치 발화 ──
const videoEl = ref(null)
const videoUrl = ref('')
const videoError = ref(false)
let localVideoUrl = ''
const isPlaying = ref(false)

const videoProgressPct = computed(() => (
  Math.min(100, Math.max(0, ((absoluteVideoSec.value ?? questionStartSec.value) / totalPresentationDurationSec.value) * 100))
))
const toggleVideoPlay = () => {
  const el = videoEl.value
  if (!el) return
  if (el.paused) {
    const p = el.play()
    if (p?.catch) p.catch(() => {})
  } else {
    el.pause()
  }
}
const scrubFromClientX = (clientX, el) => {
  const rect = el.getBoundingClientRect()
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  seekAbsolute(pct * totalPresentationDurationSec.value)
}
const onScrubPointerDown = (event) => {
  event.currentTarget.setPointerCapture(event.pointerId)
  scrubFromClientX(event.clientX, event.currentTarget)
}
const onScrubPointerMove = (event) => {
  if (event.buttons !== 1) return
  scrubFromClientX(event.clientX, event.currentTarget)
}

// 우측 자막은 슬라이드 단위가 아니라 전체 발화를 시간순으로 이어서 보여준다
// (실제 발화 타임스탬프가 있으니 면접처럼 문장을 근사 배치할 필요가 없다).
const allSentences = computed(() => (
  [...transcripts.value]
    .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time))
    .map((t) => ({ atSec: timeToSeconds(t.time), text: t.text, slide: t.slide }))
))
const activeSentenceIndex = computed(() => {
  const list = allSentences.value
  const sec = absoluteVideoSec.value ?? questionStartSec.value
  let bestIdx = -1
  list.forEach((s, i) => { if (s.atSec <= sec) bestIdx = i })
  return bestIdx
})
const activeSentence = computed(() => {
  const idx = activeSentenceIndex.value
  return idx >= 0 ? allSentences.value[idx].text : ''
})
// 현재 문장을 카드 세로 중앙에 두고, 위아래로 몇 줄씩만 미리보기처럼 보여준다
// (지나온 문장은 위에 옅게, 아직 안 나온 문장은 아래에 옅게).
// 문장이 3개보다 적게 남은 구간(맨 처음/맨 끝)에서도 줄 수 자체는 항상
// 똑같이 유지해야 현재 줄이 진짜로 "고정된 중앙"에 있다 — 실제 문장이
// 모자라면 빈 줄로 채워서 자리만 차지하게 한다.
const CAPTION_WINDOW = 3
const priorSentences = computed(() => {
  const idx = activeSentenceIndex.value
  const real = allSentences.value.slice(Math.max(0, idx - CAPTION_WINDOW), Math.max(0, idx))
  return [...Array.from({ length: CAPTION_WINDOW - real.length }, () => null), ...real]
})
const nextSentences = computed(() => {
  const real = allSentences.value.slice(activeSentenceIndex.value + 1, activeSentenceIndex.value + 1 + CAPTION_WINDOW)
  return [...real, ...Array.from({ length: CAPTION_WINDOW - real.length }, () => null)]
})

// 좌(영상) 칸 렌더 높이를 우(슬라이드+자막) 칸에 그대로 맞춘다 — 자막 줄
// 수가 바뀌어도 카드 전체 높이가 출렁이지 않도록.
const videoColEl = ref(null)
const labelColHeight = ref(null)
let videoColResizeObserver = null

// ── 하단: 내용 / 질의응답 탭 ──
const bottomTab = ref('content')
const contentIssueOpen = ref(false)
// 슬라이드 하나의 실제 발화를 이어붙이고, 그중 "내용"(evidence) 카테고리
// 문제 구간이 있으면 그 문장을 지표 배지와 함께 짚어준다.
const slideContent = computed(() => {
  const idx = selectedSlide.value
  const items = transcripts.value.filter((t) => t.slide === idx)
  const answer = items.map((t) => t.text).join(' ')
  const problemItem = items.find((t) => segmentCategory(t) === 'content')
  return {
    answer: answer || '이 슬라이드 구간에 기록된 발화가 없어요.',
    problem: problemItem?.text ?? '',
    metric: '슬라이드 일치',
    feedback: problemItem?.reason ?? '',
  }
})
const contentAnswerParts = computed(() => {
  const item = slideContent.value
  const idx = item.problem ? item.answer.indexOf(item.problem) : -1
  if (idx === -1) return { before: item.answer, problem: '', after: '' }
  return { before: item.answer.slice(0, idx), problem: item.problem, after: item.answer.slice(idx + item.problem.length) }
})
const selectContentSlide = (index) => {
  selectReportSlide(index)
  contentIssueOpen.value = false
}

const toggleQnaIssue = (index) => {
  openQnaIssue.value = openQnaIssue.value === index ? null : index
}
const openQnaIssue = ref(null)
const answerParts = (item) => {
  const idx = item.problem ? item.answer.indexOf(item.problem) : -1
  if (idx === -1) return { before: item.answer, problem: item.problem || '', after: '' }
  return { before: item.answer.slice(0, idx), problem: item.problem, after: item.answer.slice(idx + item.problem.length) }
}

onMounted(async () => {
  if (recordId.value) {
    try {
      detailedSession.value = await archive.loadRecord(recordId.value)
    } catch {
      // 전용 개별 리포트 API가 없는 환경에서는 로컬에 실제로 보관된 완료
      // 결과만 유지한다. 네트워크 오류를 가짜 리포트로 채우지 않는다.
      detailedSession.value = archive.find(recordId.value)
    }
    if (recordId.value === String(presentation.sessionId)) {
      if (!presentation.report) await presentation.loadReport()
      detailedSession.value = {
        ...(detailedSession.value ?? {}),
        id: recordId.value,
        type: 'presentation',
        title: detailedSession.value?.title ?? presentation.title,
        durationSeconds: detailedSession.value?.durationSeconds ?? presentation.recordedSeconds,
        duration: detailedSession.value?.duration ?? `${Math.floor(presentation.recordedSeconds / 60)}분 ${String(presentation.recordedSeconds % 60).padStart(2, '0')}초`,
        ...presentation.report,
        slides: Array.isArray(presentation.report?.slides) && presentation.report.slides.length
          ? presentation.report.slides
          : presentation.slides,
        transcripts: Array.isArray(presentation.report?.transcripts) && presentation.report.transcripts.length
          ? presentation.report.transcripts
          : presentation.transcriptEvents,
      }
    }
  }

  if (recordId.value === String(presentation.sessionId) && recording.mediaBlob) {
    localVideoUrl = URL.createObjectURL(recording.mediaBlob)
    videoUrl.value = localVideoUrl
  } else {
    videoUrl.value = detailedSession.value?.recordingUrl ?? session.value.recordingUrl ?? ''
  }

  if (videoColEl.value && typeof ResizeObserver !== 'undefined') {
    videoColResizeObserver = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height
      if (h) labelColHeight.value = h
    })
    videoColResizeObserver.observe(videoColEl.value)
  }
})
onBeforeUnmount(() => {
  if (localVideoUrl) URL.revokeObjectURL(localVideoUrl)
  videoColResizeObserver?.disconnect()
})
</script>

<template>
  <main class="archive-report-shell metric-report-shell">
    <RouterLink :to="folderBackLink" class="archive-report-back">폴더 상세로 돌아가기</RouterLink>

    <section class="archive-report-summary" aria-label="연습 정보와 분석 결과">
      <div class="archive-report-info">
        <h1>{{ title }}</h1>
        <p v-if="description" class="archive-report-desc">{{ description }}</p>
        <dl class="archive-report-meta">
          <div><dt>연습 날짜</dt><dd>{{ reportDate }}</dd></div>
          <div><dt>슬라이드 개수</dt><dd>{{ slides.length }}개</dd></div>
          <div><dt>녹화 시간</dt><dd>{{ toClock(durationSeconds) }}</dd></div>
        </dl>
      </div>

      <div class="archive-report-metrics">
        <header>
          <div><span>연습 결과</span><strong>{{ finalScore }}점</strong></div>
          <small>최근 평균 대비 +7점</small>
        </header>
        <dl>
          <div class="archive-score-metric" tabindex="0">
            <dt>음성<span class="archive-score-hint" aria-hidden="true">?</span></dt><dd>{{ scoreMetrics.voiceScore }}점</dd>
            <aside class="archive-score-detail"><strong>음성 평가 지표</strong><dl class="archive-score-breakdown"><div><dt><span class="iv-term-hint" tabindex="0">필러<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span></dt><dd>{{ VOICE_DETAIL.filler.total }}회</dd></div><div><dt>말 속도</dt><dd>{{ VOICE_DETAIL.avgPace }}</dd></div><div><dt>침묵</dt><dd>{{ VOICE_DETAIL.longSilence }}</dd></div></dl></aside>
          </div>
          <div class="archive-score-metric" tabindex="0">
            <dt>몸짓<span class="archive-score-hint" aria-hidden="true">?</span></dt><dd>{{ scoreMetrics.videoScore }}점</dd>
            <aside class="archive-score-detail"><strong>몸짓 평가 지표</strong><dl class="archive-score-breakdown"><div><dt>시선 이탈</dt><dd>6회</dd></div><div><dt>기울기</dt><dd>4회</dd></div></dl></aside>
          </div>
          <div class="archive-score-metric" tabindex="0">
            <dt>내용<span class="archive-score-hint" aria-hidden="true">?</span></dt><dd>{{ scoreMetrics.contentScore }}점</dd>
            <aside class="archive-score-detail"><strong>내용 평가 지표</strong><dl class="archive-score-breakdown"><div><dt>발표 내용 적절성</dt><dd>88%</dd></div><div><dt>슬라이드 일치</dt><dd>92%</dd></div><div><dt>질의응답 적절성</dt><dd>76%</dd></div></dl></aside>
          </div>
        </dl>
      </div>
    </section>

    <div class="iv-section-divider" aria-hidden="true"></div>

    <!-- 섹션1: 음성/몸짓 탭 — 슬라이드 단위로 나눠서 보여준다 -->
    <section class="iv-metric-tabs" aria-label="음성·몸짓 지표">
      <div class="iv-metric-tabs-head">
        <div class="iv-metric-tabhead">
          <button type="button" class="iv-metric-tab" :class="{ 'is-active': metricTab === 'voice' }" @click="metricTab = 'voice'">음성</button>
          <button type="button" class="iv-metric-tab" :class="{ 'is-active': metricTab === 'video' }" @click="metricTab = 'video'">몸짓</button>
          <span class="iv-metric-tab-question">슬라이드 {{ selectedSlide + 1 }}</span>
        </div>
        <div v-if="metricTab === 'voice'" class="iv-pace-legend">
          <span class="iv-pace-legend-item is-slow"><i>▼</i>가장 느린 구간</span>
          <span class="iv-pace-legend-item is-fast"><i>▲</i>가장 빠른 구간</span>
          <span class="iv-pace-legend-item is-filler"><i></i><span class="iv-term-hint" tabindex="0">필러<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span></span>
          <span class="iv-pace-legend-item is-silence"><i></i>침묵 구간</span>
        </div>
        <div v-else class="iv-pace-legend">
          <span class="iv-pace-legend-item is-gaze-dot"><i></i>시선 이탈</span>
          <span class="iv-pace-legend-item is-tilt-line"><i></i>기울기</span>
        </div>
      </div>

      <div v-if="metricTab === 'voice'" class="iv-pace-panel">
        <div class="iv-pace-meta iv-pace-meta-compact">
          <span class="iv-pace-meta-range">{{ paceYBounds.lo.toFixed(1) }}–{{ paceYBounds.hi.toFixed(1) }}음절 범위</span>
        </div>
        <div
          ref="paceChartEl"
          class="iv-pace-chart"
          @pointerdown="onChartPointerDown"
          @pointermove="onChartPointerMove"
          @pointerleave="onChartHoverLeave"
        >
          <div class="iv-pace-avg-line" :style="avgLineStyle">
            <span class="iv-pace-avg-label">평균 속도 · 초당 {{ currentSlideVoicePace.avgPace.toFixed(1) }}음절</span>
          </div>
          <span
            v-for="(sil, i) in silenceSegments"
            :key="`sil-${i}`"
            class="iv-pace-silence-bg"
            :style="{ left: `${sil.leftPct}%`, width: `${sil.widthPct}%` }"
            role="button"
            tabindex="0"
            :aria-label="`1초 이상 정적 ${toClock(slideStartSecAt(selectedSlide) + sil.startSec)}–${toClock(slideStartSecAt(selectedSlide) + sil.endSec)}`"
            @click="seekVoice(sil.startSec)"
          ></span>
          <svg class="iv-pace-svg" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
            <path :d="paceChartPath" class="iv-pace-step-line" />
          </svg>
          <div
            v-if="hoverPct != null && !isDraggingPlayhead"
            class="iv-pace-crosshair"
            :style="{ left: `${hoverPct}%` }"
            aria-hidden="true"
          >
            <span class="iv-pace-crosshair-badge">{{ toClock(slideStartSecAt(selectedSlide) + hoverSec) }} · 초당 {{ paceAtSec(hoverSec).toFixed(1) }}음절</span>
          </div>
          <div
            v-if="playheadPct != null"
            class="iv-pace-playhead"
            :style="{ left: `${playheadPct}%`, top: `${playheadYPct}%` }"
          >
            <span class="iv-pace-playhead-time">{{ toClock(slideStartSecAt(selectedSlide) + activeSec) }}</span>
            <button
              type="button"
              class="iv-pace-playhead-dot"
              aria-label="재생 위치 드래그"
              @pointerdown="onPlayheadPointerDown"
              @pointermove="onPlayheadPointerMove"
              @pointerup="onPlayheadPointerUp"
              @pointercancel="onPlayheadPointerUp"
            ></button>
          </div>
          <button
            v-for="(f, i) in fillerDotPositions"
            :key="`filler-${i}`"
            type="button"
            class="iv-pace-filler-dot"
            :style="{ left: `${f.xPct}%`, top: `${f.yPct}%` }"
            :aria-label="`필러 '${f.word}' ${toClock(slideStartSecAt(selectedSlide) + f.atSec)} · 영상 이동`"
            @click="seekVoice(f.atSec)"
          ></button>
        </div>
        <div class="iv-pace-range-lane" aria-label="발화 속도 구간">
          <button
            type="button"
            class="iv-pace-range-mark"
            :style="{ left: `${rangeOverlays.slow.leftPct}%`, width: `${rangeOverlays.slow.widthPct}%` }"
            :aria-label="`가장 느린 구간 ${toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.slowest.startSec)}–${toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.slowest.endSec)} · 영상 이동`"
            @click="seekVoice(currentSlideVoicePace.slowest.startSec)"
          >
            <span class="iv-pace-range-icon">▼</span>
            <span class="iv-pace-range-bracket"></span>
            <span class="iv-pace-range-value">{{ currentSlideVoicePace.slowest.pace.toFixed(1) }}</span>
          </button>
          <button
            type="button"
            class="iv-pace-range-mark"
            :style="{ left: `${rangeOverlays.fast.leftPct}%`, width: `${rangeOverlays.fast.widthPct}%` }"
            :aria-label="`가장 빠른 구간 ${toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.fastest.startSec)}–${toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.fastest.endSec)} · 영상 이동`"
            @click="seekVoice(currentSlideVoicePace.fastest.startSec)"
          >
            <span class="iv-pace-range-icon">▲</span>
            <span class="iv-pace-range-bracket"></span>
            <span class="iv-pace-range-value">{{ currentSlideVoicePace.fastest.pace.toFixed(1) }}</span>
          </button>
        </div>
        <div class="iv-pace-axis-edges">
          <span>{{ toClock(slideStartSecAt(selectedSlide)) }}</span>
          <span>{{ toClock(slideStartSecAt(selectedSlide) + slideDurationSec) }}</span>
        </div>
        <div class="iv-pace-chips">
          <span class="iv-pace-chip is-filler"><span class="iv-term-hint" tabindex="0">필러<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span> {{ currentSlideVoicePace.fillerTotal }}회<small>{{ currentSlideVoicePace.fillerBreakdown.map(([w, n]) => `${w} ${n}회`).join(' · ') }}</small></span>
          <span class="iv-pace-chip is-silence">1초 이상 정적 {{ currentSlideVoicePace.longSilenceCount }}회</span>
          <span class="iv-pace-chip is-slow">▼ 가장 느린 구간 {{ paceMarkers.find((m) => m.key === 'slow')?.pace }}<small>{{ toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.slowest.startSec) }}–{{ toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.slowest.endSec) }}</small></span>
          <span class="iv-pace-chip is-fast">▲ 가장 빠른 구간 {{ paceMarkers.find((m) => m.key === 'fast')?.pace }}<small>{{ toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.fastest.startSec) }}–{{ toClock(slideStartSecAt(selectedSlide) + currentSlideVoicePace.fastest.endSec) }}</small></span>
        </div>
      </div>

      <div v-else class="iv-video-panel">
        <div class="iv-pace-panel">
          <div class="iv-pace-meta iv-pace-meta-compact">
            <span class="iv-pace-meta-range">{{ tiltYBounds.lo.toFixed(0) }}–{{ tiltYBounds.hi.toFixed(0) }}% 범위</span>
          </div>
          <div
            ref="gestureChartEl"
            class="iv-pace-chart"
            @pointerdown="onGestureChartPointerDown"
            @pointermove="onGestureChartPointerMove"
            @pointerleave="onGestureHoverLeave"
          >
            <div class="iv-pace-avg-line" :style="avgTiltLineStyle">
              <span class="iv-pace-avg-label">기울기 평균 · {{ avgTiltPct }}%</span>
            </div>
            <svg class="iv-pace-svg" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
              <path :d="tiltLinePath" class="iv-gesture-line is-tilt" />
            </svg>
            <div
              v-if="gestureHoverPct != null && !isDraggingGesturePlayhead"
              class="iv-pace-crosshair"
              :style="{ left: `${gestureHoverPct}%` }"
              aria-hidden="true"
            >
              <span class="iv-pace-crosshair-badge">{{ toClock(slideStartSecAt(selectedSlide) + gestureHoverSec) }} · 기울기 {{ formatTiltPercent(tiltValueAtSec(gestureHoverSec)) }}%</span>
            </div>
            <button
              v-for="(d, i) in gazeDotPositions"
              :key="`gaze-${i}`"
              type="button"
              class="iv-gesture-gaze-dot"
              :style="{ left: `${d.xPct}%`, top: `${d.yPct}%` }"
              :aria-label="`시선 이탈 ${toClock(slideStartSecAt(selectedSlide) + d.atSec)} · 영상 이동`"
              @click="seekVoice(d.atSec)"
            >
              <svg viewBox="0 0 20 14" class="iv-gesture-eye-svg" aria-hidden="true">
                <path d="M1,7 C4,1 16,1 19,7 C16,13 4,13 1,7 Z" class="iv-gesture-eye-outline" />
                <circle cx="10" cy="7" r="3" class="iv-gesture-eye-pupil" />
              </svg>
            </button>
            <div
              v-if="gesturePlayheadPct != null"
              class="iv-pace-playhead"
              :style="{ left: `${gesturePlayheadPct}%`, top: `${gesturePlayheadYPct}%` }"
            >
              <span class="iv-pace-playhead-time">{{ toClock(slideStartSecAt(selectedSlide) + activeSec) }}</span>
              <button
                type="button"
                class="iv-pace-playhead-dot"
                aria-label="재생 위치 드래그"
                @pointerdown="onGesturePlayheadPointerDown"
                @pointermove="onGesturePlayheadPointerMove"
                @pointerup="onGesturePlayheadPointerUp"
                @pointercancel="onGesturePlayheadPointerUp"
              ></button>
            </div>
          </div>
          <div class="iv-pace-axis-edges">
            <span>{{ toClock(slideStartSecAt(selectedSlide)) }}</span>
            <span>{{ toClock(slideStartSecAt(selectedSlide) + slideDurationSec) }}</span>
          </div>
        </div>

        <div class="iv-pace-chips">
          <span class="iv-pace-chip is-gaze">시선 이탈 {{ currentGestureSeries.gazeCount }}회</span>
          <span class="iv-pace-chip is-tilt">기울기 평균 {{ avgTiltPct }}%</span>
        </div>
      </div>
    </section>

    <!-- 섹션2: 좌 영상 / 우 슬라이드(양옆 이전·다음)+현재 위치 발화 -->
    <section class="iv-video-row" aria-label="발표 영상과 발화">
      <div ref="videoColEl" class="iv-video-col">
        <div class="report-video-box" :class="{ 'has-video': videoUrl && !videoError }">
          <video
            v-if="videoUrl && !videoError"
            ref="videoEl"
            class="report-video-player"
            :src="videoUrl"
            playsinline
            preload="metadata"
            @play="isPlaying = true"
            @pause="isPlaying = false"
            @error="videoError = true"
            @timeupdate="onVideoTimeUpdate"
          ></video>
          <p v-else-if="videoError" class="report-video-state" role="alert">
            녹화 영상을 불러오지 못했습니다. 리포트 내용은 계속 확인할 수 있어요.
          </p>
          <div v-else class="report-video-empty">녹화 영상이 없어요</div>
        </div>
        <div class="archive-slide-strip">
          <button type="button" class="archive-slide-arrow" aria-label="이전 슬라이드" @click="selectSlideAndSeek(selectedSlide - 1)">‹</button>
          <div class="archive-slide-thumbnails">
            <button
              v-for="(item, index) in slides"
              :key="index"
              type="button"
              class="archive-slide-thumb"
              :class="{ 'is-active': index === selectedSlide, 'has-image': item.thumbnailUrl || item.previewUrl }"
              @click="selectSlideAndSeek(index)"
            >
              <img
                v-if="item.thumbnailUrl || item.previewUrl"
                class="archive-slide-thumb-img"
                :src="item.thumbnailUrl || item.previewUrl"
                :alt="`${index + 1}번 슬라이드`"
              />
              <template v-else>
                <small>{{ String(index + 1).padStart(2, '0') }}</small>
                <strong>{{ item.title }}</strong>
              </template>
            </button>
          </div>
          <button type="button" class="archive-slide-arrow" aria-label="다음 슬라이드" @click="selectSlideAndSeek(selectedSlide + 1)">›</button>
        </div>
        <div class="iv-video-controls-bar">
          <button type="button" class="iv-video-play-btn" :aria-label="isPlaying ? '일시정지' : '재생'" @click="toggleVideoPlay">{{ isPlaying ? '⏸' : '▶' }}</button>
          <button
            type="button"
            class="iv-video-scrub"
            aria-label="재생 위치 이동"
            @pointerdown="onScrubPointerDown"
            @pointermove="onScrubPointerMove"
          >
            <span class="iv-video-scrub-fill" :style="{ width: `${videoProgressPct}%` }"></span>
          </button>
          <span class="iv-video-time">{{ toClock(Math.round(absoluteVideoSec ?? questionStartSec)) }} / {{ toClock(totalPresentationDurationSec) }}</span>
        </div>
      </div>
      <div class="iv-label-col" :style="labelColHeight ? { height: `${labelColHeight}px` } : null">
        <div class="iv-video-question-row">
          <button type="button" class="iv-rq-nav" :disabled="selectedSlide === 0" aria-label="이전 슬라이드" @click="prevSlide">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <h3 class="iv-video-question">슬라이드 {{ selectedSlide + 1 }}. {{ currentSlide.title }}</h3>
          <button type="button" class="iv-rq-nav" :disabled="selectedSlide === slides.length - 1" aria-label="다음 슬라이드" @click="nextSlide">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
        <div class="iv-caption-stack">
          <div class="iv-caption-prior-wrap">
            <p v-for="(s, i) in priorSentences" :key="`prior-${i}`" class="iv-caption-line iv-caption-prior" :class="{ 'is-empty': !s }">{{ s?.text }}</p>
          </div>
          <p class="iv-caption-line iv-caption-current">{{ activeSentence || '위 표시나 영상을 재생해보세요.' }}</p>
          <div class="iv-caption-next-wrap">
            <p v-for="(s, i) in nextSentences" :key="`next-${i}`" class="iv-caption-line iv-caption-next" :class="{ 'is-empty': !s }">{{ s?.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 하단: 내용 / 질의응답 탭 -->
    <section class="archive-report-feedback" aria-label="내용·질의응답 피드백">
      <h2 class="iv-rq-area-title">{{ bottomTab === 'content' ? '슬라이드 내용 피드백' : '질의응답 피드백' }}</h2>
      <div class="iv-metric-tabhead" style="margin-bottom: 18px;">
        <button type="button" class="iv-metric-tab" :class="{ 'is-active': bottomTab === 'content' }" @click="bottomTab = 'content'">내용</button>
        <button type="button" class="iv-metric-tab" :class="{ 'is-active': bottomTab === 'qna' }" @click="bottomTab = 'qna'">질의응답</button>
      </div>

      <div v-if="bottomTab === 'content'" class="archive-slide-feedback-layout">
        <aside class="archive-slide-feedback-nav" aria-label="슬라이드 목록">
          <p class="archive-slide-feedback-nav-title">슬라이드</p>
          <div class="archive-slide-feedback-list">
            <button
              v-for="(item, index) in slides"
              :key="item.id ?? index"
              type="button"
              class="archive-slide-feedback-thumb"
              :class="{ 'is-active': index === selectedSlide }"
              :aria-label="`${index + 1}번 슬라이드 ${item.title}`"
              :aria-current="index === selectedSlide ? 'true' : undefined"
              @click="selectContentSlide(index)"
            >
              <span class="archive-slide-feedback-visual">
                <img
                  v-if="item.thumbnailUrl || item.previewUrl"
                  :src="item.thumbnailUrl || item.previewUrl"
                  :alt="`${index + 1}번 슬라이드 미리보기`"
                />
                <span v-else class="archive-slide-feedback-placeholder" aria-hidden="true">
                  S{{ index + 1 }}
                </span>
              </span>
            </button>
          </div>
        </aside>

        <section class="archive-slide-feedback-detail iv-rq-answer-col" aria-live="polite">
          <h3 class="iv-rq-q-title">
            <span class="iv-rq-q-title-text">슬라이드 {{ selectedSlide + 1 }}. {{ currentSlide.title }}</span>
          </h3>
          <span class="iv-rq-answer-label">
            AI 피드백<span v-if="slideContent.problem"> · 문제 구간을 눌러 상세를 확인하세요</span>
          </span>
          <div class="archive-feedback-stack archive-qna-list archive-slide-speech iv-rq-answer">
            <article class="archive-qna-item">
              <p class="archive-qna-answer">{{ contentAnswerParts.before
                }}<button
                  v-if="slideContent.problem"
                  type="button"
                  class="archive-qna-problem archive-qna-issue-toggle"
                  :aria-expanded="contentIssueOpen"
                  @click="contentIssueOpen = !contentIssueOpen"
                >{{ contentAnswerParts.problem }}</button>{{ contentAnswerParts.after }}</p>
            </article>
            <Transition name="qna-issue">
              <div v-if="slideContent.problem && contentIssueOpen" class="archive-qna-issue-panel">
                <b>{{ slideContent.metric }} 지표 · 보완 필요</b>
                <p>{{ slideContent.feedback || '이 구간의 내용을 슬라이드 핵심 메시지와 더 직접적으로 연결해보세요.' }}</p>
              </div>
            </Transition>
          </div>
        </section>
      </div>

      <div v-else class="archive-feedback-stack archive-qna-list">
        <template v-for="(item, index) in qnaAnswers" :key="index">
          <article class="archive-qna-item">
            <strong class="archive-qna-question"><span>Q{{ index + 1 }}</span>{{ item.question }}</strong>
            <p class="archive-qna-answer">
              {{ answerParts(item).before
              }}<button
                v-if="item.problem"
                type="button"
                class="archive-qna-problem archive-qna-issue-toggle"
                :aria-expanded="openQnaIssue === index"
                @click="toggleQnaIssue(index)"
              >{{ answerParts(item).problem }}</button>{{ answerParts(item).after }}
            </p>
          </article>
          <Transition name="qna-issue">
            <div v-if="item.problem && openQnaIssue === index" class="archive-qna-issue-panel">
              <b>{{ item.label }}</b>
              <p>{{ item.feedback }}</p>
            </div>
          </Transition>
        </template>
      </div>
    </section>
  </main>
</template>
