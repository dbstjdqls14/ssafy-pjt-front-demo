<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'
import { useInterviewStore } from '../../stores/interviewStore.js'
import { useVoicePaceGraph } from '../../composables/useVoicePaceGraph.js'
import { formatTiltPercent, useGestureGraph } from '../../composables/useGestureGraph.js'
import { buildInterviewEvidenceParts, normalizeInterviewEvidence } from '../../utils/interviewEvidence.js'
import { buildQuestionPlaybackTimeline, questionIndexAtTime } from '../../utils/interviewTimeline.js'
import { normalizeReportScoreCards, toReportScore } from '../../utils/interviewReportScores.js'
import { formatCount, formatDecimal, formatScore } from '../../utils/displayFormatters.js'

const route = useRoute()
const archive = useArchiveStore()
const interview = useInterviewStore()
const reportLoading = ref(false)
const reportError = ref('')
const isOverallFeedbackExpanded = ref(false)

const isUnansweredAnswerText = (value) => {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return true
  return /^이 질문(?:에는|엔|은)? 답변하지 않았(?:어요|습니다)[.!]?$/.test(text)
    || /^등록된 답변이 없(?:어요|습니다)[.!]?$/.test(text)
}

const archivedSession = computed(() => archive.find(route.query.id))
const session = computed(() => {
  const apiReport = interview.report ?? {}
  const archived = archivedSession.value ?? {}
  return {
      type: 'interview',
      ...archived,
      ...apiReport,
      title: apiReport.title ?? archived.title ?? interview.title ?? '',
      description: apiReport.description ?? archived.description ?? interview.description ?? '',
      score: apiReport.overallScore ?? apiReport.score ?? archived.score ?? null,
      questions: apiReport.questionEvaluations
        ?? apiReport.questions
        ?? apiReport.questionResults
        ?? archived.questionEvaluations
        ?? archived.questions
        ?? [],
    }
})
const title = computed(() => session.value.title?.trim() || '면접 연습')
const description = computed(() => session.value.description?.trim() || '')
const returnFolderId = computed(() => (
  route.query.folderId ?? session.value.folderId ?? session.value.practiceFolderId ?? null
))
const folderBackLink = computed(() => (
  returnFolderId.value
    ? `/archive/folders/${encodeURIComponent(returnFolderId.value)}?type=interview`
    : '/archive'
))
const totalScore = computed(() => toReportScore(session.value.score, null))
const SHORT_INTERVIEW_THRESHOLD_SEC = 30
const isInterviewTooShort = computed(() => {
  const rawDuration = session.value.durationSeconds ?? session.value.durationSec
  if (rawDuration == null || rawDuration === '') return false
  const duration = Number(rawDuration)
  return Number.isFinite(duration) && duration >= 0 && duration < SHORT_INTERVIEW_THRESHOLD_SEC
})
const formatReportDate = (value) => {
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(String(value ?? ''))) return String(value)
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return String(value || '-')
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
const reportDate = computed(() => formatReportDate(
  session.value.date ?? session.value.completedAt ?? session.value.createdAt,
))
const contentEvaluation = computed(() => session.value.contentEvaluation ?? null)
const contentMetrics = computed(() => {
  const source = contentEvaluation.value ?? {}
  return [
    { label: '관련성', value: toReportScore(source.relevanceScore ?? source.relevance, null) },
    { label: '구조', value: toReportScore(source.structureScore ?? source.structure, null) },
    { label: '명확성', value: toReportScore(source.clarityScore ?? source.clarity, null) },
    { label: '전달력', value: toReportScore(source.deliveryScore ?? source.delivery, null) },
  ].filter((item) => item.value != null)
})
const contentSummary = computed(() => (
  contentEvaluation.value?.summary
  ?? contentEvaluation.value?.feedback
  ?? contentEvaluation.value?.overallFeedback
  ?? ''
))
const strengths = computed(() => (
  Array.isArray(session.value.strengths) ? session.value.strengths.filter(Boolean) : []
))
const improvements = computed(() => (
  Array.isArray(session.value.improvements) ? session.value.improvements.filter(Boolean) : []
))
const detailedFeedback = computed(() => String(session.value.detailedFeedback ?? '').trim())
const hasOverallFeedbackDetails = computed(() => (
  strengths.value.length || improvements.value.length || detailedFeedback.value
))
const hasOverallFeedback = computed(() => (
  contentMetrics.value.length || contentSummary.value || strengths.value.length || improvements.value.length || detailedFeedback.value
))

const voiceVideoEl = ref(null)
const voiceVideoUrl = ref('')
const videoDurationSec = ref(null)
let voiceVideoObjectUrl = ''
let pendingProgrammaticSeekSec = null
const voiceVideoKey = computed(() => [
  session.value.interviewId ?? route.query.id ?? 'none',
  session.value.video?.videoId ?? 'none',
  voiceVideoUrl.value,
].join(':'))

// 질문별 구간은 전체 세션 영상(한 개 파일) 안의 한 구간이므로, 그 질문 앞에
// 쌓인 이전 질문들의 길이를 더해 절대 초 단위 위치로 바꿔서 seek한다.
const questionStartSecAt = (index) => {
  if (index < questions.value.length && questions.value[index]?.isVideoMapped === false) return null
  const explicit = Number(questions.value[index]?.startSec)
  if (Number.isFinite(explicit) && explicit >= 0) return explicit
  let sum = 0
  for (let i = 0; i < index; i += 1) sum += questions.value[i]?.durationSec ?? 0
  return sum
}
const questionStartSec = computed(() => questionStartSecAt(selected.value))
// 영상·자막은 전체 녹화 기준(질문이 바뀌어도 안 끊긴다) — 실제 재생 위치를
// 절대 초로 들고, 그래프에서 쓰는 "질문 내 상대 초"는 여기서 파생시킨다.
const absoluteVideoSec = ref(null)
const explicitCaptionQuestionIndex = ref(null)
const activeSec = computed(() => (
  absoluteVideoSec.value == null || questionStartSec.value == null
    ? null
    : absoluteVideoSec.value - questionStartSec.value
))
const syncQuestionSelectionToVideo = (absSec) => {
  explicitCaptionQuestionIndex.value = null
  const index = questionIndexAtTime(questions.value, absSec)
  if (selected.value === index) return

  selected.value = index
  const page = Math.floor(index / PAGE)
  if (listPage.value !== page) listPage.value = page
}
// 그래프(질문 단위 상대 초)와 영상 하단 컨트롤(전체 녹화 절대 초)이 seek을
// 공유하는 지점 — 절대 초로 직접 이동하는 쪽이 기본형, 그래프 쪽 relSec은
// 여기에 questionStartSec을 더해 절대 초로 바꿔서 재사용한다.
const seekAbsolute = (absSec, preferredQuestionIndex = null) => {
  absoluteVideoSec.value = absSec
  if (Number.isInteger(preferredQuestionIndex) && questions.value[preferredQuestionIndex]) {
    explicitCaptionQuestionIndex.value = preferredQuestionIndex
    selected.value = preferredQuestionIndex
    const page = Math.floor(preferredQuestionIndex / PAGE)
    if (listPage.value !== page) listPage.value = page
  } else {
    syncQuestionSelectionToVideo(absSec)
  }
  const el = voiceVideoEl.value
  if (!el) return
  // 재생 중이 아니었다면(예: 아직 재생 전이거나 일시정지 상태) 이동만 하고
  // 멈춘 채로 둔다 — 클릭할 때마다 강제로 재생이 시작되면 오히려 불편하다.
  const wasPlaying = !el.paused
  const targetSec = Math.min(absSec, Number.isFinite(el.duration) ? el.duration : absSec)
  pendingProgrammaticSeekSec = targetSec
  el.currentTime = targetSec
  if (wasPlaying) {
    const p = el.play()
    if (p?.catch) p.catch(() => {})
  }
}
const seekVoice = (relSec) => {
  if (questionStartSec.value == null) return
  seekAbsolute(questionStartSec.value + relSec)
}
// 그래프 위 드래그/클릭 전용 이동 — 기본은 '현재 질문 구간' 안에서만 움직이되,
// 포인터를 구간 오른쪽 끝 밖으로 끌면 다음 질문으로, 왼쪽 끝 밖으로 끌면 이전
// 질문으로 넘어간다(양쪽 다 대칭 동작 — relSec은 클램프 전 원본 값이 그대로
// 들어와서 dur을 넘거나 0 미만이 될 수 있다).
const seekWithinCurrentQuestion = (relSec) => {
  const dur = current.value.durationSec
  if (relSec >= dur && selected.value < questions.value.length - 1) {
    selectQuestion(selected.value + 1)
    return
  }
  if (relSec < 0 && selected.value > 0) {
    selectQuestion(selected.value - 1)
    return
  }
  const clampedRel = Math.min(dur, Math.max(0, relSec))
  const absSec = questionStartSec.value + clampedRel
  absoluteVideoSec.value = absSec
  const el = voiceVideoEl.value
  if (!el) return
  const wasPlaying = !el.paused
  const targetSec = Math.min(absSec, Number.isFinite(el.duration) ? el.duration : absSec)
  pendingProgrammaticSeekSec = targetSec
  el.currentTime = targetSec
  if (wasPlaying) {
    const p = el.play()
    if (p?.catch) p.catch(() => {})
  }
}
const onVideoTimeUpdate = () => {
  const el = voiceVideoEl.value
  if (!el) return
  if (el.paused && isUnmeasuredQuestion(current.value)) return
  if (pendingProgrammaticSeekSec != null) {
    if (Math.abs(el.currentTime - pendingProgrammaticSeekSec) <= 0.15) {
      pendingProgrammaticSeekSec = null
    }
    // seekAbsolute() already applied the intended absolute time and question.
    // Ignore both the stale previous-position event and the seek completion
    // event so neither can overwrite that explicit selection.
    return
  }
  absoluteVideoSec.value = el.currentTime
  syncQuestionSelectionToVideo(el.currentTime)
}
const onVideoSeeked = () => {
  pendingProgrammaticSeekSec = null
}
const syncVideoDuration = () => {
  const duration = Number(voiceVideoEl.value?.duration)
  videoDurationSec.value = Number.isFinite(duration) && duration > 0 ? duration : null
}

