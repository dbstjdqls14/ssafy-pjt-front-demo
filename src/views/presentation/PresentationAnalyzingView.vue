<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { usePresentationStore } from '../../stores/presentationStore.js'

const router = useRouter()
const presentation = usePresentationStore()

const steps = [
  '영상 및 음성 분리',
  '슬라이드별 발화 구조 분석',
  '전달 방식과 비언어 분석',
  '슬라이드별 종합 피드백 생성',
]

// 'analyzing' → 진행 중, 'failed' → 분석 실패(재시도 가능)
const status = ref('analyzing')
const pct = ref(0)
const slideTotal = computed(() => presentation.slideCount || 12)
const analyzedSlides = computed(() => Math.round((pct.value / 100) * slideTotal.value))
const activeStep = computed(() => Math.min(steps.length - 1, Math.floor((pct.value / 100) * steps.length)))

let timer = null

const clearTimer = () => {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

const startAnalysis = () => {
  clearTimer()
  status.value = 'analyzing'
  pct.value = 0
  timer = window.setInterval(async () => {
    pct.value = Math.min(100, pct.value + 4)
    if (pct.value >= 100) {
      clearTimer()
      try {
        await presentation.loadReport()
        window.setTimeout(() => router.push('/presentation/report'), 500)
      } catch {
        // 분석 서비스 응답 실패 → 실패 화면으로 전환(진행 상태 유지)
        status.value = 'failed'
      }
    }
  }, 140)
}

const retry = () => startAnalysis()

onMounted(startAnalysis)
onBeforeUnmount(clearTimer)
</script>

<template>
  <main class="page-shell wide presentation-analysis-shell">
    <section v-if="status === 'analyzing'" class="analysis-status-panel">
      <div style="display:grid;place-items:center;">
        <div class="analysis-progress-state" :style="{ '--pct': pct }"><span>{{ pct }}%</span></div>
        <p style="color:#94a3b8;font-size:12px;font-weight:700;">발표 분석 중</p>
      </div>

      <div class="analysis-status-content">
        <h3 style="font-size:16px;font-weight:900;">슬라이드 {{ slideTotal }}개 중 {{ analyzedSlides }}개 분석 완료</h3>
        <p style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:700;">예상 남은 시간 약 1분</p>
        <div style="height:6px;border-radius:999px;background:#eceefc;margin-top:10px;overflow:hidden;">
          <div :style="{ height: '100%', width: `${pct}%`, background: '#4338ca', borderRadius: '999px' }"></div>
        </div>

        <ul class="analyzing-status" style="margin-top:20px;">
          <li
            v-for="(step, index) in steps"
            :key="step"
            :class="{ active: index === activeStep }"
            :data-icon="index + 1"
          >{{ step }}</li>
        </ul>
        <p style="margin-top:14px;color:#94a3b8;font-size:11px;font-weight:600;">이 화면을 나가도 분석은 계속 진행됩니다.</p>
      </div>
    </section>

    <section v-else class="analysis-failure-panel">
      <div class="analysis-failure-icon" aria-hidden="true">!</div>
      <h3>분석에 실패했어요</h3>
      <p>일시적인 오류로 발표 분석을 마치지 못했습니다.<br />녹화 영상은 그대로 보관되어 있으니 다시 시도해 주세요.</p>
      <div class="analysis-failure-actions">
        <button type="button" class="btn-primary" @click="retry">다시 분석하기</button>
        <RouterLink to="/" class="btn-secondary">홈으로</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.analysis-failure-panel {
  max-width: 460px;
  margin: 0 auto;
  padding: 40px 32px;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #e4e7f0;
  border-radius: 20px;
  box-shadow: 0 18px 44px rgba(48, 42, 120, 0.08);
}

.analysis-failure-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: #fdeceb;
  color: #e0483d;
  font-size: 28px;
  font-weight: 900;
}

.analysis-failure-panel h3 {
  font-size: 18px;
  font-weight: 900;
  color: #1f2440;
}

.analysis-failure-panel p {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.analysis-failure-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
</style>
