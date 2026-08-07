<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'

const route = useRoute()
const archive = useArchiveStore()

const requestedTitle = computed(
  () => route.query.title || archive.folders[0]?.title || '서비스 소개 발표',
)

const parseDuration = (value) => {
  const text = String(value || '')
  const clock = text.match(/^(\d+):(\d{2})$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const min = text.match(/(\d+)\s*분/)
  const sec = text.match(/(\d+)\s*초/)
  return Number(min?.[1] || 0) * 60 + Number(sec?.[1] || 0)
}
const parseAttemptDate = (item) =>
  new Date(`${String(item.date || '').replaceAll('.', '-')}T${item.time || '00:00'}:00`)
const formatClock = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0)
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
const formatTotal = (seconds) => {
  const minutes = Math.round(Math.max(0, seconds) / 60)
  if (minutes < 60) return `${minutes}분`
  return `${Math.floor(minutes / 60)}시간 ${String(minutes % 60).padStart(2, '0')}분`
}

// Real attempts for this folder, oldest → newest.
const realAttempts = computed(() =>
  archive.sessions
    .filter((item) => item.title === requestedTitle.value)
    .sort((a, b) => parseAttemptDate(a) - parseAttemptDate(b)),
)
const type = computed(() => realAttempts.value[0]?.type ?? 'presentation')
const typeLabel = computed(() => (type.value === 'interview' ? '면접' : '발표'))

// A single real attempt is expanded into a plausible 7-point history so the
// growth chart has something to show (demo data; replaced by real history).
const createDisplayAttempts = () => {
  const latest = realAttempts.value[0]
  const latestScore = latest ? Number(latest.score) : type.value === 'interview' ? 84 : 88
  const latestDuration = latest ? parseDuration(latest.duration) : 588
  const scoreSteps = [-16, -12, -9, -6, -4, -2, 0].map((delta, i) =>
    Math.max([60, 64, 66, 68, 70, 72, 0][i] || 0, latestScore + delta),
  )
  const durationSteps = [462, 486, 505, 532, 518, 560, latestDuration || 588]
  const dates = ['2026.06.18', '2026.06.22', '2026.06.28', '2026.07.01', '2026.07.04', '2026.07.08', latest?.date || '2026.07.20']
  return scoreSteps.map((score, index) => ({
    id: index === scoreSteps.length - 1 && latest ? latest.id : `${type.value}-display-${index + 1}`,
    type: type.value,
    title: requestedTitle.value,
    date: dates[index],
    time: index === scoreSteps.length - 1 && latest ? latest.time : '19:30',
    score,
    durationSeconds: durationSteps[index],
  }))
}

const displayAttempts = computed(() =>
  realAttempts.value.length > 1
    ? realAttempts.value.map((a) => ({ ...a, durationSeconds: Number(a.durationSeconds) || parseDuration(a.duration) }))
    : createDisplayAttempts(),
)

const totalSeconds = computed(() => displayAttempts.value.reduce((sum, a) => sum + a.durationSeconds, 0))
const bestScore = computed(() => Math.max(...displayAttempts.value.map((a) => Number(a.score))))
const latest = computed(() => displayAttempts.value[displayAttempts.value.length - 1])
const detailBase = computed(() => (type.value === 'interview' ? '/interview/report/detail' : '/archive/detail'))

// Attempt rows: numbered chronologically, then sorted/paginated for display.
const numberedRows = computed(() =>
  displayAttempts.value.map((a, index) => ({ ...a, attemptNumber: index + 1 })),
)
const latestId = computed(() => displayAttempts.value[displayAttempts.value.length - 1]?.id)

const sortValue = ref('latest')
const sortOptions = [
  { value: 'latest', label: '최신순' },
  { value: 'score-desc', label: '점수 높은 순' },
  { value: 'score-asc', label: '점수 낮은 순' },
]
const sortOpen = ref(false)
const sortLabel = computed(() => sortOptions.find((o) => o.value === sortValue.value)?.label)

