<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'
import { useInterviewStore } from '../../stores/interviewStore.js'

const route = useRoute()
const archive = useArchiveStore()
const interview = useInterviewStore()

const archivedSession = computed(() => archive.find(route.query.id))
const session = computed(() => {
  const apiReport = interview.report ?? {}
  const archived = archivedSession.value ?? {}
  return {
      id: 'missing',
      type: 'interview',
      title: interview.title || '면접 연습',
      date: '-',
      time: '-',
      duration: '12:42',
      score: 84,
      ...archived,
      ...apiReport,
      title: apiReport.title ?? archived.title ?? interview.title ?? '면접 연습',
      score: apiReport.overallScore ?? apiReport.score ?? archived.score ?? 84,
      duration: apiReport.duration ?? archived.duration ?? '12:42',
      questions: apiReport.questions ?? apiReport.questionResults ?? archived.questions,
    }
})
const title = computed(() => session.value.title?.trim() || '면접 연습')
const totalScore = computed(() => Number(session.value.score) || 84)
// 연습 날짜가 기록에 없으면(데모) 오늘 날짜로 표시.
const reportDate = computed(() => {
  const d = session.value.date
  if (d && d !== '-') return d
  const now = new Date()
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
})

onMounted(async () => {
  if (!interview.report) await interview.loadReport()
})

const clamp = (value) => Math.max(60, Math.min(99, Math.round(value)))
// 발표 리포트와 동일한 지표(음성·영상·내용 일치)로 통일.
const metrics = computed(() => {
  const source = session.value.metrics ?? {}
  return [
    { label: '음성', value: clamp(source.voiceScore ?? source.voice ?? totalScore.value + 2) },
    { label: '영상', value: clamp(source.videoScore ?? source.video ?? source.gazeHold ?? totalScore.value - 2) },
    { label: '내용 일치', value: clamp(source.contentScore ?? source.content ?? source.answerStructure ?? totalScore.value) },
  ]
})

// 발표(archive) 리포트와 동일한 점수 카드 + 호버 지표 상세.
const scoreCards = computed(() => [
  {
    value: metrics.value[0].value,
    title: '음성 평가 지표',
    rows: [['필러', '6회'], ['말 더듬음', '2회'], ['말 속도', '131 WPM'], ['목소리 떨림', '3회'], ['긴 공백', '5회']],
  },
  {
    value: metrics.value[1].value,
    title: '영상 평가 지표',
    rows: [['시선 이탈', '5회'], ['표정 이상 감지', '4회'], ['자세와 움직임', '3회']],
  },
  {
    value: metrics.value[2].value,
    title: '내용 평가 지표',
    rows: [['질문 이해도', '88%'], ['답변 적절성', '84%'], ['논리 구성', '80%']],
  },
])

