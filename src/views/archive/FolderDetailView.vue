<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useArchiveStore } from '../../stores/archiveStore.js'
import { formatScore } from '../../utils/displayFormatters.js'

const route = useRoute()
const archive = useArchiveStore()

const folderId = computed(() => route.params.id == null ? '' : String(route.params.id))
const requestedType = computed(() => route.query.type === 'interview' ? 'interview' : 'presentation')
const folder = computed(() => archive.selectedFolder)
const type = computed(() => folder.value?.type ?? requestedType.value)
const typeLabel = computed(() => type.value === 'interview' ? '면접' : '발표')
const practices = computed(() => archive.practices.filter((practice) => practice.type === type.value))
const sortedPractices = computed(() => [...practices.value].sort((a, b) => (
  new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
)))
const totalSeconds = computed(() => practices.value.reduce((sum, item) => (
  sum + (Number(item.durationSeconds) || 0)
), 0))
const bestScore = computed(() => {
  const scores = practices.value.map((item) => item.score).filter(Number.isFinite)
  return scores.length ? Math.max(...scores) : null
})
const chronologicalScoredPractices = computed(() => practices.value
  .filter((item) => Number.isFinite(item.score))
  .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)))
const chartPoints = computed(() => {
  const rows = chronologicalScoredPractices.value
  if (!rows.length) return []
  const scores = rows.map((row) => Number(row.score))
  const low = Math.min(...scores)
  const high = Math.max(...scores)
  const range = Math.max(10, high - low)
  return rows.map((row, index) => ({
    key: row.id ?? `${row.type}-${index}`,
    score: Number(row.score),
    scoreDisplay: formatScore(row.score),
    x: rows.length === 1 ? 320 : 42 + ((556 * index) / (rows.length - 1)),
    y: 160 - (((Number(row.score) - low) / range) * 100),
    label: `${index + 1}회`,
    isLatest: index === rows.length - 1,
  }))
})
const chartPath = computed(() => chartPoints.value
  .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
  .join(' '))

