<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'

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

// 연습 날짜가 기록에 없으면(데모/방금 끝난 세션) 오늘 날짜로 표시한다.
const reportDate = computed(() => {
  const d = session.value.date
  if (d && d !== '-') return d
  const now = new Date()
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
})

const metrics = computed(() => {
  const values = session.value.metrics ?? session.value.analysis?.metrics ?? {}
  return {
    wpm: Number(values.wpm ?? 128),
    eye: Number(values.gazeHold ?? values.eye ?? 74),
    filler: Number(values.fillerCount ?? values.filler ?? 3),
  }
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
const getMetricStatus = (kind, value) => {
  if (kind === 'wpm') return value < 110 ? '느림' : value > 150 ? '빠름' : '적당'
  if (kind === 'eye') return value < 60 ? '보완 필요' : value >= 80 ? '매우 좋음' : '좋음'
  return value <= 2 ? '안정' : value <= 5 ? '보통' : '보완 필요'
}

const FALLBACK_SLIDES = [
  { title: '서비스 소개 발표', summary: '발표 목표와 서비스가 해결하는 문제를 소개합니다.' },
  { title: '문제와 해결 방법', summary: '기존 발표 연습 과정의 불편과 AIVO의 해결 방식을 설명합니다.' },
  { title: '핵심 기능과 기대효과', summary: '실시간 분석과 반복 연습이 만드는 변화를 보여줍니다.' },
  { title: '마무리', summary: '핵심 가치를 요약하고 다음 행동을 제안합니다.' },
]
const FALLBACK_TRANSCRIPTS = [
  { time: '00:00', slide: 0, kind: 'match', label: '핵심 내용 일치', text: '안녕하세요, 오늘 발표를 맡은 발표자입니다.' },
  { time: '01:02', slide: 1, kind: 'match', label: '핵심 내용 일치', text: '저희 서비스는 발표와 면접 연습을 돕는 AI 코칭 플랫폼입니다.' },
  { time: '02:18', slide: 2, kind: 'filler', label: '습관어 2회', text: '사용자가 반복적으로, 음, 말하기 습관을 개선할 수 있도록 설계했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 핵심 메시지의 자신감을 낮춥니다.', stats: [{ label: '"음"', value: '2회' }, { label: '"어"', value: '1회' }, { label: '말 더듬음', value: '1회' }] },
  { time: '03:47', slide: 2, kind: 'evidence', label: '근거 보완', text: '실시간 분석을 통해 발표 준비 시간을 줄일 수 있습니다.', reason: '시간을 얼마나 줄일 수 있는지 수치나 실제 사례가 없어 설득력이 약합니다.', stats: [{ label: '정량 근거', value: '0건' }, { label: '구체 사례', value: '0건' }] },
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
const durationLabel = computed(
  () => `총 ${Math.floor(durationSeconds.value / 60)}:${String(durationSeconds.value % 60).padStart(2, '0')}`,
)
const issueSegments = computed(() => transcripts.value.filter((t) => t.kind !== 'match'))

const selectedSlide = ref(0)
const transcriptFilter = ref('all')
const feedbackTab = ref('content')
const expandedIssueTime = ref(null)
const selectedIssueTime = ref(null)
const openQnaIssue = ref(null)

// 발화 필터: 음성/영상/내용 일치 대분류 + 각 하위 지표.
const FILTER_GROUPS = [
  {
    key: 'voice',
    label: '음성',
    metrics: [
      { key: 'filler', label: '습관어' },
      { key: 'pace', label: '말 속도' },
      { key: 'silence', label: '정적' },
    ],
  },
  {
    key: 'video',
    label: '영상',
    metrics: [
      { key: 'motion', label: '몸 움직임' },
      { key: 'gaze', label: '시선 이탈' },
    ],
  },
  {
    key: 'content',
    label: '내용 일치',
    metrics: [
      { key: 'contentMatch', label: '내용 일치' },
    ],
  },
]
const showFilterModal = ref(false) // 필터 드롭다운 열림 상태
const activeMetrics = ref(new Set())
const expandedGroups = ref(new Set())

// 발화 구간을 하위 지표로 매핑(데모: kind 기반). 실데이터에 item.metric 이 있으면 우선.
const transcriptMetric = (item) => {
  if (item.metric) return item.metric
  if (item.kind === 'filler') return 'filler'
  if (item.kind === 'pace') return 'pace'
  if (item.kind === 'silence') return 'silence'
  if (item.kind === 'motion') return 'motion'
  if (item.kind === 'gaze') return 'gaze'
  return 'contentMatch'
}
// 하위 지표 → 대분류(음성/영상/내용) 키.
const metricCategory = (key) =>
  FILTER_GROUPS.find((g) => g.metrics.some((m) => m.key === key))?.key ?? 'content'
const segmentCategory = (segment) => metricCategory(transcriptMetric(segment))

// 음성 세부 지표(데모): 문제 구간(음성)을 클릭하면 펼쳐 보여준다.
const VOICE_DETAIL = {
  filler: { total: 19, breakdown: '어 15회 · 그 3회 · 음 1회' },
  paceNote: '말하기 속도는 습관어와 정적을 제외한, 실제 발화 구간의 평균 속도입니다.',
  avgPace: '초당 3.9음절',
  slowest: { range: '00:14–00:19', pace: '초당 1.9음절' },
  fastest: { range: '01:14–01:20', pace: '초당 5.0음절' },
  longSilence: '0회',
}
const activeFilterCount = computed(() => activeMetrics.value.size)
const groupMetricKeys = (group) => group.metrics.map((m) => m.key)
const isMetricOn = (key) => activeMetrics.value.has(key)
const isGroupAllOn = (group) => groupMetricKeys(group).every((k) => activeMetrics.value.has(k))
const isGroupAnyOn = (group) => groupMetricKeys(group).some((k) => activeMetrics.value.has(k))
const isGroupExpanded = (key) => expandedGroups.value.has(key)
const toggleMetric = (key) => {
  const next = new Set(activeMetrics.value)
  next.has(key) ? next.delete(key) : next.add(key)
  activeMetrics.value = next
}
const toggleGroup = (group) => {
  const keys = groupMetricKeys(group)
  const next = new Set(activeMetrics.value)
  if (keys.every((k) => next.has(k))) keys.forEach((k) => next.delete(k))
  else keys.forEach((k) => next.add(k))
  activeMetrics.value = next
  expandedGroups.value = new Set(expandedGroups.value).add(group.key)
}
const toggleExpandGroup = (key) => {
  const next = new Set(expandedGroups.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expandedGroups.value = next
}
const clearMetrics = () => { activeMetrics.value = new Set() }
const videoEl = ref(null)
const videoUrl = ref('')
const videoError = ref(false)
const videoStarted = ref(false)
const isPlaying = ref(false)
let localVideoUrl = ''

const playVideo = () => {
  const p = videoEl.value?.play()
  if (p?.catch) p.catch(() => {})
}
// 재생 중 화면 호버 시 뜨는 버튼: 재생/일시정지 토글.
const togglePlay = () => {
  const el = videoEl.value
  if (!el) return
  if (el.paused) playVideo()
  else el.pause()
}

const currentSlide = computed(() => slides.value[selectedSlide.value] ?? FALLBACK_SLIDES[0])
const visibleTranscripts = computed(() => {
  let list = transcriptFilter.value === 'all' ? transcripts.value : transcripts.value.filter((t) => t.kind !== 'match')
  if (activeMetrics.value.size) list = list.filter((t) => activeMetrics.value.has(transcriptMetric(t)))
  return list
})
const getSegmentReason = (segment) =>
  segment.reason ||
  (segment.kind === 'filler'
    ? '불필요한 습관어가 문장의 흐름과 전달 집중도를 낮춥니다.'
    : '주장을 뒷받침할 수치나 사례를 한 문장으로 보완해보세요.')

// 문제 구간 토글 내용: 문장 대신 객관적 지표(습관어 횟수 등)로 표시.
const segmentStats = (segment) => {
  if (Array.isArray(segment.stats) && segment.stats.length) return segment.stats
  if (segment.kind === 'filler') {
    const count = String(segment.label || '').replace(/[^0-9]/g, '') || '2'
    return [{ label: '습관어', value: `${count}회` }]
  }
  if (segment.kind === 'evidence') return [{ label: '정량 근거', value: '0건' }, { label: '구체 사례', value: '0건' }]
  return [{ label: '핵심 내용 일치', value: '양호' }]
}

const selectReportSlide = (index) => {
  selectedSlide.value = Math.max(0, Math.min(slides.value.length - 1, index))
}
const seekToSegment = (segment) => {
  const player = videoEl.value
  if (!player) return
  player.currentTime = Math.min(timeToSeconds(segment.time), Number.isFinite(player.duration) ? player.duration : Infinity)
  const playPromise = player.play()
  if (playPromise?.catch) playPromise.catch(() => {})
}
const focusSegment = (segment, nextFilter = transcriptFilter.value) => {
  selectedIssueTime.value = segment.time
  transcriptFilter.value = nextFilter
  selectReportSlide(segment.slide)
  seekToSegment(segment)
}
const onTranscriptClick = (segment) => {
  if (transcriptFilter.value === 'improve') {
    expandedIssueTime.value = expandedIssueTime.value === segment.time ? null : segment.time
    focusSegment(segment, 'improve')
    return
  }
  focusSegment(segment)
}
const setFilter = (filter) => {
  transcriptFilter.value = filter
}
const toggleQnaIssue = (index) => {
  openQnaIssue.value = openQnaIssue.value === index ? null : index
}
const answerParts = (item) => {
  const idx = item.problem ? item.answer.indexOf(item.problem) : -1
  if (idx === -1) return { before: item.answer, problem: item.problem || '', after: '' }
  return { before: item.answer.slice(0, idx), problem: item.problem, after: item.answer.slice(idx + item.problem.length) }
}

// AI 피드백: 범주별 마크다운 보고서. 실제 서비스에서는 LLM이 생성한 마크다운을
// 그대로 내려주고, 여기서 렌더링만 한다(내용 일치 / 비언어 전달 / 질의응답 3종).
const FEEDBACK_REPORTS = {
  content: `## 내용 일치 종합 분석

발표 자료(슬라이드)의 핵심 메시지와 실제 발화의 일치 정도를 분석했습니다.

### 핵심 요약
- **슬라이드 일치도 92%** — 대부분의 핵심 메시지가 발화에 명확히 포함되었습니다.
- 슬라이드 3의 **성과 근거**(사용자 변화·시간 절감 수치)가 발화에서 빠졌습니다.

### 잘한 점
- 서비스의 문제 정의와 해결 방식이 슬라이드 흐름대로 자연스럽게 전달되었습니다.
- 핵심 용어를 슬라이드와 동일하게 사용해 청중이 내용을 따라가기 쉬웠습니다.

### 개선 제안
- 정량 근거를 한 문장 덧붙이세요. 예) "반복 연습을 통해 발표 준비 시간을 30% 줄일 수 있습니다."
- 마지막 슬라이드에서 핵심 메시지를 한 번 더 요약하면 전달력이 높아집니다.`,
  delivery: `## 비언어 전달 분석

말하기 속도, 습관어, 시선·자세 등 전달 요소를 종합했습니다.

### 핵심 지표
- **말하기 속도 128 WPM** — 권장 범위(110~140) 안으로 안정적입니다.
- **습관어 7회** — "음/어"가 반복되어 문장 흐름을 끊었습니다.
- **시선 유지 74%** — 핵심 문장에서 시선 이탈이 관찰되었습니다.

### 개선 제안
- 문장 사이 0.5초의 의도적인 멈춤으로 습관어를 대체해보세요.
- 결론 부분에서는 속도를 조금 늦추고 정면 시선을 더 오래 유지하세요.`,
  qna: `## 질의응답 피드백

받은 질문에 대한 답변의 명확성과 근거를 분석했습니다.

### Q1. 서비스 차별점
- 핵심은 잘 짚었으나 답변 서두의 **"음"** 습관어가 자신감을 낮췄습니다.
- 차별점을 먼저 한 문장으로 제시한 뒤 근거를 붙이면 더 명확합니다.

### Q2. 기대 효과
- 효과를 정성적으로만 설명해 설득력이 약했습니다.
- **수치·사례**를 함께 제시하세요. 예) "발표 준비 시간 30% 단축".`,
}

// 경량 마크다운 → HTML (제목/굵게/코드/목록/문단). 데모 콘텐츠 전용.
const renderMarkdown = (md) => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
  const out = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const raw of String(md).split('\n')) {
    const line = raw.trim()
    if (!line) { closeList(); continue }
    let m
    if ((m = line.match(/^###\s+(.*)/))) { closeList(); out.push(`<h4>${inline(m[1])}</h4>`) }
    else if ((m = line.match(/^##\s+(.*)/))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`) }
    else if ((m = line.match(/^#\s+(.*)/))) { closeList(); out.push(`<h2>${inline(m[1])}</h2>`) }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(m[1])}</li>`) }
    else { closeList(); out.push(`<p>${inline(line)}</p>`) }
  }
  closeList()
  return out.join('')
}
const feedbackReportHtml = computed(() => renderMarkdown(FEEDBACK_REPORTS[feedbackTab.value] || ''))

const issueRange = (segment) => {
  const center = timeToSeconds(segment.time)
  const start = Math.max(0, center - 8)
  const end = Math.min(durationSeconds.value, center + 8)
  return {
    '--range-left': `${(start / durationSeconds.value) * 100}%`,
    '--range-width': `${Math.max(3, ((end - start) / durationSeconds.value) * 100)}%`,
  }
}
const issuePinLeft = (segment) => `${Math.min(98, (timeToSeconds(segment.time) / durationSeconds.value) * 100)}%`

// Section nav scroll spy.
const sections = [
  { id: 'reportSummary', label: '결과 요약' },
  { id: 'reportReview', label: '발표 복기' },
  { id: 'reportFeedback', label: 'AI 피드백' },
]
const activeSection = ref('reportSummary')
const updateActiveSection = () => {
  const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
  if (nearBottom) {
    activeSection.value = sections[sections.length - 1].id
    return
  }
  const marker = window.scrollY + Math.min(window.innerHeight * 0.32, 280)
  let active = sections[0].id
  for (const { id } of sections) {
    const el = document.getElementById(id)
    if (el && el.offsetTop <= marker) active = id
  }
  activeSection.value = active
}
const scrollToSection = (id) => {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  if (recordId.value) {
    detailedSession.value = await archive.loadRecord(recordId.value)
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

  window.addEventListener('scroll', updateActiveSection, { passive: true })
  window.addEventListener('resize', updateActiveSection)
  updateActiveSection()
})
onBeforeUnmount(() => {
  if (localVideoUrl) URL.revokeObjectURL(localVideoUrl)
  window.removeEventListener('scroll', updateActiveSection)
  window.removeEventListener('resize', updateActiveSection)
})
</script>

<template>
  <main class="archive-report-shell">
    <RouterLink :to="`/archive/folders?title=${encodeURIComponent(title)}`" class="archive-report-back">폴더 상세로 돌아가기</RouterLink>

    <nav class="archive-report-section-nav" aria-label="리포트 빠른 이동">
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        :class="{ 'is-active': activeSection === section.id }"
        :aria-current="activeSection === section.id ? 'location' : undefined"
        @click.prevent="scrollToSection(section.id)"
      ><span aria-hidden="true"></span>{{ section.label }}</a>
    </nav>

    <section class="archive-report-summary" id="reportSummary" aria-label="연습 정보와 분석 결과">
      <div class="archive-report-info">
        <h1>{{ title }}</h1>
        <dl class="archive-report-meta">
          <div><dt>연습 날짜</dt><dd>{{ reportDate }}</dd></div>
          <div><dt>슬라이드 개수</dt><dd>{{ slides.length }}개</dd></div>
          <div><dt>녹화 시간</dt><dd>{{ session.duration }}</dd></div>
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
            <aside class="archive-score-detail"><strong>음성 평가 지표</strong><dl class="archive-score-breakdown"><div><dt>필러</dt><dd>7회</dd></div><div><dt>말 더듬음</dt><dd>2회</dd></div><div><dt>말 속도</dt><dd>128 WPM</dd></div><div><dt>목소리 떨림</dt><dd>3회</dd></div><div><dt>긴 공백</dt><dd>4회</dd></div></dl></aside>
          </div>
          <div class="archive-score-metric" tabindex="0">
            <dt>영상<span class="archive-score-hint" aria-hidden="true">?</span></dt><dd>{{ scoreMetrics.videoScore }}점</dd>
            <aside class="archive-score-detail"><strong>영상 평가 지표</strong><dl class="archive-score-breakdown"><div><dt>시선 이탈</dt><dd>6회</dd></div><div><dt>표정 이상 감지</dt><dd>3회</dd></div><div><dt>자세와 움직임</dt><dd>4회</dd></div></dl></aside>
          </div>
          <div class="archive-score-metric" tabindex="0">
            <dt>내용 일치<span class="archive-score-hint" aria-hidden="true">?</span></dt><dd>{{ scoreMetrics.contentScore }}점</dd>
            <aside class="archive-score-detail"><strong>내용 평가 지표</strong><dl class="archive-score-breakdown"><div><dt>발표 내용 적절성</dt><dd>88%</dd></div><div><dt>슬라이드 일치</dt><dd>92%</dd></div><div><dt>질의응답 적절성</dt><dd>76%</dd></div></dl></aside>
          </div>
        </dl>
      </div>
    </section>

    <section class="archive-issue-timeline" aria-labelledby="issueTimelineTitle">
      <header>
        <h2 id="issueTimelineTitle">발표 흐름</h2>
        <span>{{ durationLabel }}</span>
      </header>
      <div class="archive-issue-track" aria-label="녹화 영상 발표 흐름">
        <div class="archive-issue-track-line" aria-hidden="true"></div>
        <span v-for="(segment, i) in issueSegments" :key="`r${i}`" class="archive-issue-range" :style="issueRange(segment)" aria-hidden="true"></span>
        <button
          v-for="(segment, index) in issueSegments"
          :key="`p${index}`"
          type="button"
          class="archive-issue-marker archive-issue-pin"
          :class="`is-${segment.kind}`"
          :style="{ '--issue-left': issuePinLeft(segment), '--pin-order': index + 1 }"
          :aria-label="`${segment.time} ${segment.label}`"
          @click="focusSegment(segment, 'improve')"
        ><b>{{ index + 1 }}</b><span>{{ segment.time }}</span></button>
      </div>
    </section>

    <section class="archive-report-content" id="reportReview" aria-label="발표 슬라이드와 실제 발화">
      <div class="archive-slide-review">
        <header><h2>발표 슬라이드</h2><span>슬라이드 {{ selectedSlide + 1 }} · {{ currentSlide.title }}</span></header>
        <div
          class="report-video-box"
          :class="{
            'has-video': videoUrl && !videoError,
            'has-image': !videoUrl && !videoError && currentSlide.previewUrl,
          }"
        >
          <video
            v-if="videoUrl && !videoError"
            ref="videoEl"
            class="report-video-player"
            :class="{ 'is-preview': !videoStarted }"
            :src="videoUrl"
            playsinline
            preload="metadata"
            @play="videoStarted = true; isPlaying = true"
            @pause="isPlaying = false"
            @error="videoError = true"
          ></video>
          <button
            v-if="videoUrl && !videoError && !videoStarted"
            type="button"
            class="report-video-play"
            aria-label="녹화 영상 재생"
            @click="playVideo"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button
            v-if="videoUrl && !videoError && videoStarted"
            type="button"
            class="report-video-hoverctl"
            :class="{ 'is-paused': !isPlaying }"
            :aria-label="isPlaying ? '일시정지' : '재생'"
            @click="togglePlay"
          >
            <svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <p v-if="videoError" class="report-video-state" role="alert">
            녹화 영상을 불러오지 못했습니다. 리포트 내용은 계속 확인할 수 있어요.
          </p>
          <img
            v-else-if="!videoUrl && currentSlide.previewUrl"
            class="report-video-image"
            :src="currentSlide.previewUrl"
            :alt="`${selectedSlide + 1}번 발표 슬라이드`"
          />
          <div v-else-if="!videoUrl" class="report-video-copy">
            <small>SLIDE {{ String(selectedSlide + 1).padStart(2, '0') }}</small>
            <strong>{{ currentSlide.title }}</strong>
            <p>{{ currentSlide.summary }}</p>
          </div>
        </div>
        <div class="archive-slide-strip">
          <button type="button" class="archive-slide-arrow" aria-label="이전 슬라이드" @click="selectReportSlide(selectedSlide - 1)">‹</button>
          <div class="archive-slide-thumbnails">
            <button
              v-for="(item, index) in slides"
              :key="index"
              type="button"
              class="archive-slide-thumb"
              :class="{ 'is-active': index === selectedSlide, 'has-image': item.thumbnailUrl || item.previewUrl }"
              @click="selectReportSlide(index)"
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
          <button type="button" class="archive-slide-arrow" aria-label="다음 슬라이드" @click="selectReportSlide(selectedSlide + 1)">›</button>
        </div>
      </div>

      <div class="archive-report-script">
        <header class="archive-report-script-head">
          <h2>슬라이드별 실제 발화</h2>
        </header>
        <div class="archive-report-tabs" aria-label="발화 필터">
          <button type="button" :class="{ 'is-active': transcriptFilter === 'all' }" @click="setFilter('all')">전체 발화</button>
          <button type="button" :class="{ 'is-active': transcriptFilter === 'improve' }" @click="setFilter('improve')">문제 구간</button>
          <div class="report-filter-wrap">
            <button
              type="button"
              class="report-filter-btn"
              :class="{ 'has-active': activeFilterCount }"
              aria-label="발화 필터"
              :aria-expanded="showFilterModal"
              @click="showFilterModal = !showFilterModal"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
              <span v-if="activeFilterCount" class="report-filter-count">{{ activeFilterCount }}</span>
            </button>
            <div v-if="showFilterModal" class="report-filter-pop" role="group" aria-label="발화 필터">
              <div v-for="group in FILTER_GROUPS" :key="group.key" class="report-filter-cat">
                <button
                  type="button"
                  class="report-filter-cat-tag"
                  :class="{ 'is-on': isGroupAnyOn(group) }"
                  :aria-pressed="isGroupAnyOn(group)"
                  @click="toggleGroup(group)"
                >{{ group.label }}</button>
                <div class="report-filter-chips">
                  <button
                    v-for="m in group.metrics"
                    :key="m.key"
                    type="button"
                    class="report-filter-chip"
                    :class="{ 'is-on': isMetricOn(m.key) }"
                    :aria-pressed="isMetricOn(m.key)"
                    @click="toggleMetric(m.key)"
                  >{{ m.label }}</button>
                </div>
              </div>
              <div class="report-filter-pop-foot">
                <button type="button" class="report-filter-reset" :disabled="!activeFilterCount" @click="clearMetrics">초기화</button>
              </div>
            </div>
          </div>
        </div>
        <div class="transcript-timeline">
          <template v-if="transcriptFilter === 'all'">
            <button
              v-for="(item, i) in visibleTranscripts"
              :key="i"
              type="button"
              class="archive-transcript-card archive-transcript-brief"
              :class="`is-${item.kind}`"
              @click="onTranscriptClick(item)"
            >
              <span>슬라이드 {{ item.slide + 1 }}</span>
              <p>{{ item.text }}</p>
            </button>
          </template>
          <template v-else-if="visibleTranscripts.length">
            <article
              v-for="(item, i) in visibleTranscripts"
              :key="i"
              class="archive-transcript-issue"
              :class="{ 'is-issue-focus': selectedIssueTime === item.time }"
            >
              <button
                type="button"
                class="archive-transcript-card archive-transcript-detail"
                :class="`is-${item.kind}`"
                :aria-expanded="expandedIssueTime === item.time"
                @click="onTranscriptClick(item)"
              >
                <span><b>{{ item.time }}</b> · 슬라이드 {{ item.slide + 1 }}</span>
                <em>{{ item.label }}</em>
                <p>{{ item.text }}</p>
              </button>
              <div class="archive-transcript-evidence" :class="{ 'is-open': expandedIssueTime === item.time }">
                <template v-if="segmentCategory(item) === 'voice'">
                  <strong>음성 전달 지표</strong>
                  <ul class="archive-voice-detail">
                    <li>
                      <div class="archive-voice-row"><span>습관어</span><b>{{ VOICE_DETAIL.filler.total }}회</b></div>
                      <small>{{ VOICE_DETAIL.filler.breakdown }}</small>
                    </li>
                    <li class="archive-voice-note">{{ VOICE_DETAIL.paceNote }}</li>
                    <li><div class="archive-voice-row"><span>평균 말하기 속도</span><b>{{ VOICE_DETAIL.avgPace }}</b></div></li>
                    <li>
                      <div class="archive-voice-row"><span>가장 느린 구간</span><b>{{ VOICE_DETAIL.slowest.range }}</b></div>
                      <small>{{ VOICE_DETAIL.slowest.pace }}</small>
                    </li>
                    <li>
                      <div class="archive-voice-row"><span>가장 빠른 구간</span><b>{{ VOICE_DETAIL.fastest.range }}</b></div>
                      <small>{{ VOICE_DETAIL.fastest.pace }}</small>
                    </li>
                    <li><div class="archive-voice-row"><span>1초 이상 정적</span><b>{{ VOICE_DETAIL.longSilence }}</b></div></li>
                  </ul>
                </template>
                <template v-else>
                  <strong>세부 지표</strong>
                  <ul class="archive-transcript-stats">
                    <li v-for="(s, si) in segmentStats(item)" :key="si">
                      <span>{{ s.label }}</span><b>{{ s.value }}</b>
                    </li>
                  </ul>
                </template>
              </div>
            </article>
          </template>
          <p v-else class="archive-empty-state">개선이 필요한 발화 구간이 없습니다.</p>
        </div>
      </div>
    </section>

    <section class="archive-report-feedback" id="reportFeedback" aria-labelledby="feedbackTitle">
      <header><h2 id="feedbackTitle">AI 피드백</h2></header>
      <div class="archive-feedback-tabs" aria-label="AI 피드백 유형">
        <button type="button" :class="{ 'is-active': feedbackTab === 'content' }" @click="feedbackTab = 'content'">내용 일치</button>
        <button type="button" :class="{ 'is-active': feedbackTab === 'delivery' }" @click="feedbackTab = 'delivery'">비언어 전달</button>
        <button type="button" :class="{ 'is-active': feedbackTab === 'qna' }" @click="feedbackTab = 'qna'">질의응답</button>
      </div>
      <div v-if="feedbackTab === 'qna'" class="archive-feedback-stack archive-qna-list">
        <article v-for="(item, index) in qnaAnswers" :key="index" class="archive-qna-item">
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
          <div v-if="item.problem" class="archive-qna-issue-panel" :class="{ 'is-open': openQnaIssue === index }" :hidden="openQnaIssue !== index">
            <b>{{ item.label }}</b>
            <p>{{ item.feedback }}</p>
          </div>
        </article>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else class="archive-feedback-report markdown-body" v-html="feedbackReportHtml"></div>
    </section>
  </main>

  <!-- 필터 드롭다운 바깥 클릭 시 닫기 (딤 없음) -->
  <div v-if="showFilterModal" class="report-filter-backdrop" aria-hidden="true" @click="showFilterModal = false"></div>
</template>
