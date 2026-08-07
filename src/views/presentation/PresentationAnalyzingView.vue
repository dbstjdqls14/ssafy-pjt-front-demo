<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { usePresentationStore } from '../../stores/presentationStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import {
  clearActiveRecording,
  queueRecordingResetNotice,
  shouldResetRecordingAfterReload,
} from '../../utils/recordingRefreshRecovery.js'

const REPORT_POLL_INTERVAL_MS = 2_000
const REPORT_POLL_MAX_ATTEMPTS = 90

const route = useRoute()
const router = useRouter()
const presentation = usePresentationStore()
const recording = useRecordingStore()

const steps = [
  '녹화 파일 및 발표 데이터 전송',
  '음성·비언어 분석',
  '슬라이드별 피드백 생성',
  '최종 리포트 구성',
]
const progress = ref(route.query.phase === 'report' ? 55 : 8)
const stage = ref(route.query.phase === 'report' ? 'report' : 'complete')
const status = ref('running')
const reportJobStatus = ref(null)
const errorMessage = ref('')
const reportAttempts = ref(0)
const showExit = ref(false)
const serverAccepted = ref(false)

const failed = computed(() => status.value === 'failed')
const pollingJobStatuses = new Set(['PENDING', 'STT_ANALYZING', 'LLM_ANALYZING'])
const acceptedStatuses = new Set([...pollingJobStatuses, 'COMPLETED'])
const noticeTitle = computed(() => (
  serverAccepted.value ? '분석 결과를 준비하고 있어요' : '녹화 파일을 업로드하고 있어요'
))
const noticeDescription = computed(() => (
  serverAccepted.value
    ? '페이지를 이동해도 분석은 계속되며, 완료 후 내 기록에서 확인할 수 있습니다.'
    : '아직 서버에 안전하게 저장되지 않았어요. 잠시만 기다려 주세요. 새로고침하거나 페이지를 나가면 정보가 유실될 수 있어요.'
))
const headline = computed(() => {
  const jobStatus = String(reportJobStatus.value ?? '').toUpperCase()
  if (jobStatus === 'PENDING') return '발표 분석 순서를 기다리고 있어요'
  if (jobStatus === 'STT_ANALYZING') return '발표 음성을 분석하고 있어요'
  if (jobStatus === 'LLM_ANALYZING') return '발표 내용과 피드백을 생성하고 있어요'
  if (stage.value === 'complete') return '발표 녹화 파일을 전송하고 있어요'
  if (stage.value === 'questions') return '발표 내용을 바탕으로 질문을 만들고 있어요'
  return '발표 리포트를 생성하고 있어요'
})
const activeStep = computed(() => {
  const value = String(reportJobStatus.value ?? '').toUpperCase()
  if (value === 'STT_ANALYZING') return 1
  if (value === 'LLM_ANALYZING') return 2
  if (value === 'COMPLETED') return 3
  return 0
})

let pollTimer = null
let stopped = false
let pendingExitLocation = null
let allowRouteLeave = false

const shouldWarnBeforeExit = () => !serverAccepted.value && !allowRouteLeave

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
  const exitLocation = pendingExitLocation ?? '/archive'
  allowRouteLeave = true
  stopped = true
  showExit.value = false
  window.clearTimeout(pollTimer)
  clearActiveRecording('presentation')
  presentation.reset()
  recording.reset()
  await router.push(exitLocation)
}

onBeforeRouteLeave((to) => {
  if (!shouldWarnBeforeExit()) return true
  pendingExitLocation = to.fullPath
  showExit.value = true
  return false
})

const fail = (error) => {
  status.value = 'failed'
  errorMessage.value = error?.message || '발표 분석을 완료하지 못했습니다.'
}

const pollReport = async () => {
  if (stopped) return
  try {
    const job = await presentation.loadReportJobStatus(presentation.sessionId)
    const jobStatus = String(job?.status ?? '').toUpperCase()
    reportJobStatus.value = jobStatus

    if (jobStatus === 'FAILED') {
      fail(new Error(job?.errorMessage || '발표 분석을 완료하지 못했습니다.'))
      return
    }
    if (!acceptedStatuses.has(jobStatus)) {
      fail(new Error(`알 수 없는 발표 분석 상태입니다: ${jobStatus || 'EMPTY'}`))
      return
    }

    serverAccepted.value = true
    clearActiveRecording('presentation')
    if (pendingExitLocation) {
      const exitLocation = pendingExitLocation
      pendingExitLocation = null
      allowRouteLeave = true
      showExit.value = false
      stopped = true
      window.clearTimeout(pollTimer)
      await router.push(exitLocation)
      return
    }

    if (jobStatus === 'COMPLETED') {
      await presentation.loadReport(presentation.sessionId)
      progress.value = 100
      if (!stopped) {
        status.value = 'completed'
        allowRouteLeave = true
        await router.replace('/presentation/report')
      }
      return
    }
    progress.value = jobStatus === 'PENDING' ? 58 : jobStatus === 'STT_ANALYZING' ? 72 : 88
  } catch (error) {
    fail(error)
    return
  }

  reportAttempts.value += 1
  if (reportAttempts.value >= REPORT_POLL_MAX_ATTEMPTS) {
    fail(new Error('발표 분석이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'))
    return
  }
  pollTimer = window.setTimeout(pollReport, REPORT_POLL_INTERVAL_MS)
}