const detailBank = {
  공통: { answer: '안녕하세요. 사용자 경험을 데이터로 개선하는 백엔드 개발자 지원자입니다. 최근에는 응답 지연을 줄이는 작업에 집중했습니다.', problem: '최근에는 응답 지연을 줄이는 작업에 집중했습니다.', issueLabel: '연결 보완', feedback: '강점을 분명히 전달했습니다. 마지막에 지원 직무와의 연결을 한 문장 덧붙이면 더 좋습니다.' },
  프로젝트: { answer: '저는 발표 분석 API와 녹화 데이터 처리 구조를 담당했습니다. 응답 지연을 줄이기 위해 비동기 처리 방식을 적용했습니다.', problem: '비동기 처리 방식을 적용했습니다.', issueLabel: '성과 수치 보완', feedback: '역할과 과정이 분명합니다. 처리 전후 응답 시간처럼 성과 수치를 덧붙이면 신뢰도가 높아집니다.' },
  기술: { answer: '대용량 요청을 처리하기 위해 메시지 큐 기반의 비동기 구조를 선택했습니다. 트래픽이 몰릴 때도 안정적으로 동작하도록 설계했습니다.', problem: '안정적으로 동작하도록 설계했습니다.', issueLabel: '대안 비교', feedback: '구조 선택은 적절합니다. 다른 대안과 비교한 이유를 한 문장 더 설명하면 판단력이 잘 드러납니다.' },
  협업: { answer: '팀원과 기술적 의견이 달랐을 때, 각 방식의 장단점을 정리해 공유하고 함께 기준을 세워 결정했습니다.', problem: '함께 기준을 세워 결정했습니다.', issueLabel: '결과 보완', feedback: '갈등을 조율하는 태도가 좋습니다. 결정 이후 어떤 결과로 이어졌는지 마무리하면 설득력이 커집니다.' },
  성장: { answer: '깊이 있는 도메인 이해가 부족하다고 느껴, 매주 회고를 통해 배운 내용을 정리하며 보완하고 있습니다.', problem: '매주 회고를 통해 배운 내용을 정리하며 보완하고 있습니다.', issueLabel: '사례 보완', feedback: '약점을 솔직하게 인정하고 개선 방법을 제시한 점이 좋습니다. 구체적인 개선 사례를 덧붙여 보세요.' },
  동기: { answer: '사용자에게 직접 가치를 전달하는 서비스를 만들고 싶어 지원했습니다. 입사 후에는 안정적인 백엔드 기반을 다지고 싶습니다.', problem: '안정적인 백엔드 기반을 다지고 싶습니다.', issueLabel: '연결 보완', feedback: '동기와 목표가 뚜렷합니다. 회사의 방향성과 본인의 목표를 연결하면 진정성이 더 잘 전달됩니다.' },
}
const fallbackQuestions = [
  { text: '1분 자기소개를 해주세요.', cat: '공통' },
  { text: 'AIVO 프로젝트에서 맡은 역할과 가장 큰 기여는?', cat: '프로젝트' },
  { text: '대용량 요청을 처리하기 위해 어떤 구조를 선택했나요?', cat: '기술' },
  { text: '팀원과 기술적 의견이 달랐던 경험을 말해 주세요.', cat: '협업' },
]

// 아래 영역(영상)은 비언어 구간 피드백. 질문에 따라 문제 구간이 없을 수도 있다.
const NONVERBAL = [
  [{ at: 0.3, kind: 'filler', label: '시선 처리', feedback: '답변 초반에 시선이 아래로 향했어요. 카메라 정면을 조금 더 오래 응시하면 자신감 있게 보입니다.' }],
  [],
  [
    { at: 0.32, kind: 'filler', label: '표정', feedback: '설명 구간에서 표정이 다소 굳어 있어요. 미소를 살짝 더하면 인상이 부드러워집니다.' },
    { at: 0.72, kind: 'evidence', label: '제스처', feedback: '손동작이 거의 없어 경직돼 보일 수 있어요. 핵심을 말할 때 가벼운 제스처를 곁들여보세요.' },
  ],
  [{ at: 0.5, kind: 'filler', label: '자세', feedback: '상체가 한쪽으로 기울었어요. 어깨를 펴고 정면을 유지하면 더 안정적으로 보입니다.' }],
  [],
  [{ at: 0.6, kind: 'evidence', label: '목소리 크기', feedback: '문장 끝에서 목소리가 작아졌어요. 마지막까지 또렷하게 마무리해보세요.' }],
]

const toClock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const timeToSeconds = (value) => {
  const [m, s] = String(value || '0:00').split(':').map(Number)
  return (m || 0) * 60 + (s || 0)
}
const durationClock = computed(() => {
  if (/\d+:\d+/.test(session.value.duration)) return session.value.duration
  const seconds = Number(session.value.durationSeconds)
  return Number.isFinite(seconds) ? toClock(seconds) : '12:42'
})

