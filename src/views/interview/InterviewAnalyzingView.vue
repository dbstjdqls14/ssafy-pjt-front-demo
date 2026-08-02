<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

const steps = ['영상 및 음성 분리', '답변 내용 구조 분석', '전달 방식과 비언어 분석', '질문별 종합 피드백 생성']
const pct = computed(() => interview.analysisProgress)
const total = computed(() => interview.questionCount || 5)
const analyzed = computed(() => Math.round((pct.value / 100) * total.value))
const activeStep = computed(() => Math.min(steps.length - 1, Math.floor((pct.value / 100) * steps.length)))
const failed = computed(() => interview.analysisStatus === 'failed')

let timer = null
let stopped = false

const schedulePoll = () => {
  if (!stopped) timer = window.setTimeout(runPoll, 1000)
}

const runPoll = async () => {
  try {
    const result = await interview.pollAnalysis()
    if (result.status === 'completed') {
      await interview.loadReport()
      if (!stopped) await router.replace('/interview/report')
      return
    }
    if (result.status !== 'failed') schedulePoll()
  } catch {
    schedulePoll()
  }
}

const start = async () => {
  stopped = false
  await interview.beginAnalysis()
  await runPoll()
}

const retry = async () => {
  window.clearTimeout(timer)
  await interview.retryAnalysis()
  await runPoll()
}

onMounted(start)
onBeforeUnmount(() => {
  stopped = true
  window.clearTimeout(timer)
})
</script>

<template>
  <main class="page-shell wide presentation-analysis-shell">
    <section class="analysis-status-panel">
      <div style="display:grid;place-items:center;">
        <div class="analysis-progress-state" :class="{ 'is-failed': failed }" :style="{ '--pct': pct }"><span>{{ failed ? '!' : `${pct}%` }}</span></div>
        <p style="color:#94a3b8;font-size:12px;font-weight:700;">{{ failed ? '분석 중단' : '답변 분석 중' }}</p>
      </div>

      <div class="analysis-status-content">
        <div v-if="failed" class="iv-analysis-failed">
          <h3 class="iv-analysis-failed-title">면접 분석을 완료하지 못했습니다.</h3>
          <p class="analysis-error-message" role="alert">{{ interview.analysisError }}</p>
          <button type="button" class="analysis-retry-button" @click="retry">다시 분석하기</button>
        </div>
        <template v-else>
          <h3 style="font-size:16px;font-weight:900;">답변 {{ total }}개 중 {{ analyzed }}개 분석 완료</h3>
          <p style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:700;">서버가 답변 내용과 음성을 분석하고 있어요.</p>
          <div style="height:6px;border-radius:999px;background:#eceefc;margin-top:10px;overflow:hidden;">
            <div :style="{ height: '100%', width: `${pct}%`, background: '#4e6fc2', borderRadius: '999px', transition: 'width .3s ease' }"></div>
          </div>

          <ul class="analyzing-status" style="margin-top:20px;">
            <li v-for="(step, index) in steps" :key="step" :class="{ active: index === activeStep }" :data-icon="index + 1">{{ step }}</li>
          </ul>
        </template>
      </div>
    </section>
  </main>
</template>