// 영상 하단 커스텀 컨트롤 — 재생/일시정지, 전체 녹화 기준 진행 막대(그래프는
// 질문 단위로 쪼개지만 영상·진행바·시간은 처음부터 끝까지 하나로 이어진다).
const totalRecordingDurationSec = computed(() => {
  if (videoDurationSec.value != null) return videoDurationSec.value
  const reported = Number(session.value.durationSeconds ?? session.value.durationSec)
  // reported는 답변 오디오 기준(TTS 구간 제외)이라, 영상의 실제 총 길이와
  // 맞추려면 세션 전체에 걸친 TTS 누적 재생 시간을 더해줘야 한다.
  return Number.isFinite(reported) && reported > 0
    ? reported
    : Math.max(1, questionStartSecAt(questions.value.length))
})
const videoPlaying = ref(false)

const releaseVoiceVideoObjectUrl = () => {
  if (!voiceVideoObjectUrl) return
  URL.revokeObjectURL(voiceVideoObjectUrl)
  voiceVideoObjectUrl = ''
}

const resetVoiceVideo = () => {
  releaseVoiceVideoObjectUrl()
  voiceVideoUrl.value = ''
  videoDurationSec.value = null
  absoluteVideoSec.value = null
  pendingProgrammaticSeekSec = null
  videoPlaying.value = false
}

const selectVoiceVideo = (reportId) => {
  resetVoiceVideo()
  const currentReportId = session.value.interviewId ?? reportId ?? interview.interviewId
  const ownsLocalVideo = interview.sessionVideoBlob
    && interview.sessionVideoOwnerId != null
    && currentReportId != null
    && String(interview.sessionVideoOwnerId) === String(currentReportId)
  if (ownsLocalVideo) {
    voiceVideoObjectUrl = URL.createObjectURL(interview.sessionVideoBlob)
    voiceVideoUrl.value = voiceVideoObjectUrl
    return
  }
  voiceVideoUrl.value = archivedSession.value?.recordingUrl
    ?? session.value.recordingUrl
    ?? session.value.videoUrl
    ?? session.value.video?.url
    ?? ''
}
const videoProgressPct = computed(() => (
  Math.min(100, Math.max(0, ((absoluteVideoSec.value ?? questionStartSec.value) / totalRecordingDurationSec.value) * 100))
))
const toggleVideoPlay = () => {
  const el = voiceVideoEl.value
  if (!el) return
  if (el.paused) {
    const p = el.play()
    if (p?.catch) p.catch(() => {})
  } else {
    el.pause()
  }
}
// 클릭은 물론 눌러서 끄는(드래그) 것도 되게 — 포인터 캡처로 막대 밖까지
// 끌어도 계속 따라간다.
const scrubFromClientX = (clientX, el) => {
  const rect = el.getBoundingClientRect()
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  seekAbsolute(pct * totalRecordingDurationSec.value)
}
const isDraggingVideoScrub = ref(false)
const onScrubPointerDown = (event) => {
  isDraggingVideoScrub.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
  scrubFromClientX(event.clientX, event.currentTarget)
}
const onScrubPointerMove = (event) => {
  if (!isDraggingVideoScrub.value) return
  scrubFromClientX(event.clientX, event.currentTarget)
}
const onScrubPointerUp = (event) => {
  if (isDraggingVideoScrub.value) scrubFromClientX(event.clientX, event.currentTarget)
  isDraggingVideoScrub.value = false
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}
const onScrubPointerCancel = () => { isDraggingVideoScrub.value = false }

// 그래프 위 재생 위치 핸들(검정 동그라미) 드래그 — 포인터 캡처로 차트 밖까지
// 끌어도 계속 추적한다(paceChartEl은 아래 useVoicePaceGraph가 제공).
const seekFromClientX = (clientX) => {
  const rect = paceChartEl.value?.getBoundingClientRect()
  if (!rect) return
  // 일부러 클램프하지 않는다 — 차트 바깥(왼쪽/오른쪽)으로 나가는 정도를
  // seekWithinCurrentQuestion이 그대로 받아 이전/다음 질문 전환 여부를 판단한다.
  const pct = (clientX - rect.left) / rect.width
  seekWithinCurrentQuestion(pct * current.value.durationSec)
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
  return { pct: pct * 100, sec: pct * current.value.durationSec }
}
const onChartHoverLeave = () => {
  hoverPct.value = null
  hoverSec.value = null
}
// 추임새 점·마커뿐 아니라 그래프 어디를 누르든 그 위치로 재생 헤드가 오도록.
const onChartPointerDown = (event) => {
  event.currentTarget.setPointerCapture(event.pointerId)
  const p = pointFromClientX(event.clientX)
  if (p) { hoverPct.value = p.pct; hoverSec.value = p.sec }
  seekFromClientX(event.clientX)
}
const onChartPointerMove = (event) => {
  // 재생 헤드를 드래그하는 중에는 크로스헤어가 겹쳐 보이므로 갱신을 쉰다.
  if (isDraggingPlayhead.value) return
  const p = pointFromClientX(event.clientX)
  if (p) { hoverPct.value = p.pct; hoverSec.value = p.sec }
  if (event.buttons === 1) seekFromClientX(event.clientX)
}

// 우측 자막 칸 높이를 왼쪽 영상 칸에 픽셀 단위로 맞춘다(질문/자막 내용에
// 따라 카드 전체 높이가 출렁이지 않도록 — 넘치는 자막은 CSS가 위쪽을 잘라낸다).
const videoColEl = ref(null)
const labelColHeight = ref(null)
let videoColResizeObserver = null

let reportViewRequestGeneration = 0
const loadSelectedReport = async (reportId) => {
  const requestGeneration = ++reportViewRequestGeneration
  reportError.value = ''
  if (reportId) {
    reportLoading.value = true
    try {
      await interview.loadReport(reportId)
    } catch (error) {
      if (requestGeneration !== reportViewRequestGeneration) return
      reportError.value = error?.message || '면접 리포트를 불러오지 못했습니다.'
    } finally {
      if (requestGeneration === reportViewRequestGeneration) reportLoading.value = false
    }
  } else if (!interview.report) {
    reportError.value = '조회할 면접 리포트 정보가 없습니다.'
  }
}

onMounted(async () => {
  await loadSelectedReport(route.query.id)
  if (interview.report) void loadQuestionFeedbackAt(0)
  // 방금 녹화를 마친 직후(같은 브라우저 세션)라면 로컬 blob을 그대로 쓰고,
  // 그 외(다른 세션에서 "내 기록"으로 들어온 경우)에는 서버가 내려주는
  // 녹화 URL을 쓴다 — sessionVideoBlob은 이 탭에서 녹화한 경우에만 존재한다.
  selectVoiceVideo(route.query.id)

  if (videoColEl.value && typeof ResizeObserver !== 'undefined') {
    videoColResizeObserver = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height
      if (h) labelColHeight.value = h
    })
    videoColResizeObserver.observe(videoColEl.value)
  }
})

watch(() => route.query.id, async (reportId, previousReportId) => {
  if (String(reportId ?? '') === String(previousReportId ?? '')) return
  selected.value = 0
  resetVoiceVideo()
  await loadSelectedReport(reportId)
  if (String(route.query.id ?? '') !== String(reportId ?? '')) return
  selectVoiceVideo(reportId)
  if (interview.report) void loadQuestionFeedbackAt(0)
})
onBeforeUnmount(() => {
  resetVoiceVideo()
  videoColResizeObserver?.disconnect()
})