const sortedRows = computed(() => {
  const rows = [...numberedRows.value]
  if (sortValue.value === 'score-desc') return rows.sort((a, b) => b.score - a.score)
  if (sortValue.value === 'score-asc') return rows.sort((a, b) => a.score - b.score)
  return rows.sort((a, b) => parseAttemptDate(b) - parseAttemptDate(a))
})

const PAGE_SIZE = 15
const currentPage = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / PAGE_SIZE)))
const pagedRows = computed(() =>
  sortedRows.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE),
)
const changePage = (delta) => {
  currentPage.value = Math.min(Math.max(0, currentPage.value + delta), totalPages.value - 1)
}
const applySort = (value) => {
  sortValue.value = value
  sortOpen.value = false
  currentPage.value = 0
}

// Trend chart (last 7 attempts) → SVG points.
const chartPoints = computed(() => {
  const recent = displayAttempts.value.slice(-7)
  const scores = recent.map((a) => Number(a.score))
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  return recent.map((attempt, index) => ({
    x: recent.length === 1 ? 320 : 42 + (index * 556) / (recent.length - 1),
    y: 170 - ((Number(attempt.score) - min) / Math.max(1, max - min)) * 116,
    score: Number(attempt.score),
    label: `${index + 1}회`,
    isLatest: index === recent.length - 1,
  }))
})
const chartPolyline = computed(() => chartPoints.value.map((p) => `${p.x},${p.y}`).join(' '))

// 성장 추이 카드 전환: 0 = 종합 점수 선그래프, 1 = 음성/영상/내용 일치 최근 7회 비교 표.
const trendView = ref(0)
const flipTrend = (delta) => { trendView.value = (trendView.value + delta + 2) % 2 }

// 회차별 음성·영상·내용 일치 점수(데모: 종합 점수에서 파생, 실제로는 회차 리포트값).
const clampMetric = (v) => Math.max(55, Math.min(99, Math.round(v)))
const VOICE_OFF = [2, 1, 3, 0, 2, 1, 2]
const VIDEO_OFF = [-3, -2, -4, -1, -2, -3, -2]
const CONTENT_OFF = [0, 1, -1, 2, 0, 1, 0]
const metricCols = computed(() =>
  displayAttempts.value.slice(-7).map((a, i) => {
    const s = Number(a.score)
    return {
      label: `${i + 1}회`,
      voice: clampMetric(s + VOICE_OFF[i % 7]),
      video: clampMetric(s + VIDEO_OFF[i % 7]),
      content: clampMetric(s + CONTENT_OFF[i % 7]),
    }
  }),
)
const metricRowDefs = [
  { key: 'voice', label: '음성' },
  { key: 'video', label: '영상' },
  { key: 'content', label: '내용 일치' },
]
</script>

