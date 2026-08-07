<script setup>
import { computed, onMounted } from 'vue'

import { useCountUp } from '../../composables/useCountUp.js'
import { useInterviewStore } from '../../stores/interviewStore.js'

const interview = useInterviewStore()

const targetScore = computed(() => interview.report?.overallScore ?? 84)
const { value: displayScore, start: animateScore } = useCountUp(targetScore, { step: 2, interval: 24 })

const resultTitle = computed(() => {
  const score = targetScore.value
  if (score >= 85) return '자신감 넘치는 면접이었어요!'
  if (score < 75) return '다음엔 더 잘할 수 있을 거예요'
  return '면접을 잘 마쳤어요!'
})

onMounted(async () => {
  if (!interview.report) await interview.loadReport()
  animateScore()
})
</script>

<template>
  <main class="page-shell presentation-result-shell">
    <div class="score-reveal">
      <div class="score-ring" :style="{ '--score': displayScore }">
        <div class="score-value">
          <span>{{ displayScore }}</span>
          <small>점</small>
        </div>
      </div>
      <h2>{{ resultTitle }}</h2>
      <p>AI가 분석한 답변별 피드백과 다른 면접 대비 순위를 확인해보세요.</p>

      <div class="score-actions">
        <RouterLink to="/interview/report/detail" class="btn-primary">상세 리포트 보기</RouterLink>
        <RouterLink to="/" class="btn-secondary">홈으로</RouterLink>
      </div>
    </div>
  </main>
</template>