// 발표 리포트와 동일한 지표(음성·몸짓·내용 일치)로 통일.
const metrics = computed(() => {
  const source = session.value.metrics ?? {}
  return [
    { label: '음성', value: toReportScore(source.voiceScore ?? source.voice, null) },
    { label: '몸짓', value: toReportScore(source.videoScore ?? source.video ?? source.gazeHold, null) },
    { label: '내용', value: toReportScore(source.contentScore ?? source.content ?? source.answerStructure, null) },
  ].filter((metric) => metric.value != null)
})

// 발표(archive) 리포트와 동일한 점수 카드 + 호버 지표 상세.
// 실제 측정 가능한 지표만 남긴다 — 음성(추임새·말 속도·침묵), 몸짓(시선 이탈·기울기).
const scoreCards = computed(() => {
  // 음성 지표는 추임새·말 속도·침묵만 노출한다. 백엔드가 '말 더듬음'·'목소리 떨림'
  // 처럼 측정 근거가 약한 항목까지 내려줘도 호버 통계표에서는 제외한다.
  const isDroppedVoiceMetric = (rowLabel) => /더듬|떨림/.test(rowLabel || '')
  // 영상 카드의 '분석 샘플'은 내부 처리량 수치일 뿐 사용자에게 의미 있는
  // 피드백이 아니라 호버 통계표에서 뺀다.
  const isDroppedGestureMetric = (rowLabel) => /분석 샘플|표정\s*이상/.test(rowLabel || '')
  // scoreCards[]엔 없고 nonverbalSummary에만 오는 평균/최저/최고 속도 — 셋 다
  // WPM(분당 어절 수) 단위라 60으로 나누면 "초당 어절수"가 된다. 다른 곳에서
  // 쓰는 "초당 음절"(voicePace.avgPace, 완전히 다른 계산식)과 헷갈리지 않도록
  // 단위 이름을 '어절'로 구분한다. 아직 안 내려주는 응답도 있어 값 있을 때만 추가.
  const wpmToWordsPerSec = (wpm) => `초당 ${(Number(wpm) / 60).toFixed(1)}어절`
  const speedExtremeRows = []
  const ns = session.value.nonverbalSummary ?? {}
  if (ns.minWpm != null) speedExtremeRows.push(['최저 속도', wpmToWordsPerSec(ns.minWpm)])
  if (ns.maxWpm != null) speedExtremeRows.push(['최고 속도', wpmToWordsPerSec(ns.maxWpm)])

  return normalizeReportScoreCards(session.value.scoreCards, []).map((card) => {
    // 실제 백엔드 응답은 이 카드 라벨을 '영상'으로 내려준다(폴백 카드만 '몸짓').
    if (/^(영상|몸짓|video)$/i.test(String(card.label))) {
      const rows = card.rows.filter(([rowLabel]) => !isDroppedGestureMetric(rowLabel))

      // 전체 인터뷰의 시선 이탈 수와 질문별 gestureSeries 합계가 서로 다르게
      // 내려오는 응답이 있다. 질문별 그래프 데이터가 존재할 때는 화면에서
      // 실제로 확인 가능한 질문별 값의 합을 상단 카드에도 사용한다.
      if (questions.value.some((q) => q.gestureSeries)) {
        const gazeTotal = questions.value.reduce(
          (sum, q) => sum + Number(q.gestureSeries?.gazeCount ?? 0),
          0,
        )
        const gazeIndex = rows.findIndex(([rowLabel]) => /시선\s*이탈/.test(rowLabel || ''))
        if (gazeIndex !== -1) rows[gazeIndex] = [rows[gazeIndex][0], `${gazeTotal}회`]
      }

      return {
        ...card,
        label: '몸짓',
        title: /평가\s*지표/.test(String(card.title || ''))
          ? String(card.title).replace(/^영상/, '몸짓')
          : '몸짓 평가 지표',
        rows,
      }
    }
    if (card.label !== '음성') return card
    const rows = card.rows.filter(([rowLabel]) => !isDroppedVoiceMetric(rowLabel))

    // 백엔드의 "전체 인터뷰" 추임새/침묵 합계가 질문별 합계와 어긋나는 경우가
    // 있었다(계산 경로가 서로 다름) — 질문별 real voicePace가 있으면 상단
    // 카드 숫자를 그 값들의 합으로 다시 계산해, 그래프에서 보는 질문별
    // 숫자의 합과 항상 정확히 일치하도록 맞춘다.
    if (questions.value.some((q) => q.voicePace)) {
      const sumQuestionMetric = (key) => questions.value.reduce((sum, q) => sum + Number(q.voicePace?.[key] ?? 0), 0)
      const fillerIndex = rows.findIndex(([rowLabel]) => rowLabel === '추임새')
      if (fillerIndex !== -1) rows[fillerIndex] = ['추임새', `${sumQuestionMetric('fillerTotal')}회`]
      const silenceIndex = rows.findIndex(([rowLabel]) => rowLabel === '침묵' || rowLabel === '긴 공백')
      if (silenceIndex !== -1) rows[silenceIndex] = [rows[silenceIndex][0], `${sumQuestionMetric('longSilenceCount')}회`]
    }

    const speedIndex = rows.findIndex(([rowLabel]) => rowLabel === '말 속도')
    if (speedIndex === -1) return { ...card, rows: [...rows, ...speedExtremeRows] }
    // 백엔드 응답 그대로면 '말 속도' 라벨에 WPM 값(예: "61WPM")이 오는데, 최저·
    // 최고와 단위를 맞추려고 평균도 초당 어절수로 바꾸고 라벨도 "말 속도 평균"으로
    // 통일한다 — averageWpm이 없는 예전 응답이면 원래 값(WPM 표기)을 그대로 둔다.
    if (ns.averageWpm != null) rows[speedIndex] = ['말 속도 평균', wpmToWordsPerSec(ns.averageWpm)]
    rows.splice(speedIndex + 1, 0, ...speedExtremeRows)
    return { ...card, rows }
  })
})

const toClock = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}
// 화면에 보이는 시간은 전체 녹화 기준 절대 시각으로 — 질문마다 00:00으로
// 리셋되면 "지금 전체 중 어디인지" 구분이 안 되므로, 이 질문 앞에 쌓인
// 시간(questionStartSec)을 더해서 표시한다.
const absClock = (relSec) => toClock(Math.round(questionStartSec.value + relSec))

// 문장 단위 자막 타이밍(실측, STT). start/end는 질문 하나짜리 구간이 아니라
// 전체 녹화 기준 절대 초로 내려온다(질문 경계에 걸친 문장은 양쪽에 겹쳐
// 오기도 함) — allSentences가 그대로 atSec으로 쓴다.
const normalizeCaptionSegments = (segments) => (
  Array.isArray(segments)
    ? segments
      .map((s) => {
        const hasMeasuredStart = s.startTimeMs != null
          || s.start != null
          || s.startSec != null
          || s.startTimeSeconds != null
        const start = s.startTimeMs != null
          ? Number(s.startTimeMs) / 1000
          : Number(s.start ?? s.startSec ?? s.startTimeSeconds ?? 0)
        const end = s.endTimeMs != null
          ? Number(s.endTimeMs) / 1000
          : Number(s.end ?? s.endSec ?? s.endTimeSeconds ?? start)
        return {
          start,
          end,
          text: String(s.text ?? '').trim(),
          isTimestamped: hasMeasuredStart && Number.isFinite(start),
        }
      })
      .filter((s) => s.text)
    : []
)

// 그래프 엔진(useGestureGraph)은 tiltPercent 필드명을 쓰는데 실제 API는
// tiltPct로 내려온다 — 여기서 맞춰준다. buckets가 없으면 아직 실측이 아니므로
// null(→ 컴포넌트 쪽에서 목 데이터로 대체).
const normalizeGestureSeries = (series) => {
  if (!Array.isArray(series?.buckets) || !series.buckets.length) return null
  return {
    buckets: series.buckets.map((b) => ({
      startSec: b.startSec,
      endSec: b.endSec,
      tiltPercent: b.tiltPercent ?? b.tiltPct ?? 0,
    })),
    gazeCount: series.gazeCount ?? series.gazeEvents?.length ?? 0,
    gazeEvents: series.gazeEvents ?? [],
  }
}

// 질문 하나짜리 음성 그래프(useVoicePaceGraph)는 buckets·slowest·fastest가
// 다 있어야 실측으로 인정한다. 시계열이 없으면 그래프 대신 빈 상태를 보여준다.
const normalizeVoicePace = (vp) => (
  Array.isArray(vp?.buckets) && vp.buckets.length && vp.slowest && vp.fastest
    ? {
        ...vp,
        fillerTotal: Number(vp.fillerTotal ?? 0),
        fillerBreakdown: Array.isArray(vp.fillerBreakdown) ? vp.fillerBreakdown : [],
        longSilenceCount: Number(vp.longSilenceCount ?? 0),
        silences: Array.isArray(vp.silences) ? vp.silences : [],
        fillerEvents: Array.isArray(vp.fillerEvents) ? vp.fillerEvents : [],
      }
    : null
)