<template>
  <main class="folder-detail-shell">
    <header class="folder-detail-head">
      <RouterLink to="/archive" class="folder-detail-back">뒤로가기</RouterLink>
    </header>

    <div class="folder-overview-grid">
      <section class="folder-info-panel" aria-labelledby="folderTitle">
        <div class="folder-detail-copy">
          <span>{{ typeLabel }} 연습</span>
          <h2 id="folderTitle">{{ requestedTitle }}</h2>
          <p>{{ typeLabel }} · {{ displayAttempts.length }}회 연습 · 최근 {{ latest.date }}</p>
        </div>

        <dl class="folder-detail-metrics">
          <div><dt>시도 횟수</dt><dd>{{ displayAttempts.length }}회</dd></div>
          <div><dt>최고 점수</dt><dd>{{ bestScore }}점</dd></div>
          <div><dt>총 연습 시간</dt><dd>{{ formatTotal(totalSeconds) }}</dd></div>
        </dl>
      </section>

      <section class="folder-trend-panel" aria-labelledby="trendTitle">
        <header class="folder-panel-head">
          <div>
            <h2 id="trendTitle">{{ trendView === 0 ? '내 성장 추이' : '지표별 최근 비교' }}</h2>
            <p>{{ trendView === 0 ? '최근 7회 종합 점수' : '음성 · 영상 · 내용 일치 · 최근 7회' }}</p>
          </div>
          <div class="folder-trend-nav" role="group" aria-label="성장 추이 보기 전환">
            <button type="button" aria-label="이전 보기" @click="flipTrend(-1)">‹</button>
            <button type="button" aria-label="다음 보기" @click="flipTrend(1)">›</button>
          </div>
        </header>

        <div v-show="trendView === 0" class="folder-line-chart" aria-label="최근 7회 종합 점수 선 그래프">
          <svg viewBox="0 0 640 220" role="img" aria-label="최근 종합 점수">
            <g class="chart-grid" aria-hidden="true">
              <line x1="42" y1="54" x2="598" y2="54"></line>
              <line x1="42" y1="112" x2="598" y2="112"></line>
              <line x1="42" y1="170" x2="598" y2="170"></line>
            </g>
            <polyline class="chart-line" :points="chartPolyline"></polyline>
            <g v-for="(point, i) in chartPoints" :key="i" class="chart-point" :class="{ 'is-latest': point.isLatest }">
              <circle :cx="point.x" :cy="point.y" r="6"></circle>
              <text class="chart-score" :x="point.x" :y="point.y - 15" text-anchor="middle">{{ point.score }}</text>
              <text class="chart-label" :x="point.x" y="202" text-anchor="middle">{{ point.label }}</text>
            </g>
          </svg>
        </div>

        <div v-show="trendView === 1" class="folder-metric-table-wrap">
          <table class="folder-metric-table">
            <thead>
              <tr>
                <th scope="col">지표</th>
                <th v-for="col in metricCols" :key="col.label" scope="col">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in metricRowDefs" :key="row.key">
                <th scope="row">{{ row.label }}</th>
                <td v-for="(col, ci) in metricCols" :key="col.label" :class="{ 'is-latest': ci === metricCols.length - 1 }">{{ col[row.key] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="folder-attempt-panel" aria-labelledby="attemptTitle">
      <header class="folder-panel-head folder-attempt-heading-line">
        <div>
          <h2 id="attemptTitle">연습 기록</h2>
          <p>회차별 점수와 녹화 시간을 확인할 수 있어요.</p>
        </div>
        <span class="folder-attempt-count">총 {{ displayAttempts.length }}회</span>
        <div class="folder-attempt-sort" :class="{ 'is-open': sortOpen }">
          <button type="button" class="folder-attempt-sort-trigger" aria-haspopup="listbox" :aria-expanded="sortOpen" @click="sortOpen = !sortOpen">
            <span>{{ sortLabel }}</span><b aria-hidden="true">⌄</b>
          </button>
          <div class="folder-attempt-sort-menu" role="listbox" aria-label="연습 기록 정렬">
            <button
              v-for="option in sortOptions"
              :key="option.value"
              type="button"
              role="option"
              :aria-selected="sortValue === option.value"
              @click="applySort(option.value)"
            >{{ option.label }}</button>
          </div>
        </div>
      </header>

      <div class="folder-attempt-list">
        <article
          v-for="row in pagedRows"
          :key="row.id"
          class="attempt-row"
          :class="{ 'is-latest': row.id === latestId }"
        >
          <span class="attempt-kind-date">{{ typeLabel }} · {{ row.date }} · 녹화 {{ formatClock(row.durationSeconds) }}</span>
          <strong class="attempt-title">{{ row.attemptNumber }}차 {{ requestedTitle }}</strong>
          <strong class="attempt-score">{{ row.score }}점</strong>
          <RouterLink class="attempt-link" :to="`${detailBase}?id=${encodeURIComponent(row.id)}`">
            리포트 상세보기 <span aria-hidden="true">&gt;</span>
          </RouterLink>
        </article>
      </div>

      <div v-if="totalPages > 1" class="folder-attempt-pager">
        <button type="button" class="folder-attempt-page-btn" aria-label="이전 페이지" :disabled="currentPage === 0" @click="changePage(-1)">‹</button>
        <span class="folder-attempt-page-label">{{ currentPage + 1 }} / {{ totalPages }}</span>
        <button type="button" class="folder-attempt-page-btn" aria-label="다음 페이지" :disabled="currentPage >= totalPages - 1" @click="changePage(1)">›</button>
      </div>
    </section>
  </main>
</template>