const runAnalysis = async () => {
  window.clearTimeout(pollTimer)
  pollTimer = null
  status.value = 'running'
  errorMessage.value = ''
  reportAttempts.value = 0
  reportJobStatus.value = null
  serverAccepted.value = false

  try {
    if (route.query.phase !== 'report' && presentation.qnaEnabled) {
      stage.value = 'questions'
      progress.value = 30
      await presentation.generateAudienceQuestions()
      if (!stopped) {
        status.value = 'completed'
        allowRouteLeave = true
        await router.replace('/presentation/qna')
      }
      return
    }

    if (presentation.sessionStatus !== 'completed') {
      stage.value = 'complete'
      progress.value = 12
      await presentation.completeSession({
        durationMs: presentation.recordingArtifacts?.durationMs,
      })
    }

    progress.value = 45
    stage.value = 'report'
    progress.value = 55
    await pollReport()
  } catch (error) {
    fail(error)
  }
}

const recoverReloadedPresentation = async () => {
  if (!shouldResetRecordingAfterReload('presentation')) return false
  allowRouteLeave = true
  clearActiveRecording('presentation')
  presentation.reset()
  recording.reset()
  queueRecordingResetNotice('presentation')
  await router.replace('/')
  return true
}

onMounted(async () => {
  stopped = false
  if (await recoverReloadedPresentation()) return
  window.addEventListener('beforeunload', onBeforeUnload)
  void runAnalysis()
})

onBeforeUnmount(() => {
  stopped = true
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.clearTimeout(pollTimer)
})
</script>

<template>
  <main class="page-shell wide presentation-analysis-shell">
    <section class="analysis-status-panel">
      <div class="presentation-analysis-progress">
        <div class="analysis-progress-state" :class="{ 'is-failed': failed }" :style="{ '--pct': progress }">
          <span>{{ failed ? '!' : `${progress}%` }}</span>
        </div>
        <p>{{ failed ? '분석 중단' : '발표 분석 중' }}</p>
      </div>

      <div class="analysis-status-content">
        <div v-if="failed" class="presentation-analysis-failed">
          <h3>발표 분석을 완료하지 못했습니다.</h3>
          <p class="analysis-error-message" role="alert">{{ errorMessage }}</p>
          <p class="analysis-retry-guidance">새 연습을 시작해 다시 시도해주세요.</p>
        </div>
        <template v-else>
          <h3 id="progressHeadline">{{ headline }}</h3>
          <p class="presentation-analysis-caption">서버가 발표 내용과 음성·몸짓을 분석하고 있습니다.</p>
          <div class="presentation-analysis-bar" aria-hidden="true">
            <div :style="{ width: `${progress}%` }"></div>
          </div>
          <ul class="analyzing-status">
            <li
              v-for="(step, index) in steps"
              :key="step"
              :class="{ active: index === activeStep }"
              :data-icon="index + 1"
            >{{ step }}</li>
          </ul>
          <div
            v-if="status === 'running'"
            class="presentation-background-analysis-notice"
            data-testid="presentation-analysis-notice"
            role="status"
          >
            <p class="presentation-background-analysis-notice-title">{{ noticeTitle }}</p>
            <p class="presentation-background-analysis-notice-description">{{ noticeDescription }}</p>
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
    aria-labelledby="presentationAnalysisExitTitle"
    data-testid="presentation-analysis-exit-dialog"
  >
    <div class="analysis-exit-dialog">
      <h2 id="presentationAnalysisExitTitle">아직 파일 업로드가 끝나지 않았어요</h2>
      <p>녹화 파일이 아직 서버에 안전하게 저장되지 않았어요. 잠시만 기다려 주세요. 지금 나가면 정보가 유실될 수 있어요.</p>
      <div class="analysis-exit-actions">
        <button type="button" data-testid="continue-presentation-analysis" @click="cancelExit">계속 기다리기</button>
        <button type="button" class="is-danger" @click="confirmExit">그래도 나가기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.presentation-analysis-progress {
  display: grid !important;
  place-items: center;
}
.presentation-analysis-progress > p,
.presentation-analysis-caption {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}
.presentation-analysis-progress > p {
  margin: 8px 0 0;
}
.presentation-analysis-caption {
  margin: 4px 0 0;
}
.presentation-analysis-bar {
  height: 6px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #eceefc;
}
.presentation-analysis-bar > div {
  height: 100%;
  border-radius: inherit;
  background: #4e6fc2;
  transition: width .3s ease;
}
.presentation-analysis-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.presentation-analysis-failed h3,
.presentation-analysis-failed p {
  margin: 0;
}
.presentation-analysis-failed .analysis-retry-guidance {
  margin-top: 6px;
  color: #66738f;
  font-size: 14px;
  font-weight: 700;
}
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
.analysis-exit-dialog h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.35;
}
.analysis-exit-dialog p {
  margin: 12px 0 24px;
  color: #66738f;
  font-size: 15px;
  line-height: 1.55;
}
.analysis-exit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
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
.analysis-exit-actions .is-danger {
  border-color: #e05252;
  background: #e05252;
  color: #fff;
}
/* 분석 안내 카드는 부모 폭 안에 고정하고 긴 문구는 카드 내부에서 줄바꿈한다. */
.presentation-background-analysis-notice {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 16px auto 0;
  padding: 10px 18px;
  border: 1px solid #e2e7f2;
  border-radius: 10px;
  background: #f7f8fc;
  text-align: center;
}
.presentation-background-analysis-notice p {
  margin: 0;
}
.presentation-background-analysis-notice-title {
  color: #34405b;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.45;
}
.presentation-background-analysis-notice-description {
  margin-top: 3px !important;
  color: #8b95aa;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: break-word;
  white-space: normal;
}
</style>