// 방금 이 브라우저에서 녹화를 마친 세션이라면, 서버가 아직 구간별로 못 나눠주는
// 시선·기울기 데이터를 우리가 녹화 중 실시간으로 이미 정확히 추적해뒀다
// (interview.sessionNonverbal — useFaceAnalysis.getSessionSummary). 이걸 이
// 질문 구간(startSec~startSec+durationSec)에 맞게 잘라 쓰면 서버 응답의
// 근사치보다 훨씬 정확한 진짜 데이터를 바로 보여줄 수 있다.
const sliceLocalGestureSeries = (nonverbal, startSec, durationSec) => {
  if (!nonverbal || (!nonverbal.gazeEvents?.length && !nonverbal.tiltBuckets?.length)) return null
  const endSec = startSec + durationSec
  const gazeEvents = (nonverbal.gazeEvents ?? [])
    .filter((e) => e.atSec >= startSec && e.atSec < endSec)
    .map((e) => ({ atSec: Math.round(e.atSec - startSec) }))

  const buckets = []
  for (let b = 0; b < durationSec; b += 10) {
    const bEnd = Math.min(durationSec, b + 10)
    const absStart = startSec + b
    const absEnd = startSec + bEnd
    const overlapping = (nonverbal.tiltBuckets ?? []).filter((tb) => tb.startSec < absEnd && tb.endSec > absStart)
    const tiltPercent = overlapping.length
      ? Math.round(overlapping.reduce((sum, tb) => sum + tb.tiltPct, 0) / overlapping.length)
      : 0
    buckets.push({ startSec: b, endSec: bEnd, tiltPercent })
  }
  return { buckets, gazeCount: gazeEvents.length, gazeEvents }
}

const questions = computed(() => {
  const source = Array.isArray(session.value.questions) ? session.value.questions : []
  let cumulativeStart = 0
  const parsed = source.map((q, index) => {
    const questionId = q.questionId ?? q.id
    const latestFeedback = questionId ? interview.questionFeedbacks[questionId] : null
    const item = latestFeedback ? { ...q, ...latestFeedback } : q
    const category = item.cat ?? item.category ?? ''
    const explicitStartSec = Number(item.startTimeSeconds ?? item.startTime)
    const explicitEndSec = Number(item.endTimeSeconds ?? item.endTime)
    const boundaryDurationSec = Number.isFinite(explicitStartSec) && Number.isFinite(explicitEndSec)
      ? explicitEndSec - explicitStartSec
      : 0
    const reportedDurationSec = Number(
      item.answerDurationSeconds ?? item.durationSec ?? item.durationSeconds,
    )
    const rawDurationSec = Number.isFinite(reportedDurationSec) && reportedDurationSec > 0
      ? reportedDurationSec
      : boundaryDurationSec
    const durationSec = Number.isFinite(rawDurationSec) && rawDurationSec > 0 ? rawDurationSec : 0
    const feedback = typeof item.feedback === 'string' ? item.feedback : item.feedback?.summary
    const rawStartOffset = Number.isFinite(explicitStartSec) && explicitStartSec >= 0 ? explicitStartSec : cumulativeStart
    cumulativeStart = Math.max(cumulativeStart, rawStartOffset + durationSec)
    // 영상 실제 재생 시각 기준으로 보정(이 세션에서 방금 녹화했을 때만 shift>0).
    const startOffset = rawStartOffset

    const captionSegments = normalizeCaptionSegments(item.segments)
    const voicePace = normalizeVoicePace(item.voicePace)

    const serverGestureSeries = normalizeGestureSeries(item.gestureSeries)
    const rawAnswer = String(item.answer ?? item.transcript ?? '')
    const submittedAnswer = isUnansweredAnswerText(rawAnswer) ? '' : rawAnswer
    const transcriptAnswer = captionSegments
      .map((segment) => segment.text)
      .filter((text) => text && text !== '선택하지 않음')
      .join(' ')
      .trim()
    // 구버전 리포트의 segments에는 서버 STT가 문장별로 들어 있다. 브라우저
    // 실시간 인식 결과(answer)가 앞부분을 놓쳤더라도, 질문별 피드백에는 영상
    // 자막과 동일한 전체 서버 STT를 보여준다. 현재 백엔드의 분석 이벤트
    // segments에는 text가 없으므로 그 경우에는 기존 answer를 그대로 사용한다.
    const answer = transcriptAnswer || submittedAnswer
    // A question without both a recorded answer interval and answer text has
    // no canonical position in the stitched answer-only video.
    const isVideoMapped = durationSec > 0 && Boolean(answer.trim())
    let evidence = normalizeInterviewEvidence(answer, item.evidence)
    const problem = String(item.problem ?? item.problematicExcerpt ?? '')
    if (!evidence.length && problem) {
      const problemIndex = answer.indexOf(problem)
      if (problemIndex !== -1) {
        evidence = normalizeInterviewEvidence(answer, [{
          type: 'weakness',
          text: problem,
          startIndex: problemIndex,
          endIndex: problemIndex + problem.length,
          reason: feedback ?? item.improvement ?? '',
        }])
      }
    }

    return {
      questionId,
      label: `질문 ${index + 1}`,
      cat: category,
      score: toReportScore(item.score ?? item.answerScore, null),
      question: item.text ?? item.question ?? item.content ?? '',
      answer,
      evidence,
      evidenceParts: buildInterviewEvidenceParts(answer, evidence),
      metric: item.metric ?? item.issueLabel ?? '',
      feedback: feedback ?? item.improvement ?? '',
      startSec: startOffset,
      durationSec,
      rawStartSec: Number.isFinite(explicitStartSec) && explicitStartSec >= 0 ? explicitStartSec : null,
      rawEndSec: Number.isFinite(explicitEndSec) && explicitEndSec >= 0 ? explicitEndSec : null,
      answerDurationSec: durationSec,
      isVideoMapped,
      durationClock: toClock(durationSec),
      captionSegments,
      voicePace,
      serverGestureSeries,
    }
  })

  const mappedQuestions = parsed.filter((question) => question.isVideoMapped)
  const hasAbsoluteTimestampTimeline = mappedQuestions.length > 0
    && mappedQuestions.every((question) => (
      Number.isFinite(question.rawStartSec)
      && Number.isFinite(question.rawEndSec)
      && question.rawEndSec > question.rawStartSec
      && question.captionSegments.some((segment) => segment.isTimestamped)
    ))
  const playbackQuestions = hasAbsoluteTimestampTimeline
    ? parsed.map((question) => {
        if (!question.isVideoMapped) {
          return { ...question, startSec: null, durationSec: 0 }
        }
        return {
          ...question,
          startSec: question.rawStartSec,
        }
      })
    : buildQuestionPlaybackTimeline(parsed, videoDurationSec.value)

  return playbackQuestions.map((question) => {
    const localGestureSeries = question.isVideoMapped
      ? sliceLocalGestureSeries(
        interview.sessionNonverbal,
        question.startSec,
        question.durationSec,
      )
      : null
    return {
      ...question,
      durationClock: toClock(Math.round(question.durationSec)),
      gestureSeries: localGestureSeries ?? question.serverGestureSeries,
    }
  })
})

// 좌측 질문 리스트 — 최대 5개, 그 이상은 페이지로 넘긴다.
const PAGE = 5
const listPage = ref(0)
const totalListPages = computed(() => Math.max(1, Math.ceil(questions.value.length / PAGE)))
const pagedList = computed(() =>
  questions.value.slice(listPage.value * PAGE, listPage.value * PAGE + PAGE).map((q, i) => ({ q, index: listPage.value * PAGE + i })),
)
const prevList = () => { if (listPage.value > 0) listPage.value -= 1 }
const nextList = () => { if (listPage.value < totalListPages.value - 1) listPage.value += 1 }

// evidence 툴팁: 강조 span이 여러 줄에 걸치면 그 안에 중첩된
// position:absolute 툴팁은 브라우저가 기준 위치를 어느 줄 기준으로 잡을지
// 불안정해서(줄마다 다르게 클리핑됨) 카드 스크롤 영역 밖으로 잘려 보인다.
// 그래서 카드 내부에 중첩시키지 않고, 마우스가 올라간 span의 위치를 읽어
// position:fixed 툴팁 하나를 body 기준으로 띄운다 — 어떤 조상의 overflow에도
// 잘리지 않는다.
const hoveredEvidence = ref(null)
const hoveredEvidencePos = ref({ x: 0, y: 0 })
const showEvidenceTooltip = (event, evidence) => {
  const rect = event.currentTarget.getBoundingClientRect()
  hoveredEvidence.value = evidence
  hoveredEvidencePos.value = {
    x: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
    y: rect.top,
  }
}
const hideEvidenceTooltip = () => { hoveredEvidence.value = null }