const questions = computed(() => {
  const source = Array.isArray(session.value.questions) && session.value.questions.length
    ? session.value.questions
    : fallbackQuestions
  return source.slice(0, 6).map((q, index) => {
    const category = q.cat ?? q.category ?? '공통'
    const detail = detailBank[category] || detailBank['공통']
    const durationSec = Number(q.durationSeconds ?? q.answerDurationSeconds ?? 55 + index * 12)
    const suppliedSegments = q.segments ?? q.nonverbalSegments
    const feedback = typeof q.feedback === 'string' ? q.feedback : q.feedback?.summary
    return {
      label: `Q${index + 1}`,
      cat: category,
      score: clamp(q.score ?? q.answerScore ?? totalScore.value + [2, 7, -2, -6, 4, -4][index % 6]),
      question: q.text ?? q.question ?? q.content,
      answer: q.answer ?? q.transcript ?? detail.answer,
      problem: q.problem ?? q.problematicExcerpt ?? detail.problem,
      issueLabel: q.issueLabel ?? q.feedbackLabel ?? detail.issueLabel,
      feedback: feedback ?? q.improvement ?? detail.feedback,
      durationSec,
      durationClock: toClock(durationSec),
      segments: (suppliedSegments ?? NONVERBAL[index % NONVERBAL.length] ?? []).map((s) => ({
        time: s.time ?? toClock(Math.round(durationSec * (s.at ?? 0))),
        kind: s.kind,
        label: s.label ?? s.type ?? '비언어 피드백',
        feedback: s.feedback ?? s.message ?? '',
      })),
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

const selected = ref(0)
const current = computed(() => questions.value[selected.value] ?? questions.value[0])
const issueOpen = ref(false)
const selectedSeg = ref(0)
const hasSegments = computed(() => current.value.segments.length > 0)
const currentSeg = computed(() => current.value.segments[selectedSeg.value] ?? current.value.segments[0] ?? null)
const playing = ref(false)
const selectQuestion = (index) => {
  selected.value = index
  issueOpen.value = false
  selectedSeg.value = 0
  playing.value = false
  if (listPage.value !== Math.floor(index / PAGE)) listPage.value = Math.floor(index / PAGE)
}
const selectSeg = (i) => { selectedSeg.value = i; playing.value = false }
const prevQuestion = () => { if (selected.value > 0) selectQuestion(selected.value - 1) }
const nextQuestion = () => { if (selected.value < questions.value.length - 1) selectQuestion(selected.value + 1) }

const answerParts = computed(() => {
  const item = current.value
  const idx = item.problem ? item.answer.indexOf(item.problem) : -1
  if (idx === -1) return { before: item.answer, problem: item.problem || '', after: '' }
  return { before: item.answer.slice(0, idx), problem: item.problem, after: item.answer.slice(idx + item.problem.length) }
})

const issueRangeStyle = (seg) => {
  const d = current.value.durationSec
  const center = timeToSeconds(seg.time)
  const start = Math.max(0, center - 6)
  const end = Math.min(d, center + 6)
  return { '--range-left': `${(start / d) * 100}%`, '--range-width': `${Math.max(3, ((end - start) / d) * 100)}%` }
}
const pinLeft = (seg) => `${Math.min(96, (timeToSeconds(seg.time) / current.value.durationSec) * 100)}%`
</script>

<template>
  <main class="archive-report-shell interview-report-detail">
    <RouterLink class="archive-report-back" :to="`/archive/folders?title=${encodeURIComponent(title)}`">연습 기록으로 돌아가기</RouterLink>

    <section class="archive-report-summary" aria-label="면접 정보와 분석 결과">
      <div class="archive-report-info">
        <h1>{{ title }}</h1>
        <dl class="archive-report-meta">
          <div><dt>연습 날짜</dt><dd>{{ reportDate }}</dd></div>
          <div><dt>녹화 시간</dt><dd>{{ durationClock }}</dd></div>
          <div><dt>질문 개수</dt><dd>{{ questions.length }}개</dd></div>
        </dl>
      </div>

      <div class="archive-report-metrics">
        <header>
          <div><span>면접 결과</span><strong>{{ totalScore }}점</strong></div>
          <small>최근 평균 대비 +5점</small>
        </header>
        <dl>
          <div v-for="(card, i) in scoreCards" :key="metrics[i].label" class="archive-score-metric" tabindex="0">
            <dt>{{ metrics[i].label }}<span class="archive-score-hint" aria-hidden="true">?</span></dt>
            <dd>{{ card.value }}점</dd>
            <aside class="archive-score-detail">
              <strong>{{ card.title }}</strong>
              <dl class="archive-score-breakdown">
                <div v-for="[rowLabel, rowValue] in card.rows" :key="rowLabel"><dt>{{ rowLabel }}</dt><dd>{{ rowValue }}</dd></div>
              </dl>
            </aside>
          </div>
        </dl>
      </div>
    </section>

    <!-- 위 영역: 질문 리스트 + 답변 읽기(문제 구간 클릭) -->
    <section class="iv-rq-top" aria-label="질문별 답변과 피드백">
      <h2 class="iv-rq-area-title">답변 내용 피드백</h2>
      <div class="iv-rq-list-col">
        <ul class="iv-rq-list">
          <li v-for="{ q, index } in pagedList" :key="index">
            <button
              type="button"
              class="iv-rq-item"
              :class="{ 'is-active': index === selected }"
              @click="selectQuestion(index)"
            >
              <span class="iv-rq-no">{{ q.label }}</span>
              <span class="iv-rq-q">{{ q.question }}</span>
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
          <span class="iv-rq-q-title-score">{{ current.score }}점</span>
        </h3>
        <span class="iv-rq-answer-label">AI 피드백 · 문제 구간을 눌러 상세를 확인하세요</span>
        <div class="archive-feedback-stack archive-qna-list iv-rq-answer">
          <article class="archive-qna-item">
            <p class="archive-qna-answer">{{ answerParts.before
              }}<button
                v-if="current.problem"
                type="button"
                class="archive-qna-problem archive-qna-issue-toggle"
                :aria-expanded="issueOpen"
                @click="issueOpen = !issueOpen"
              >{{ answerParts.problem }}</button>{{ answerParts.after }}</p>
            <div class="archive-qna-issue-panel" :class="{ 'is-open': issueOpen }" :hidden="!issueOpen">
              <b>{{ current.issueLabel }}</b>
              <p>{{ current.feedback }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 아래 영역: 비언어 영상 리뷰 + 구간 피드백 -->
    <section class="iv-rq-bottom" aria-label="비언어 영상 리뷰">
      <h2 class="iv-rq-area-title">비언어 피드백</h2>
      <div class="iv-rq-bottom-body">
        <div class="iv-rq-q-nav">
          <button type="button" class="iv-rq-nav" :disabled="selected === 0" aria-label="이전 질문" @click="prevQuestion">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <h3 class="iv-rq-bottom-title">{{ current.label }}. {{ current.question }}</h3>
          <button type="button" class="iv-rq-nav" :disabled="selected === questions.length - 1" aria-label="다음 질문" @click="nextQuestion">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>

        <div class="iv-rq-bottom-video" :class="{ 'is-preview': !playing }">
          <div class="iv-rq-video-copy">
            <small>비언어 분석 영상{{ currentSeg ? ` · ${currentSeg.time} 구간` : '' }}</small>
            <strong>{{ current.cat }}</strong>
          </div>
          <div class="iv-rq-video-controls">
            <button type="button" class="iv-rq-play" :aria-label="playing ? '일시정지' : '재생'" @click="playing = !playing">{{ playing ? '⏸' : '▶' }}</button>
            <span class="iv-rq-video-time">{{ currentSeg ? currentSeg.time : '0:00' }} / {{ current.durationClock }}</span>
          </div>
        </div>

        <section class="archive-issue-timeline iv-rq-timeline" aria-label="비언어 구간">
          <div class="archive-issue-track">
            <div class="archive-issue-track-line" aria-hidden="true"></div>
            <template v-if="hasSegments">
              <span v-for="(seg, i) in current.segments" :key="`r${i}`" class="archive-issue-range" :style="issueRangeStyle(seg)" aria-hidden="true"></span>
              <button
                v-for="(seg, i) in current.segments"
                :key="`p${i}`"
                type="button"
                class="archive-issue-marker archive-issue-pin"
                :class="[`is-${seg.kind}`, { 'is-selected': i === selectedSeg }]"
                :style="{ '--issue-left': pinLeft(seg), '--pin-order': i + 1 }"
                :aria-label="`${seg.time} 구간 보기`"
                @click="selectSeg(i)"
              ><b>{{ i + 1 }}</b><span>{{ seg.time }}</span></button>
            </template>
          </div>
        </section>

        <div v-if="hasSegments" class="iv-rq-seg-feedback">
          <b>{{ currentSeg.label }} · {{ currentSeg.time }}</b>
          <p>{{ currentSeg.feedback }}</p>
        </div>
        <div v-else class="iv-rq-seg-none">✓ 이 답변에서는 특별히 개선할 비언어 구간이 없어요. 아주 좋아요!</div>
      </div>
    </section>
  </main>
</template>
