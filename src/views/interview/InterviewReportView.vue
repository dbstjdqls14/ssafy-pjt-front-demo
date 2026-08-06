<script setup>
import { computed, onMounted, ref } from 'vue'

import { useCountUp } from '../../composables/useCountUp.js'
import { useInterviewStore } from '../../stores/interviewStore.js'
import { usePracticeStore } from '../../stores/practiceStore.js'

const interview = useInterviewStore()
const practice = usePracticeStore()

const loading = ref(false)
const loadError = ref('')
const hasScore = computed(() => {
  const score = Number(interview.report?.overallScore)
  return Number.isFinite(score) && score >= 0 && score <= 100
})
const targetScore = computed(() => (hasScore.value ? Math.round(Number(interview.report.overallScore)) : 0))
const { value: displayScore, start: animateScore } = useCountUp(targetScore, { step: 2, interval: 24 })
const detailLink = computed(() => ({
  path: '/interview/report/detail',
  query: {
    id: interview.report?.interviewId ?? interview.interviewId ?? undefined,
    folderId: practice.folderId ?? undefined,
    type: 'interview',
  },
}))

const resultTitle = computed(() => {
  const score = targetScore.value
  if (score >= 85) return '자신감 넘치는 면접이었어요!'
  if (score < 75) return '다음엔 더 잘할 수 있을 거예요'
  return '면접을 잘 마쳤어요!'
})

onMounted(async () => {
  if (!interview.report) {
    loading.value = true
    try {
      await interview.loadReport()
    } catch (error) {
      loadError.value = error?.message || '면접 결과를 불러오지 못했습니다.'
    } finally {
      loading.value = false
    }
  }
  if (hasScore.value) animateScore()
})
</script>

<template>
  <main class="page-shell presentation-result-shell">
    <div class="score-reveal">
      <p v-if="loading" class="result-load-state">면접 결과를 불러오는 중입니다.</p>
      <div v-else-if="loadError || !hasScore" class="result-load-state is-error" role="alert">
        <strong>면접 결과를 표시할 수 없습니다.</strong>
        <span>{{ loadError || '분석 점수 데이터가 없습니다.' }}</span>
      </div>
      <template v-else>
      <div class="score-ring" :style="{ '--score': displayScore }">
        <div class="score-value">
          <span>{{ displayScore }}</span>
          <small>점</small>
        </div>
      </div>
      <h2>{{ resultTitle }}</h2>
      <p>AI가 분석한 답변별 피드백과 다른 면접 대비 순위를 확인해보세요.</p>

      <div class="score-actions">
        <RouterLink :to="detailLink" class="btn-primary">상세 리포트 보기</RouterLink>
        <RouterLink to="/" class="btn-secondary">홈으로</RouterLink>
      </div>
      </template>
    </div>
  </main>
</template>