const selected = ref(0)
const EMPTY_QUESTION = {
  label: '', question: '', answer: '', evidence: [], evidenceParts: [], score: null,
  metric: '', feedback: '', startSec: 0, durationSec: 0, captionSegments: [],
  voicePace: null, gestureSeries: null,
}
const current = computed(() => questions.value[selected.value] ?? questions.value[0] ?? EMPTY_QUESTION)
const loadQuestionFeedbackAt = async (index) => {
  const questionId = questions.value[index]?.questionId
  const interviewId = session.value.interviewId ?? interview.interviewId ?? route.query.id
  if (!questionId || !interviewId || interview.questionFeedbacks[questionId]) return
  if (!/^\d+$/.test(String(questionId)) || !/^\d+$/.test(String(interviewId))) return
  try {
    await interview.loadQuestionFeedback(questionId, interviewId)
  } catch {
    // 종합 리포트에 포함된 기존 질문 데이터를 유지한다.
  }
}
const selectQuestion = (index) => {
  explicitCaptionQuestionIndex.value = null
  selected.value = index
  if (listPage.value !== Math.floor(index / PAGE)) listPage.value = Math.floor(index / PAGE)
  // There is no valid video position for an unanswered question. Selecting it
  // should show its empty state without seeking to (and reselecting) a neighbor.
  if (questions.value[index]?.isVideoMapped) {
    seekVoice(0)
  } else {
    if (voiceVideoEl.value && !voiceVideoEl.value.paused) voiceVideoEl.value.pause()
    videoPlaying.value = false
  }
  void loadQuestionFeedbackAt(index)
}
// 재생 중인(발화 기준) 질문(activeQuestionIndex)을 기준으로 삼았더니, 답변이
// 아주 짧은 질문(너무 빨리 넘겨서 durationSec이 1초로 clamp된 경우 등)에서는
// 그 좁은 구간을 실제로 "밟기 전에" activeQuestionIndex가 이미 다음 질문으로
// 넘어가 있어, 버튼을 한 번 눌렀는데 질문 하나를 건너뛰는 문제가 있었다.
// 지금 그래프에 펼쳐 보고 있는 질문(selected) 기준으로 정확히 ±1칸만 움직이면
// 어떤 경우에도 질문을 건너뛰지 않는다.
const prevQuestion = () => { if (selected.value > 0) selectQuestion(selected.value - 1) }
const nextQuestion = () => { if (selected.value < questions.value.length - 1) selectQuestion(selected.value + 1) }

const durationClock = computed(() => toClock(totalRecordingDurationSec.value))

// 질문 단위 음성 그래프 — 한 화면에 전체 인터뷰를 다 그리면 점·포인트가
// 몰려 안 보이므로, 선택된 질문 구간만 그린다. 그래프 엔진은 발표 리포트와
// 공용(같은 모양·상호작용이 보장되도록).
// 너무 빨리 넘겨 답변이 없는 질문 — 이동은 막지 않고(막으면 그 뒤 질문을 아예
// 볼 수 없다) 그래프·자막에 왜 분석이 없는지만 표시한다.
const isUnmeasuredQuestion = (question) => question?.isVideoMapped === false || !(
  String(question?.answer ?? '').trim()
  || (question?.captionSegments?.length ?? 0) > 0
  || question?.voicePace
)
const currentUnmeasured = computed(() => isUnmeasuredQuestion(current.value))
const activeUnmeasured = computed(() => isUnmeasuredQuestion(activeQuestionItem.value))
const UNMEASURED_NOTE = '이 질문은 답변하지 않아(빠르게 넘김) 분석할 수 없어요.'

const currentDurationSec = computed(() => Math.max(0, current.value.durationSec))
// 녹화 화면(InterviewRecordView.vue)의 질문당 제한 시간과 동일 — 이보다 짧게
// 끝났다면 시간이 다 돼서가 아니라 '다음 질문'/'종료하기'를 먼저 눌러 중간에
// 끊겼다는 뜻이다(자동 타임아웃은 항상 정확히 이 값에서 끊기므로, 그보다
// 짧으면 예외 없이 수동 중단). 그래프만 보면 답변이 잘린 이유를 알 수 없어
// 헷갈리므로 그 지점에 표시를 남긴다.
const PER_QUESTION_LIMIT_SEC = 60
const wasQuestionCutShort = computed(() => current.value.durationSec < PER_QUESTION_LIMIT_SEC - 1)
const showQuestionTransitionMarker = computed(() => (
  selected.value < questions.value.length - 1 && wasQuestionCutShort.value
))
const currentVoicePace = computed(() => current.value.voicePace)
const voiceBenchmarkRange = computed(() => {
  const vp = currentVoicePace.value
  const min = Number(vp?.benchmarkMin)
  const max = Number(vp?.benchmarkMax)
  return Number.isFinite(min) && Number.isFinite(max) ? `${min.toFixed(1)}–${max.toFixed(1)}음절 권장 범위` : ''
})

// 몸짓 탭 그래프 — 기울기는 계속 바뀌는 연속값이라 라인으로, 시선 이탈은
// "몇 번 벗어났는지"만 의미 있는 사건이라 음성 탭 추임새처럼 점으로 찍는다.
// gestureSeries도 questions computed에서 이미 정규화(tiltPct→tiltPercent)됐다.
const currentGestureSeries = computed(() => current.value.gestureSeries)
const {
  chartEl: gestureChartEl,
  tiltYBounds,
  tiltYFor,
  tiltValueAtSec,
  avgTiltPct,
  avgTiltLineStyle,
  tiltLinePath,
  gazeDotPositions,
} = useGestureGraph(currentGestureSeries, currentDurationSec)
const seekFromGestureClientX = (clientX) => {
  const rect = gestureChartEl.value?.getBoundingClientRect()
  if (!rect) return
  // pace 차트와 동일 — 클램프하지 않고 그대로 넘겨 이전/다음 질문 전환을 허용.
  const pct = (clientX - rect.left) / rect.width
  seekWithinCurrentQuestion(pct * current.value.durationSec)
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
    gestureHoverSec.value = pct * current.value.durationSec
  }
  if (event.buttons === 1) seekFromGestureClientX(event.clientX)
}
const onGestureHoverLeave = () => {
  gestureHoverPct.value = null
  gestureHoverSec.value = null
}
const gesturePlayheadPct = computed(() => (
  activeSec.value != null && activeSec.value >= 0 && activeSec.value <= current.value.durationSec
    ? (activeSec.value / current.value.durationSec) * 100
    : null
))
const gesturePlayheadYPct = computed(() => (
  gesturePlayheadPct.value == null ? null : tiltYFor(tiltValueAtSec(activeSec.value))
))

const {
  paceChartEl,
  pcOfSec,
  fillerEvents,
  silenceSegments,
  paceChartPath,
  avgLineStyle,
  paceMarkers,
  paceYBounds,
  paceYFor,
  paceAtSec,
  fillerDotPositions,
  rangeOverlays,
} = useVoicePaceGraph(currentVoicePace, currentDurationSec)
// 그래프 위 현재 재생 위치 표시(음성 탭 전용) — activeSec가 이 질문 범위
// 밖이면(다른 질문 재생 중) 표시하지 않는다. 세로선 대신 곡선 위 점 하나로
// 보여주므로 x·y 둘 다 계산한다.
const playheadPct = computed(() => (
  activeSec.value != null && activeSec.value >= 0 && activeSec.value <= current.value.durationSec
    ? pcOfSec(activeSec.value)
    : null
))
const playheadYPct = computed(() => (
  playheadPct.value == null ? null : paceYFor(paceAtSec(activeSec.value))
))

