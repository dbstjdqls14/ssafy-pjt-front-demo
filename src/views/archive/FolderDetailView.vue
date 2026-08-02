<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'
import { usePracticeStore } from '../../stores/practiceStore.js'

const route = useRoute()
const archive = useArchiveStore()
const practice = usePracticeStore()

const folderId = computed(() => route.params.id)
const type = computed(() => route.query.type || archive.folderPractices.practices[0]?.type || 'presentation')
const typeLabel = computed(() => (type.value === 'interview' ? '면접' : '발표'))
const detailBase = (rowType) => (rowType === 'interview' ? '/interview/report/detail' : '/archive/detail')
const reportTargetId = (row) => (
  row.type === 'interview'
    ? row.interviewId
    : (row.reportId ?? row.presentationId)
)

const folderDetail = computed(() => archive.folderDetail)
const title = computed(() => folderDetail.value?.name || '연습 폴더')
const folderDescription = computed(() => (
  folderDetail.value?.description
  || archive.folderPage.folders.find((folder) => String(folder.folderId) === String(folderId.value))?.description
  || practice.folders.find((folder) => String(folder.id) === String(folderId.value))?.description
  || ''
))
const reportLink = (row) => ({
  path: detailBase(row.type),
  query: {
    id: reportTargetId(row),
    folderId: folderId.value,
    type: row.type,
  },
})

const formatClock = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0)
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

// ── 내 성장 추이: 최근 7회 종합/음성/몸짓/내용 점수 (서버가 오름차순 아님 → 오래된순 정렬) ──
const chronologicalScores = computed(() =>
  [...archive.scoreTrend].sort((a, b) => new Date(a.practicedAt) - new Date(b.practicedAt)),
)

const chartPoints = computed(() => {
  const recent = chronologicalScores.value
  if (!recent.length) return []
  const scores = recent.map((a) => a.overallScore)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  return recent.map((attempt, index) => ({
    x: recent.length === 1 ? 320 : 42 + (index * 556) / (recent.length - 1),
    y: 170 - ((attempt.overallScore - min) / Math.max(1, max - min)) * 116,
    score: attempt.overallScore,
    label: `${index + 1}회`,
    isLatest: index === recent.length - 1,
  }))
})
const chartPolyline = computed(() => chartPoints.value.map((p) => `${p.x},${p.y}`).join(' '))

// 성장 추이 카드 전환: 0 = 종합 점수 선그래프, 1 = 음성/몸짓/내용 일치 최근 7회 비교 표.
const trendView = ref(0)
const flipTrend = (delta) => { trendView.value = (trendView.value + delta + 2) % 2 }

const metricCols = computed(() =>
  chronologicalScores.value.map((a, i) => ({
    label: `${i + 1}회`,
    voice: a.voiceScore,
    video: a.videoScore,
    content: a.contentScore,
  })),
)
const metricRowDefs = [
  { key: 'voice', label: '음성' },
  { key: 'video', label: '몸짓' },
  { key: 'content', label: '내용 일치' },
]

// ── 연습 기록: 서버 페이지네이션 + 정렬 ──
const sortValue = ref('latest')
const sortOptions = [
  { value: 'latest', label: '최신순' },
  { value: 'scoreDsc', label: '점수 높은 순' },
  { value: 'scoreAsc', label: '점수 낮은 순' },
]
const sortOpen = ref(false)
const sortLabel = computed(() => sortOptions.find((o) => o.value === sortValue.value)?.label)

const currentPage = ref(0)
const totalPages = computed(() => Math.max(1, archive.folderPractices.totalPages))
const pagedRows = computed(() => archive.folderPractices.practices)

const loadPractices = () => archive.loadFolderPractices(folderId.value, {
  page: currentPage.value,
  sort: sortValue.value,
})

const changePage = (delta) => {
  currentPage.value = Math.min(Math.max(0, currentPage.value + delta), totalPages.value - 1)
  loadPractices()
}
const applySort = (value) => {
  sortValue.value = value
  sortOpen.value = false
  currentPage.value = 0
  loadPractices()
}

const loadAll = () => {
  if (!folderId.value) return
  archive.loadFolderDetail(folderId.value)
  archive.loadScoreTrend(folderId.value)
  currentPage.value = 0
  loadPractices()
}

watch(folderId, loadAll)
onMounted(loadAll)
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
          <h2 id="folderTitle">{{ title }}</h2>
          <p v-if="folderDescription" class="folder-detail-desc">{{ folderDescription }}</p>
        </div>

        <dl class="folder-detail-metrics">
          <div><dt>시도 횟수</dt><dd>{{ folderDetail?.attemptCount ?? 0 }}회</dd></div>
          <div><dt>최고 점수</dt><dd>{{ folderDetail?.maxScore ?? 0 }}점</dd></div>
          <div><dt>총 연습 시간</dt><dd>{{ folderDetail?.totalDurationLabel ?? '0분 00초' }}</dd></div>
        </dl>
      </section>

      <section class="folder-trend-panel" aria-labelledby="trendTitle">
        <header class="folder-panel-head">
          <div>
            <h2 id="trendTitle">{{ trendView === 0 ? '내 성장 추이' : '지표별 최근 비교' }}</h2>
            <p>{{ trendView === 0 ? '최근 7회 종합 점수' : '음성 · 몸짓 · 내용 일치 · 최근 7회' }}</p>
          </div>
          <div class="folder-trend-nav" role="group" aria-label="성장 추이 보기 전환">
            <button type="button" aria-label="이전 보기" @click="flipTrend(-1)">‹</button>
            <button type="button" aria-label="다음 보기" @click="flipTrend(1)">›</button>
          </div>
        </header>

        <p v-if="!chronologicalScores.length" class="folder-trend-empty">아직 점수 추이를 보여드릴 연습 기록이 없어요.</p>

        <template v-else>
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
        </template>
      </section>
    </div>

    <section class="folder-attempt-panel" aria-labelledby="attemptTitle">
      <header class="folder-panel-head folder-attempt-heading-line">
        <div>
          <h2 id="attemptTitle">연습 기록</h2>
          <p>회차별 점수와 녹화 시간을 확인할 수 있어요.</p>
        </div>
        <span class="folder-attempt-count">총 {{ archive.folderPractices.attemptCount }}회</span>
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

      <p v-if="archive.folderPracticesLoading" class="folder-attempt-state">불러오는 중입니다.</p>
      <p v-else-if="!pagedRows.length" class="folder-attempt-state">아직 연습 기록이 없어요.</p>

      <div v-else class="folder-attempt-list">
        <article
          v-for="row in pagedRows"
          :key="row.practiceId"
          class="attempt-row"
        >
          <span class="attempt-kind-date">{{ typeLabel }} · {{ row.dateLabel }} · 녹화 {{ formatClock(row.durationSec) }}</span>
          <strong class="attempt-title">{{ row.title }}</strong>
          <strong class="attempt-score">{{ row.overallScore }}점</strong>
          <RouterLink
            v-if="reportTargetId(row)"
            class="attempt-link"
            :to="reportLink(row)"
          >
            리포트 상세보기 <span aria-hidden="true">&gt;</span>
          </RouterLink>
          <span v-else class="attempt-link is-disabled" title="상세 리포트 식별자가 아직 제공되지 않았습니다.">리포트 준비 중</span>
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

<style scoped>
.folder-detail-desc {
  margin: 6px 0 0;
  color: #5b6478;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}
.folder-trend-empty,
.folder-attempt-state {
  padding: 32px 0;
  color: #8d96aa;
  font-size: 14px;
  font-weight: 650;
  text-align: center;
}
</style>
