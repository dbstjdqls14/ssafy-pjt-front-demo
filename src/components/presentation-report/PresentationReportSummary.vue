<script setup>
import { computed } from 'vue'
import {
  formatCount,
  formatDecimal,
  formatScore,
  formatWordsPerSecond,
} from '../../utils/displayFormatters.js'

// 요약/점수 카드는 면접 리포트와 같은 마크업(.archive-report-summary /
// .archive-score-metric)을 쓴다 — 점수에 마우스를 올리면 세부 지표가 뜨는 동작도
// 같은 CSS(archive-report.css)로 함께 따라온다.
const props = defineProps({
  practice: { type: Object, required: true },
  presentation: { type: Object, required: true },
  score: { type: Object, required: true },
  slides: { type: Array, default: () => [] },
})

const SHORT_PRESENTATION_THRESHOLD_SEC = 30
const isPresentationTooShort = computed(() => {
  const rawDuration = props.practice.durationSec
  if (rawDuration == null || rawDuration === '') return false
  const duration = Number(rawDuration)
  return Number.isFinite(duration) && duration >= 0 && duration < SHORT_PRESENTATION_THRESHOLD_SEC
})

const dateLabel = computed(() => {
  const value = props.practice.practicedAt
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date).replaceAll(' ', '')
        .replace(/\.$/, '')
})
const durationLabel = computed(() => {
  const seconds = Math.max(0, Math.round(Number(props.practice.durationSec) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const scoreLabel = (value) => {
  const formatted = formatScore(value)
  return formatted === '-' ? '-' : `${formatted}점`
}
const slideCountLabel = computed(() => formatCount(props.presentation.slideCount, '0'))
const folderDeltaLabel = computed(() => {
  const numeric = Number(props.score.folderAverageDelta)
  const formatted = formatDecimal(numeric, { maximumFractionDigits: 1 })
  if (formatted === '-') return null
  return `${numeric >= 0 ? '+' : ''}${formatted}점`
})

// 호버 상세는 슬라이드별 분석값을 합쳐서 만든다. 상단 카드 숫자가 아래 그래프에서
// 실제로 보이는 값들의 합과 어긋나지 않도록 별도 요약 필드 대신 직접 집계한다.
const speeches = computed(() => props.slides.map((slide) => slide.speech).filter(Boolean))
const gestures = computed(() => props.slides.map((slide) => slide.gesture).filter(Boolean))

const sumOf = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0)
const allBuckets = computed(() => speeches.value.flatMap((speech) => speech.buckets ?? []))
const wpmValues = computed(() => allBuckets.value
  .map((bucket) => Number(bucket.averageWpm))
  .filter((value) => Number.isFinite(value) && value > 0))

const voiceRows = computed(() => {
  if (!speeches.value.length) return []
  const rows = [['추임새', `${formatCount(sumOf(speeches.value, (s) => s.totalFillerCount), '0')}회`]]

  const measuredSec = allBuckets.value.reduce(
    (total, bucket) => total + (Number(bucket.endSec) - Number(bucket.startSec)),
    0,
  )
  const weightedWpm = measuredSec
    ? allBuckets.value.reduce((total, bucket) => (
        total + (Number(bucket.averageWpm) || 0) * (Number(bucket.endSec) - Number(bucket.startSec))
      ), 0) / measuredSec
    : null
  const averageLabel = weightedWpm == null ? null : formatWordsPerSecond(weightedWpm, null)
  if (averageLabel) rows.push(['말 속도 평균', averageLabel])
  if (wpmValues.value.length) {
    rows.push(['최저 속도', formatWordsPerSecond(Math.min(...wpmValues.value))])
    rows.push(['최고 속도', formatWordsPerSecond(Math.max(...wpmValues.value))])
  }
  rows.push(['긴 공백', `${formatCount(sumOf(speeches.value, (s) => s.silenceDetectedWindowCount), '0')}회`])
  return rows
})

const gestureRows = computed(() => {
  if (!gestures.value.length) return []
  const tilts = gestures.value
    .flatMap((gesture) => gesture.buckets ?? [])
    .map((bucket) => Number(bucket.tiltPercent))
    .filter(Number.isFinite)
  const rows = [['시선 이탈', `${formatCount(sumOf(gestures.value, (g) => g.gazeCount), '0')}회`]]
  if (tilts.length) {
    const average = tilts.reduce((total, value) => total + value, 0) / tilts.length
    rows.push(['기울기 평균', `${formatDecimal(average, { minimum: 0, maximum: 100 })}%`])
  }
  return rows
})

const contentRows = computed(() => {
  const rows = []
  const questionAnswerScore = Number(props.score.questionAnswerScore)
  if (Number.isFinite(questionAnswerScore)) {
    rows.push(['질의응답', `${formatScore(questionAnswerScore)}점`])
  }
  rows.push(['슬라이드', `${slideCountLabel.value}개`])
  return rows
})

const scoreCards = computed(() => [
  { label: '음성', title: '음성 평가 지표', value: props.score.voiceScore, rows: voiceRows.value },
  { label: '몸짓', title: '몸짓 평가 지표', value: props.score.videoScore, rows: gestureRows.value },
  { label: '내용', title: '내용 평가 지표', value: props.score.contentScore, rows: contentRows.value },
])
</script>

<template>
  <section class="archive-report-summary" aria-label="발표 정보와 분석 결과">
    <div class="archive-report-info">
      <h1 :title="practice.title || '발표 리포트'">{{ practice.title || '발표 리포트' }}</h1>
      <p v-if="practice.description" class="is-breakable">{{ practice.description }}</p>
      <dl class="archive-report-meta">
        <div><dt>연습 날짜</dt><dd>{{ dateLabel }}</dd></div>
        <div><dt>슬라이드 개수</dt><dd>{{ slideCountLabel }}개</dd></div>
        <div><dt>녹화 시간</dt><dd>{{ durationLabel }}</dd></div>
      </dl>
    </div>

    <div class="archive-report-metrics">
      <header v-if="isPresentationTooShort" class="is-short-presentation">
        <div class="archive-short-presentation-state" role="status">
          <span>발표 시간이 너무 짧아요</span>
          <strong aria-hidden="true">:(</strong>
        </div>
      </header>
      <header v-else>
        <div>
          <span>연습 결과</span>
          <strong>{{ scoreLabel(score.overallScore) }}</strong>
        </div>
        <small v-if="folderDeltaLabel != null">폴더 평균 대비 {{ folderDeltaLabel }}</small>
      </header>
      <ul v-if="isPresentationTooShort" class="archive-short-presentation-message">
        <li>정확한 지표를 생성하기 어려워요.</li>
        <li>전체 발표 시간이 30초 미만이에요.</li>
      </ul>
      <dl v-else>
        <div
          v-for="card in scoreCards"
          :key="card.label"
          class="archive-score-metric"
          :data-score-metric="card.label"
          tabindex="0"
        >
          <dt>{{ card.label }}<span v-if="card.rows.length" class="archive-score-hint" aria-hidden="true">?</span></dt>
          <dd>{{ scoreLabel(card.value) }}</dd>
          <aside v-if="card.rows.length" class="archive-score-detail">
            <strong>{{ card.title }}</strong>
            <dl class="archive-score-breakdown">
              <div v-for="[rowLabel, rowValue] in card.rows" :key="rowLabel">
                <dt v-if="rowLabel === '추임새'">
                  <span class="iv-term-hint" tabindex="0">추임새<span class="iv-term-hint-bubble">"음", "어", "그"처럼 다음 말을 생각하는 동안 공백을 채우기 위해 사용하는 표현</span></span>
                </dt>
                <dt v-else>{{ rowLabel }}</dt>
                <dd>{{ rowValue }}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </dl>
    </div>
  </section>
</template>
