<script setup>
import { computed, onMounted } from 'vue'

import { usePresentationStore } from '../../stores/presentationStore.js'

const presentation = usePresentationStore()

const durationLabel = computed(() => {
  const seconds = presentation.report?.durationSeconds ?? presentation.recordedSeconds
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const audioChunkCount = computed(() => presentation.report?.audioAnalysisResults?.length ?? 0)
const textVisitCount = computed(() => presentation.report?.text?.length ?? 0)
const detectWindowCount = computed(() => presentation.report?.detects?.length ?? 0)

onMounted(async () => {
  if (!presentation.report) await presentation.loadReport()
})
</script>

<template>
  <main class="page-shell presentation-result-shell">
    <section class="presentation-complete-panel">
      <p class="presentation-complete-eyebrow">발표 저장 완료</p>
      <h1>발표를 마쳤습니다.</h1>
      <p class="presentation-complete-copy">
        Spring 완료 API에는 발표 시간이 정상 전송되었습니다.
        현재 백엔드에는 발표 점수·상세 리포트 조회 API가 없어 임의 점수나 가짜 리포트는 표시하지 않습니다.
      </p>

      <dl class="presentation-complete-summary">
        <div><dt>발표 시간</dt><dd>{{ durationLabel }}</dd></div>
        <div><dt>10초 음성 분석</dt><dd>{{ audioChunkCount }}개 응답</dd></div>
        <div><dt>슬라이드 방문 발화</dt><dd>{{ textVisitCount }}개</dd></div>
        <div><dt>자세·시선 구간</dt><dd>{{ detectWindowCount }}개</dd></div>
      </dl>

      <div class="presentation-complete-actions">
        <RouterLink to="/presentation/artifacts" class="btn-secondary">종료 데이터 다시 보기</RouterLink>
        <RouterLink to="/" class="btn-primary">홈으로</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.presentation-complete-panel {
  width: min(760px, calc(100% - 32px));
  margin: 56px auto;
  padding: 42px;
  border: 1px solid #e4e7f0;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(48, 42, 120, .08);
}
.presentation-complete-eyebrow { margin: 0 0 8px; color: #4f46e5; font-weight: 800; }
.presentation-complete-panel h1 { margin: 0; color: #1f2440; font-size: 32px; }
.presentation-complete-copy { margin: 16px 0 28px; color: #64748b; line-height: 1.7; }
.presentation-complete-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 0; }
.presentation-complete-summary div { padding: 18px; border-radius: 14px; background: #f8fafc; }
.presentation-complete-summary dt { color: #64748b; font-size: 13px; font-weight: 700; }
.presentation-complete-summary dd { margin: 6px 0 0; color: #1f2440; font-size: 20px; font-weight: 900; }
.presentation-complete-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 28px; }
@media (max-width: 600px) {
  .presentation-complete-panel { padding: 28px 20px; }
  .presentation-complete-summary { grid-template-columns: 1fr; }
}
</style>