const formatClock = (seconds) => {
  if (seconds == null || seconds === '') return '시간 없음'
  const safe = Math.round(Math.max(0, Number(seconds) || 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
const formatTotal = (seconds) => {
  const safe = Math.round(Math.max(0, Number(seconds) || 0))
  if (!safe) return '데이터 없음'
  const minutes = Math.floor(safe / 60)
  const remain = safe % 60
  return minutes ? `${minutes}분 ${String(remain).padStart(2, '0')}초` : `${remain}초`
}
const reportDomainId = (row) => row.type === 'interview' ? row.interviewId : row.presentationId
const reportDetailLocation = (row) => row.type === 'interview'
  ? {
      path: '/interview/report/detail',
      query: { id: row.interviewId, folderId: folderId.value },
    }
  : {
      path: '/archive/detail',
      query: { id: row.id, presentationId: row.presentationId, folderId: folderId.value },
    }

onMounted(async () => {
  archive.practices = []
  archive.selectedFolder = null
  if (!folderId.value) {
    archive.error = '조회할 연습 폴더 ID가 없습니다.'
    return
  }

  try {
    await archive.loadFolder(folderId.value, { type: requestedType.value })
    await archive.loadPractices(folderId.value, { page: 0, sort: 'latest' })
  } catch {
    // 스토어의 오류 메시지를 화면에 표시한다.
  }
})
</script>

<template>
  <main class="folder-detail-shell">
    <header class="folder-detail-head">
      <RouterLink to="/archive" class="folder-detail-back">뒤로가기</RouterLink>
    </header>

    <p v-if="archive.loading && !folder" class="archive-list-state">폴더 정보를 불러오는 중입니다.</p>
    <p v-else-if="archive.error && !folder" class="archive-list-state is-error" role="alert">{{ archive.error }}</p>

    <template v-else-if="folder">
      <div class="folder-overview-grid">
        <section class="folder-info-panel" aria-labelledby="folderTitle">
          <div class="folder-detail-copy">
            <span>{{ typeLabel }} 연습</span>
            <h2 id="folderTitle" :title="folder.name">{{ folder.name }}</h2>
            <p>{{ typeLabel }} · {{ practices.length }}회 조회됨</p>
          </div>

          <dl class="folder-detail-metrics">
            <div><dt>조회된 연습</dt><dd>{{ practices.length }}회</dd></div>
            <div><dt>최고 점수</dt><dd>{{ bestScore == null ? '점수 데이터 없음' : `${formatScore(bestScore)}점` }}</dd></div>
            <div><dt>총 연습 시간</dt><dd>{{ formatTotal(totalSeconds) }}</dd></div>
          </dl>
        </section>

        <section class="folder-trend-panel" aria-labelledby="trendTitle">
          <header class="folder-panel-head">
            <div>
              <h2 id="trendTitle">내 성장 추이</h2>
              <p>{{ chartPoints.length ? '생성된 리포트의 실제 점수만 표시합니다.' : '조회 가능한 리포트 점수가 없습니다.' }}</p>
            </div>
          </header>
          <div v-if="chartPoints.length" class="folder-line-chart">
            <svg viewBox="0 0 640 220" role="img" aria-label="연습 리포트 점수 추이">
              <g class="chart-grid">
                <line x1="42" y1="60" x2="598" y2="60" />
                <line x1="42" y1="110" x2="598" y2="110" />
                <line x1="42" y1="160" x2="598" y2="160" />
              </g>
              <path v-if="chartPoints.length > 1" :d="chartPath" class="chart-line" />
              <g
                v-for="point in chartPoints"
                :key="point.key"
                class="chart-point"
                :class="{ 'is-latest': point.isLatest }"
                :transform="`translate(${point.x} ${point.y})`"
              >
                <circle r="7" />
                <text class="chart-score" y="-16" text-anchor="middle">{{ point.scoreDisplay }}점</text>
                <text class="chart-label" y="32" text-anchor="middle">{{ point.label }}</text>
              </g>
            </svg>
          </div>
          <div v-else class="folder-line-chart folder-score-unavailable" role="status">
            <strong>점수 데이터 없음</strong>
            <p>가짜 점수를 만들지 않고 생성된 리포트가 확인될 때까지 비워둡니다.</p>
          </div>
        </section>
      </div>

      <section class="folder-attempt-panel" aria-labelledby="attemptTitle">
        <header class="folder-panel-head folder-attempt-heading-line">
          <div>
            <h2 id="attemptTitle">연습 기록</h2>
            <p>서버에서 조회한 실제 연습만 표시합니다.</p>
          </div>
          <span class="folder-attempt-count">총 {{ practices.length }}회</span>
        </header>

        <p v-if="archive.error" class="archive-list-state is-error" role="alert">{{ archive.error }}</p>
        <p v-else-if="!sortedPractices.length && !archive.loading" class="archive-list-state">완료된 발표 연습이 없습니다.</p>

        <div v-else class="folder-attempt-list">
          <article
            v-for="(row, index) in sortedPractices"
            :key="row.id"
            class="attempt-row"
            :class="{ 'is-latest': index === 0 }"
          >
            <span class="attempt-kind-date">{{ row.type === 'interview' ? '면접' : '발표' }} · {{ row.date }} {{ row.time }} · 녹화 {{ formatClock(row.durationSeconds) }}</span>
            <strong class="attempt-title" :title="row.title">{{ row.title }}</strong>
            <strong class="attempt-score">{{ row.score == null ? '점수 데이터 없음' : `${formatScore(row.score)}점` }}</strong>
            <RouterLink v-if="reportDomainId(row) != null" class="attempt-link" :to="reportDetailLocation(row)">
              리포트 상세보기 <span aria-hidden="true">&gt;</span>
            </RouterLink>
            <span v-else class="attempt-link is-disabled">리포트 ID 없음</span>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>
