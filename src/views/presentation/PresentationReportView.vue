<script setup>
import { computed, onMounted } from 'vue'

import { useCountUp } from '../../composables/useCountUp.js'
import { useArchiveStore } from '../../stores/archiveStore.js'
import { usePresentationStore } from '../../stores/presentationStore.js'

const presentation = usePresentationStore()
const archive = useArchiveStore()

// 상세 리포트로 넘길 세션 id. 방금 끝난 세션 id를 우선 사용하고, 없으면
// 같은 제목의 발표 기록 → 시드 발표 순으로 폴백해 항상 채워진 리포트로 연결한다.
const reportId = computed(() => {
  if (presentation.sessionId) return presentation.sessionId
  const match = archive.sessions.find(
    (s) => s.type === 'presentation' && s.title === presentation.title,
  )
  return match?.id ?? 'svc-intro'
})

const targetScore = computed(() => presentation.report?.overallScore ?? 84)
const { value: displayScore, start: animateScore } = useCountUp(targetScore, { step: 2, interval: 24 })

const resultTitle = computed(() => {
  const score = targetScore.value
  if (score >= 85) return '완벽한 발표였어요!'
  if (score < 75) return '조금만 더 연습하면 좋아질 거예요'
  return '발표를 잘 마쳤어요!'
})

onMounted(async () => {
  if (!presentation.report) await presentation.loadReport()
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
      <p>AI가 분석한 상세 리포트에서 슬라이드별 피드백을 확인해보세요.</p>

      <div class="score-actions">
        <RouterLink :to="{ path: '/archive/detail', query: { id: reportId } }" class="btn-primary">상세 리포트 보기</RouterLink>
        <RouterLink to="/" class="btn-secondary">홈으로</RouterLink>
      </div>
    </div>
  </main>
</template>