// 전체 문장에는 질문 귀속을 반드시 보존한다. 영상은 하나로 이어져 있어도
// 우측 자막 패널은 현재 선택된 질문의 답변만 보여줘야 질문 경계에서 앞/뒤
// 질문의 문장이 섞이지 않는다.
// 백엔드가 미선택 항목에 넣는 더미값(InterviewReportGenerator의 NOT_SELECTED).
// 아무 말도 안 한 구간이 이 값으로 내려와 자막에 그대로 뜨므로 렌더링에서 제외한다.
const DUMMY_CAPTION = '선택되지 않음'
const splitAnswerForCaptions = (answer) => {
  const text = String(answer ?? '').trim()
  if (!text) return []
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？]?/g)?.map((item) => item.trim()).filter(Boolean)
  return sentences?.length ? sentences : [text]
}
const allSentences = computed(() => {
  const flat = questions.value.flatMap((q, qi) => {
    // 구버전 리포트에만 존재하는 텍스트 segment는 원래 면접 시계에서
    // 질문별 답변만 이어 붙인 영상 시계로 변환한다.
    if (q.captionSegments.length) {
      return q.captionSegments
        .filter((s) => s.text !== DUMMY_CAPTION)
        .map((s) => {
          const originalStart = Number(s.start)
          const rawStart = Number(q.rawStartSec)
          const relativeStart = Number.isFinite(rawStart) && originalStart >= rawStart
            ? originalStart - rawStart
            : originalStart
          return {
            atSec: s.isTimestamped
              ? Math.max(0, originalStart || 0)
              : q.startSec + Math.min(q.durationSec, Math.max(0, relativeStart || 0)),
            text: s.text,
            questionIndex: qi,
            isSeekable: Boolean(s.isTimestamped && q.isVideoMapped),
          }
        })
    }

    // 현재 백엔드의 segments는 자막이 아니라 추임새·침묵 분석 이벤트다.
    // 이를 자막으로 오인하지 않고, 제출된 답변을 질문 구간 안에서 한 번만 표시한다.
    const answerSentences = splitAnswerForCaptions(q.answer)
    const step = answerSentences.length ? q.durationSec / answerSentences.length : 0
    return answerSentences.map((text, index) => ({
      atSec: q.startSec + (step * index),
      text,
      questionIndex: qi,
      isSeekable: false,
    }))
  })
  // 질문 경계에 걸친 문장은 백엔드가 앞뒤 질문 양쪽에 똑같이 중복해서 내려준다
  // (예: 59~70초 문장이 질문1 끝과 질문2 시작에 둘 다 포함) — 그대로 이어붙이면
  // 같은 문장이 두 번 나오면서 자막이 한 줄씩 밀려 보이므로, 바로 앞과 시각·
  // 내용이 같은 항목은 제거한다.
  return flat.filter((s, i) => i === 0 || s.atSec !== flat[i - 1].atSec || s.text !== flat[i - 1].text)
})
const currentSentences = computed(() => (
  allSentences.value.filter((sentence) => sentence.questionIndex === activeQuestionIndex.value)
))
// 실시간 자막 스택: 방금 지나온 문장은 위에 옅게, 현재 위치 문장은 강조.
const activeSentenceIndex = computed(() => {
  const list = currentSentences.value
  const sec = absoluteVideoSec.value ?? questionStartSec.value
  let bestIdx = -1
  list.forEach((s, i) => { if (s.atSec <= sec) bestIdx = i })
  // 질문 카드를 선택한 직후처럼 재생 시각이 경계보다 아주 조금 앞선 경우에도
  // 이전 질문 문장으로 대체하지 않고 현재 질문의 첫 문장을 유지한다.
  if (bestIdx < 0 && list.length) return 0
  return bestIdx
})
// 지금 영상 재생 위치가 TTS(질문 읽어주는 음성) 구간 안이면, 이전 질문의
// 마지막 문장이 그대로 얼어붙어 보이는 대신 "질문을 읽어주는 중"이라고
// 명확히 표시한다 — 세션에 TTS 구간 정보가 있을 때만(방금 이 브라우저에서
// 녹화한 세션) 동작한다.
const activeSentence = computed(() => {
  const idx = activeSentenceIndex.value
  return idx >= 0 ? currentSentences.value[idx].text : ''
})
const activeSentenceItem = computed(() => {
  const idx = activeSentenceIndex.value
  return idx >= 0 ? currentSentences.value[idx] : null
})
const seekCaptionSentence = (sentence) => {
  if (!sentence?.isSeekable) return
  const questionIndex = Number(sentence.questionIndex)
  const preferredQuestionIndex = Number.isInteger(questionIndex) && questions.value[questionIndex]
    ? questionIndex
    : null
  seekAbsolute(sentence.atSec, preferredQuestionIndex)
}
// 영상 옆 "질문" 라벨은 그래프에서 선택한 질문(selected)이 아니라 지금
// 자막에 나오는 발화가 실제로 속한 질문을 따라가야 한다 — 안 그러면 재생이
// 다음 질문으로 넘어가도 라벨은 이전 질문에 멈춰 있어 발화와 안 맞아 보인다.
// An explicit caption seek keeps its source question visible even when legacy
// report ranges overlap at the same absolute media timestamp. Ordinary playback
// and unanswered-question selection still resolve the visible video question
// from the media clock.
const activeQuestionIndex = computed(() => (
  explicitCaptionQuestionIndex.value
  ?? questionIndexAtTime(questions.value, absoluteVideoSec.value ?? 0)
))
const activeQuestionItem = computed(() => (
  questions.value[activeQuestionIndex.value] ?? questions.value[0] ?? EMPTY_QUESTION
))
// 현재 문장을 카드 세로 중앙에 두고, 위아래로 몇 줄씩만 미리보기처럼 보여준다
// (지나온 문장은 위에 옅게, 아직 안 나온 문장은 아래에 옅게).
// 문장이 3개보다 적게 남은 구간(맨 처음/맨 끝)에서도 줄 수 자체는 항상
// 똑같이 유지해야 현재 줄이 진짜로 "고정된 중앙"에 있다 — 실제 문장이
// 모자라면 빈 줄로 채워서 자리만 차지하게 한다(그래야 justify-content:center가
// 매번 다른 콘텐츠 높이에 맞춰 재중앙정렬하면서 현재 줄이 흔들리지 않는다).
const CAPTION_WINDOW = 3
const priorSentences = computed(() => {
  const idx = activeSentenceIndex.value
  const real = currentSentences.value.slice(Math.max(0, idx - CAPTION_WINDOW), Math.max(0, idx))
  return [...Array.from({ length: CAPTION_WINDOW - real.length }, () => null), ...real]
})
const nextSentences = computed(() => {
  const real = currentSentences.value.slice(activeSentenceIndex.value + 1, activeSentenceIndex.value + 1 + CAPTION_WINDOW)
  return [...real, ...Array.from({ length: CAPTION_WINDOW - real.length }, () => null)]
})

// 상단 탭 — 음성 그래프 / 영상(비언어) 타임라인.
const metricTab = ref('voice')
</script>

