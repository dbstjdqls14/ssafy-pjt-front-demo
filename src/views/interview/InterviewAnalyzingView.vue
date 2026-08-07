<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

const steps = ['영상 및 음성 분리', '답변 내용 구조 분석', '전달 방식과 비언어 분석', '질문별 종합 피드백 생성']
const pct = computed(() => interview.analysisProgress)
const total = computed(() => interview.questionCount || 5)
const analyzed = computed(() => Math.round((pct.value / 100) * total.value))
const activeStep = computed(() => Math.min(steps.length - 1, Math.floor((pct.value / 100) * steps.length)))
const failed = computed(() => interview.analysisStatus === 'failed')
const pollingJobStatuses = new Set(['PENDING', 'STT_ANALYZING', 'LLM_ANALYZING'])
const showBackgroundNotice = computed(() => (
  interview.analysisStatus === 'processing'
  && pollingJobStatuses.has(String(interview.reportJob?.status ?? '').toUpperCase())
))
const exitDescription = computed(() => (
  showBackgroundNotice.value
    ? '화면을 나가면 진행 상황 확인은 중단되지만 분석은 계속됩니다. 완료된 리포트는 내 기록에서 확인할 수 있습니다.'
    : '파일 전송이 끝나기 전에 나가면 분석이 시작되지 않을 수 있습니다. 잠시만 기다려 주세요.'
))

const ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000
let timer = null
let stopped = false
let pendingExitLocation = null
let allowRouteLeave = false
const showExit = ref(false)
let pollingStartedAt = 0

const shouldWarnBeforeExit = () => (
  !stopped
  && !failed.value
  && !allowRouteLeave
  && !showBackgroundNotice.value
)
const onBeforeUnload = (event) => {
  if (!shouldWarnBeforeExit()) return
  event.preventDefault()
  event.returnValue = true
}
const cancelExit = () => {
  pendingExitLocation = null
  showExit.value = false
}
const confirmExit = async () => {
  const destination = pendingExitLocation ?? '/practice'
  allowRouteLeave = true
  stopped = true
  showExit.value = false
  window.clearTimeout(timer)
  await router.push(destination)
}

onBeforeRouteLeave((to) => {
  if (!shouldWarnBeforeExit()) return true
  pendingExitLocation = to.fullPath
  showExit.value = true
  return false
})

const failByTimeout = () => {
  interview.analysisStatus = 'failed'
  interview.analysisError = '면접 분석이 10분 안에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.'
}

const remainingPollMs = () => {
  if (!pollingStartedAt) return ANALYSIS_TIMEOUT_MS
  return ANALYSIS_TIMEOUT_MS - (Date.now() - pollingStartedAt)
}

const schedulePoll = () => {
  if (stopped) return
  const remaining = remainingPollMs()
  if (remaining <= 0) {
    failByTimeout()
    return
  }
  timer = window.setTimeout(runPoll, Math.min(1000, remaining))
}

const runPoll = async () => {
  if (remainingPollMs() <= 0) {
    failByTimeout()
    return
  }
  try {
    const result = await interview.pollAnalysis()
    if (result.status === 'completed') {
      await interview.loadReport()
      if (!stopped) {
        allowRouteLeave = true
        await router.replace('/interview/report')
      }
      return
    }
    if (result.status !== 'failed') schedulePoll()
  } catch {
    schedulePoll()
  }
}

const start = async () => {
  stopped = false
  pollingStartedAt = Date.now()
  await interview.beginAnalysis()
  await runPoll()
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  void start()
})
onBeforeUnmount(() => {
  stopped = true
  window.removeEventListener('beforeunload', onBeforeUnload)
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
          <p class="analysis-retry-guidance">새 연습을 시작해 다시 시도해주세요.</p>
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
          <div
            v-if="showBackgroundNotice"
            class="interview-background-analysis-notice"
            data-testid="interview-background-analysis-notice"
            role="status"
          >
            <p class="interview-background-analysis-notice-title">분석 결과를 준비하고 있어요</p>
            <p class="interview-background-analysis-notice-description">페이지를 이동해도 분석은 계속되며, 완료 후 내 기록에서 확인할 수 있습니다.</p>
          </div>
        </template>
      </div>
    </section>
  </main>

  <div
    v-if="showExit"
    class="analysis-exit-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="interviewAnalysisExitTitle"
    data-testid="interview-analysis-exit-dialog"
  >
    <div class="analysis-exit-dialog">
      <h2 id="interviewAnalysisExitTitle">분석이 진행 중입니다</h2>
      <p>{{ exitDescription }}</p>
      <div class="analysis-exit-actions">
        <button type="button" data-testid="continue-interview-analysis" @click="cancelExit">분석 계속하기</button>
        <button type="button" class="is-danger" @click="confirmExit">그래도 나가기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-exit-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(23, 35, 70, .42);
}
.analysis-exit-dialog {
  width: min(440px, 100%);
  padding: 28px;
  border: 1px solid #dbe3f3;
  border-radius: 16px;
  background: #fff;
  color: #172346;
  box-shadow: 0 20px 55px rgba(23, 35, 70, .2);
}
.analysis-exit-dialog h2 { margin: 0; font-size: 22px; line-height: 1.35; }
.analysis-exit-dialog p { margin: 12px 0 24px; color: #66738f; font-size: 15px; line-height: 1.55; }
.analysis-exit-actions { display: flex; justify-content: flex-end; gap: 10px; }
.analysis-exit-actions button {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid #d4ddef;
  border-radius: 999px;
  background: #fff;
  color: #33405f;
  font-weight: 800;
  cursor: pointer;
}
.analysis-exit-actions .is-danger { border-color: #e05252; background: #e05252; color: #fff; }
/* 발표 분석 화면과 같은 안내 카드 — 설명 문구가 한 줄로 읽히게 폭을 문구에 맞춘다. */
.interview-background-analysis-notice {
  width: fit-content;
  max-width: 100%;
  margin: 16px auto 0;
  padding: 10px 18px;
  border: 1px solid #e2e7f2;
  border-radius: 10px;
  background: #f7f8fc;
  text-align: center;
}
.interview-background-analysis-notice p { margin: 0; }
.interview-background-analysis-notice-title {
  color: #34405b;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.45;
}
.interview-background-analysis-notice-description {
  margin-top: 3px !important;
  color: #8b95aa;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
}
@media (max-width: 560px) {
  .interview-background-analysis-notice-description {
    white-space: normal;
  }
}
</style>