<template>
  <main class="archive-report-shell metric-report-shell">
    <RouterLink class="archive-report-back" :to="folderBackLink">연습 기록으로 돌아가기</RouterLink>

    <p v-if="reportLoading" class="iv-report-state" aria-live="polite">면접 리포트를 불러오는 중입니다.</p>
    <div v-else-if="reportError && !interview.report && !archivedSession" class="iv-report-state is-error" role="alert">
      <strong>리포트를 표시할 수 없습니다.</strong>
      <span>{{ reportError }}</span>
    </div>

    <template v-else>
    <section class="archive-report-summary" aria-label="면접 정보와 분석 결과">
      <div class="archive-report-info">
        <h1 :title="title">{{ title }}</h1>
        <p v-if="description" class="iv-report-description">{{ description }}</p>
        <dl class="archive-report-meta">
          <div><dt>연습 날짜</dt><dd>{{ reportDate }}</dd></div>
          <div><dt>녹화 시간</dt><dd>{{ durationClock }}</dd></div>
          <div><dt>질문 개수</dt><dd>{{ questions.length }}개</dd></div>
        </dl>
      </div>

      <div class="archive-report-metrics">
        <header v-if="isInterviewTooShort" class="is-short-presentation is-short-interview">
          <div class="archive-short-presentation-state" role="status">
            <span>면접 시간이 너무 짧아요</span>
            <strong aria-hidden="true">:(</strong>
          </div>
        </header>
        <header v-else>
          <div><span>면접 결과</span><strong>{{ totalScore == null ? '—' : `${formatScore(totalScore)}점` }}</strong></div>
        </header>
        <ul v-if="isInterviewTooShort" class="archive-short-presentation-message">
          <li>정확한 지표를 생성하기 어려워요.</li>
          <li>전체 면접 시간이 30초 미만이에요.</li>
        </ul>
        <dl v-else>
          <div v-for="(card, i) in scoreCards" :key="`${card.label}-${i}`" class="archive-score-metric" tabindex="0">
            <dt>{{ card.label }}<span class="archive-score-hint" aria-hidden="true">?</span></dt>
              <dd>{{ card.value == null ? '—' : `${formatScore(card.value)}점` }}</dd>
            <aside class="archive-score-detail">
              <strong>{{ card.title }}</strong>
              <dl class="archive-score-breakdown">
                <div v-for="[rowLabel, rowValue] in card.rows" :key="rowLabel">
                  <dt v-if="rowLabel === '추임새'"><span class="iv-term-hint" tabindex="0">추임새<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span></dt>
                  <dt v-else>{{ rowLabel }}</dt>
                  <dd>{{ rowValue }}</dd>
                </div>
              </dl>
            </aside>
          </div>
          <p v-if="!scoreCards.length" class="iv-score-empty">세부 점수 데이터가 없습니다.</p>
        </dl>
      </div>
    </section>

    <div v-if="hasOverallFeedback || questions.length" class="iv-section-divider" aria-hidden="true"></div>

    <section v-if="hasOverallFeedback" class="iv-overall-feedback" aria-labelledby="overallFeedbackTitle">
      <h2 id="overallFeedbackTitle">종합 피드백</h2>
      <dl v-if="contentMetrics.length" class="iv-content-metrics">
        <div v-for="item in contentMetrics" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ formatScore(item.value) }}점</dd>
        </div>
      </dl>
      <p v-if="contentSummary" class="iv-content-summary">{{ contentSummary }}</p>
      <template v-if="hasOverallFeedbackDetails">
        <button
          type="button"
          class="iv-overall-toggle"
          :aria-expanded="isOverallFeedbackExpanded"
          aria-controls="overallFeedbackDetails"
          @click="isOverallFeedbackExpanded = !isOverallFeedbackExpanded"
        >
          {{ isOverallFeedbackExpanded ? '자세히 접기' : '자세히 펼쳐보기' }}
          <svg class="iv-overall-toggle-icon" :class="{ 'is-expanded': isOverallFeedbackExpanded }" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m3.5 6 4.5 4 4.5-4" />
          </svg>
        </button>
        <div v-show="isOverallFeedbackExpanded" id="overallFeedbackDetails" class="iv-overall-details">
          <div v-if="strengths.length || improvements.length" class="iv-overall-lists">
            <article v-if="strengths.length" class="is-strength">
              <h3>잘한 점</h3>
              <ul><li v-for="item in strengths" :key="item">{{ item }}</li></ul>
            </article>
            <article v-if="improvements.length" class="is-improvement">
              <h3>개선할 점</h3>
              <ul><li v-for="item in improvements" :key="item">{{ item }}</li></ul>
            </article>
          </div>
          <article v-if="detailedFeedback" class="iv-detailed-feedback">
            <h3>상세 총평</h3>
            <p>{{ detailedFeedback }}</p>
          </article>
        </div>
      </template>
    </section>

    <template v-if="questions.length">
    <!-- 섹션1: 음성/몸짓 탭 — 질문 단위로 나눠서 보여준다(전체를 한꺼번에 그리면 점이 몰려 안 보임) -->
    <section class="iv-metric-tabs" aria-label="음성·몸짓 지표">
      <div class="iv-metric-tabs-head">
        <div class="iv-metric-tabhead">
          <button type="button" class="iv-metric-tab" :class="{ 'is-active': metricTab === 'voice' }" @click="metricTab = 'voice'">음성</button>
          <button type="button" class="iv-metric-tab" :class="{ 'is-active': metricTab === 'video' }" @click="metricTab = 'video'">몸짓</button>
          <span class="iv-metric-tab-question">{{ current.label }}</span>
        </div>
        <div v-if="metricTab === 'voice'" class="iv-pace-legend">
          <span class="iv-pace-legend-item is-slow"><i>▼</i>가장 느린 구간</span>
          <span class="iv-pace-legend-item is-fast"><i>▲</i>가장 빠른 구간</span>
          <span class="iv-pace-legend-item is-filler"><i></i><span class="iv-term-hint" tabindex="0">추임새<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span></span>
          <span class="iv-pace-legend-item is-silence"><i></i>침묵 구간</span>
        </div>
        <div v-else class="iv-pace-legend">
          <span class="iv-pace-legend-item is-gaze-dot"><i></i>시선 이탈</span>
          <span class="iv-pace-legend-item is-tilt-line"><i></i>기울기</span>
        </div>
      </div>

      <div v-if="metricTab === 'voice' && currentVoicePace" class="iv-pace-panel">
        <div class="iv-pace-meta iv-pace-meta-compact">
          <span class="iv-pace-meta-range">{{ voiceBenchmarkRange || `${paceYBounds.lo.toFixed(1)}–${paceYBounds.hi.toFixed(1)}음절 측정 범위` }}</span>
        </div>
        <div
          ref="paceChartEl"
          class="iv-pace-chart"
          @pointerdown="onChartPointerDown"
          @pointermove="onChartPointerMove"
          @pointerleave="onChartHoverLeave"
        >
          <div class="iv-pace-avg-line" :style="avgLineStyle">
            <span class="iv-pace-avg-label">평균 속도 · 초당 {{ currentVoicePace.avgPace.toFixed(1) }}음절</span>
          </div>
          <span
            v-for="(sil, i) in silenceSegments"
            :key="`sil-${i}`"
            class="iv-pace-silence-bg"
            :style="{ left: `${sil.leftPct}%`, width: `${sil.widthPct}%` }"
            role="button"
            tabindex="0"
            :aria-label="`1초 이상 정적 ${absClock(sil.startSec)}–${absClock(sil.endSec)}`"
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
            <span class="iv-pace-crosshair-badge">{{ absClock(hoverSec) }} · 초당 {{ paceAtSec(hoverSec).toFixed(1) }}음절</span>
          </div>
          <div
            v-if="playheadPct != null"
            class="iv-pace-playhead"
            :style="{ left: `${playheadPct}%`, top: `${playheadYPct}%` }"
          >
            <span class="iv-pace-playhead-time">{{ absClock(activeSec) }}</span>
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
            :aria-label="`추임새 '${f.word}' ${absClock(f.atSec)} · 영상 이동`"
            @click="seekVoice(f.atSec)"
          ></button>
          <div
            v-if="showQuestionTransitionMarker"
            class="iv-pace-cutoff"
            role="note"
            aria-label="이 지점에서 다음 질문으로 넘어감"
            :style="{ left: '100%' }"
          >
            <span class="iv-pace-cutoff-label">여기서 다음으로 넘어감</span>
          </div>
        </div>
        <div class="iv-pace-range-lane" aria-label="발화 속도 구간">
          <button
            type="button"
            class="iv-pace-range-mark"
            :style="{ left: `${rangeOverlays.slow.leftPct}%`, width: `${rangeOverlays.slow.widthPct}%` }"
            :aria-label="`가장 느린 구간 ${absClock(currentVoicePace.slowest.startSec)}–${absClock(currentVoicePace.slowest.endSec)} · 영상 이동`"
            @click="seekVoice(currentVoicePace.slowest.startSec)"
          >
            <span class="iv-pace-range-icon">▼</span>
            <span class="iv-pace-range-bracket"></span>
            <span class="iv-pace-range-value">{{ currentVoicePace.slowest.pace.toFixed(1) }}</span>
          </button>
          <button
            type="button"
            class="iv-pace-range-mark"
            :style="{ left: `${rangeOverlays.fast.leftPct}%`, width: `${rangeOverlays.fast.widthPct}%` }"
            :aria-label="`가장 빠른 구간 ${absClock(currentVoicePace.fastest.startSec)}–${absClock(currentVoicePace.fastest.endSec)} · 영상 이동`"
            @click="seekVoice(currentVoicePace.fastest.startSec)"
          >
            <span class="iv-pace-range-icon">▲</span>
            <span class="iv-pace-range-bracket"></span>
            <span class="iv-pace-range-value">{{ currentVoicePace.fastest.pace.toFixed(1) }}</span>
          </button>
        </div>
        <div class="iv-pace-axis-edges">
          <span>{{ absClock(0) }}</span>
          <span>{{ absClock(current.durationSec) }}</span>
        </div>
        <div class="iv-pace-chips">
          <span class="iv-pace-chip is-filler"><span class="iv-term-hint" tabindex="0">추임새<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span> {{ currentVoicePace.fillerTotal }}회<small>{{ currentVoicePace.fillerBreakdown.map(([w, n]) => `${w} ${n}회`).join(' · ') }}</small></span>
          <span class="iv-pace-chip is-silence">1초 이상 정적 {{ formatCount(currentVoicePace.longSilenceCount, '0') }}회</span>
          <span class="iv-pace-chip is-slow">▼ 가장 느린 구간 {{ paceMarkers.find((m) => m.key === 'slow')?.pace }}<small>{{ absClock(currentVoicePace.slowest.startSec) }}–{{ absClock(currentVoicePace.slowest.endSec) }}</small></span>
          <span class="iv-pace-chip is-fast">▲ 가장 빠른 구간 {{ paceMarkers.find((m) => m.key === 'fast')?.pace }}<small>{{ absClock(currentVoicePace.fastest.startSec) }}–{{ absClock(currentVoicePace.fastest.endSec) }}</small></span>
        </div>
      </div>
      <div v-else-if="metricTab === 'voice'" class="iv-metric-empty" :class="{ 'is-unmeasured': currentUnmeasured }">{{ currentUnmeasured ? UNMEASURED_NOTE : '질문별 음성 시계열 데이터가 없습니다.' }}</div>

      <div v-else-if="currentGestureSeries" class="iv-video-panel">
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
              <span class="iv-pace-crosshair-badge">{{ absClock(gestureHoverSec) }} · 기울기 {{ formatTiltPercent(tiltValueAtSec(gestureHoverSec)) }}%</span>
            </div>
            <button
              v-for="(d, i) in gazeDotPositions"
              :key="`gaze-${i}`"
              type="button"
              class="iv-gesture-gaze-dot"
              :style="{ left: `${d.xPct}%`, top: `${d.yPct}%` }"
              :aria-label="`시선 이탈 ${absClock(d.atSec)} · 영상 이동`"
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
              <span class="iv-pace-playhead-time">{{ absClock(activeSec) }}</span>
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
            <div
              v-if="showQuestionTransitionMarker"
              class="iv-pace-cutoff"
              role="note"
              aria-label="이 지점에서 다음 질문으로 넘어감"
              :style="{ left: '100%' }"
            >
              <span class="iv-pace-cutoff-label">여기서 다음으로 넘어감</span>
            </div>
          </div>
          <div class="iv-pace-axis-edges">
            <span>{{ absClock(0) }}</span>
            <span>{{ absClock(current.durationSec) }}</span>
          </div>
        </div>

        <div class="iv-pace-chips">
          <span class="iv-pace-chip is-gaze">시선 이탈 {{ formatCount(currentGestureSeries.gazeCount, '0') }}회</span>
          <span class="iv-pace-chip is-tilt">기울기 평균 {{ formatDecimal(avgTiltPct, { minimum: 0, maximum: 100 }) }}%</span>
        </div>
      </div>
      <div v-else class="iv-metric-empty" :class="{ 'is-unmeasured': currentUnmeasured }">{{ currentUnmeasured ? UNMEASURED_NOTE : '질문별 몸짓 시계열 데이터가 없습니다.' }}</div>
    </section>

    <!-- 섹션2: 좌 영상 / 우 질문(양옆 이전·다음)+현재 위치 발화 -->
    <section class="iv-video-row" aria-label="답변 영상과 발화">
      <div ref="videoColEl" class="iv-video-col">
        <video
          v-if="voiceVideoUrl"
          :key="voiceVideoKey"
          ref="voiceVideoEl"
          class="iv-answer-video"
          :src="voiceVideoUrl"
          playsinline
          preload="metadata"
          @loadedmetadata="syncVideoDuration"
          @durationchange="syncVideoDuration"
          @timeupdate="onVideoTimeUpdate"
          @seeked="onVideoSeeked"
          @play="videoPlaying = true"
          @pause="videoPlaying = false"
        ></video>
        <div v-else class="iv-answer-video-empty">녹화 영상이 없어요</div>
        <div class="iv-video-controls-bar">
          <button type="button" class="iv-video-play-btn" :aria-label="videoPlaying ? '일시정지' : '재생'" @click="toggleVideoPlay">{{ videoPlaying ? '⏸' : '▶' }}</button>
          <button
            type="button"
            class="iv-video-scrub"
            aria-label="재생 위치 이동"
            @pointerdown="onScrubPointerDown"
            @pointermove="onScrubPointerMove"
            @pointerup="onScrubPointerUp"
            @pointercancel="onScrubPointerCancel"
            @lostpointercapture="onScrubPointerCancel"
          >
            <span class="iv-video-scrub-fill" :style="{ width: `${videoProgressPct}%` }"></span>
          </button>
          <span class="iv-video-time">{{ toClock(Math.round(absoluteVideoSec ?? questionStartSec)) }} / {{ toClock(totalRecordingDurationSec) }}</span>
        </div>
      </div>
      <div class="iv-label-col" :style="labelColHeight ? { height: `${labelColHeight}px` } : null">
        <div class="iv-video-question-row">
          <button type="button" class="iv-rq-nav" :disabled="selected === 0" aria-label="이전 질문" @click="prevQuestion">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <h3 class="iv-video-question">{{ activeQuestionItem.label }}. {{ activeQuestionItem.question }}</h3>
          <button type="button" class="iv-rq-nav" :disabled="selected === questions.length - 1" aria-label="다음 질문" @click="nextQuestion">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
        <div class="iv-caption-stack">
          <div class="iv-caption-prior-wrap">
            <component
              :is="s?.isSeekable ? 'button' : 'p'"
              v-for="(s, i) in priorSentences"
              :key="`prior-${i}`"
              :type="s?.isSeekable ? 'button' : undefined"
              class="iv-caption-line iv-caption-prior"
              :class="{ 'is-empty': !s, 'iv-caption-seek': s?.isSeekable }"
              :data-caption-seek="s?.isSeekable ? '' : undefined"
              @click="seekCaptionSentence(s)"
            >{{ s?.text }}</component>
          </div>
          <component
            :is="activeSentenceItem?.isSeekable && !activeUnmeasured ? 'button' : 'p'"
            :type="activeSentenceItem?.isSeekable && !activeUnmeasured ? 'button' : undefined"
            class="iv-caption-line iv-caption-current"
            :class="{
              'is-unmeasured': activeUnmeasured,
              'iv-caption-seek': activeSentenceItem?.isSeekable && !activeUnmeasured,
            }"
            data-answer-caption
            :data-caption-seek="activeSentenceItem?.isSeekable && !activeUnmeasured ? '' : undefined"
            @click="seekCaptionSentence(activeSentenceItem)"
          >{{ activeUnmeasured
            ? '이 질문은 답변하지 않아 자막이 없어요.'
            : (activeSentence || '위 표시나 영상을 재생해보세요.') }}</component>
          <div class="iv-caption-next-wrap">
            <component
              :is="s?.isSeekable ? 'button' : 'p'"
              v-for="(s, i) in nextSentences"
              :key="`next-${i}`"
              :type="s?.isSeekable ? 'button' : undefined"
              class="iv-caption-line iv-caption-next"
              :class="{ 'is-empty': !s, 'iv-caption-seek': s?.isSeekable }"
              :data-caption-seek="s?.isSeekable ? '' : undefined"
              @click="seekCaptionSentence(s)"
            >{{ s?.text }}</component>
          </div>
        </div>
      </div>
    </section>

    <!-- 위 영역: 질문 리스트 + 답변 읽기(문제 구간 클릭) -->
    <section class="iv-rq-top" aria-label="질문별 답변과 피드백">
      <h2 class="iv-rq-area-title">내용 피드백</h2>
      <div class="iv-rq-layout">
        <div class="iv-rq-list-col">
          <ul class="iv-rq-list">
            <li v-for="{ q, index } in pagedList" :key="index">
              <button
                type="button"
                class="iv-rq-item"
                :class="{ 'is-active': index === selected, 'is-unmeasured': isUnmeasuredQuestion(q) }"
                @click="selectQuestion(index)"
              >
                <span class="iv-rq-no">{{ q.label }}</span>
                <span class="iv-rq-q">{{ q.question }}</span>
                <span v-if="isUnmeasuredQuestion(q)" class="iv-rq-unmeasured">분석 불가</span>
              </button>
            </li>
          </ul>
          <div v-if="totalListPages > 1" class="iv-rq-list-pager">
            <button type="button" aria-label="이전" :disabled="listPage === 0" @click="prevList">‹</button>
            <span>{{ listPage + 1 }}</span>
            <button type="button" aria-label="다음" :disabled="listPage === totalListPages - 1" @click="nextList">›</button>
          </div>
        </div>

        <div class="iv-rq-answer-col">
          <h3 class="iv-rq-q-title">
            <span class="iv-rq-q-title-text">{{ current.label }}. {{ current.question }}</span>
            <span class="iv-rq-q-title-score">{{ current.score == null ? '—' : `${formatScore(current.score)}점` }}</span>
          </h3>
          <span class="iv-rq-answer-label">답변에서 강조된 구간에 마우스를 올리면 분석 근거를 확인할 수 있어요.</span>
          <div class="archive-feedback-stack archive-qna-list iv-rq-answer">
            <article class="archive-qna-item">
              <p v-if="current.answer" class="archive-qna-answer iv-evidence-answer">
                <template v-for="(part, partIndex) in current.evidenceParts" :key="partIndex">
                  <span v-if="!part.evidence.length">{{ part.text }}</span>
                  <span
                    v-else
                    class="iv-evidence-mark"
                    :class="`is-${part.evidence.some((item) => item.type === 'weakness') ? 'weakness' : 'strength'}`"
                    tabindex="0"
                    @mouseenter="showEvidenceTooltip($event, part.evidence)"
                    @mouseleave="hideEvidenceTooltip"
                    @focus="showEvidenceTooltip($event, part.evidence)"
                    @blur="hideEvidenceTooltip"
                  >{{ part.text }}</span>
                </template>
              </p>
              <p v-else class="iv-answer-empty">이 질문엔 답변하지 않았어요.</p>
            </article>
            <div
              v-if="hoveredEvidence"
              class="iv-evidence-floating-tooltip"
              role="tooltip"
              :style="{ left: `${hoveredEvidencePos.x}px`, top: `${hoveredEvidencePos.y}px` }"
            >
              <span v-for="item in hoveredEvidence" :key="item.id">
                <b>{{ item.type === 'strength' ? '강점' : '개선 필요' }}</b>
                {{ item.reason || '상세 이유가 제공되지 않았습니다.' }}
              </span>
            </div>
            <div v-if="current.feedback" class="archive-qna-issue-panel iv-question-summary">
              <b>{{ current.metric ? `${current.metric} · ` : '' }}질문별 피드백</b>
              <p>{{ current.feedback }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    </template>
    <p v-else class="iv-report-state">질문별 분석 데이터가 없습니다.</p>
    </template>
  </main>
</template>
