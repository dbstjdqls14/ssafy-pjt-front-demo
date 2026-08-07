<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import {
  clearActiveRecording,
  queueRecordingResetNotice,
  shouldResetRecordingAfterReload,
} from '../../utils/recordingRefreshRecovery.js'

const router = useRouter()
const speech = useSpeechRecognition()
const presentation = usePresentationStore()
const recording = useRecordingStore()

const questions = ref([])
const generating = ref(true)
const answers = ref([])
const selectedId = ref(null)
const isFinishing = ref(false)
const finishError = ref('')
const isSubmittingAnswer = ref(false)
const pendingAnswer = ref(null)
const showExit = ref(false)
const isDiscardingExit = ref(false)
let pendingExitLocation = null
let allowRouteLeave = false
const MAX_SESSION_QUESTIONS = 3

const loadQuestions = async () => {
  generating.value = true
  questions.value = []
  finishError.value = ''
  try {
    const loaded = presentation.audienceQuestions.length
      ? presentation.audienceQuestions
      : await presentation.loadAudienceQuestions()
    questions.value = loaded.slice(0, MAX_SESSION_QUESTIONS).map((question, index) => ({
      id: question.id,
      code: `Q${index + 1}`,
      text: question.content ?? question.question,
      answered: false,
      skipped: false,
    }))
    selectedId.value = questions.value[0]?.id ?? null
  } catch (error) {
    finishError.value = error?.message || '청중 질문을 불러오지 못했습니다.'
  } finally {
    generating.value = false
  }
}

const isRecording = ref(false)
const elapsed = ref(0) // seconds
let rafId = null
let startedAt = 0

const total = computed(() => questions.value.length)
const remaining = computed(() => questions.value.filter((q) => !q.answered && !q.skipped))
const selected = computed(() => questions.value.find((q) => q.id === selectedId.value) ?? null)

const answeredCount = computed(() => answers.value.length)
const skippedCount = computed(() => questions.value.filter((question) => question.skipped).length)
const allSkipped = computed(() => total.value > 0 && skippedCount.value === total.value)
const allDone = computed(() => !generating.value && questions.value.length > 0 && remaining.value.length === 0)
const questionControlsLocked = computed(() => (
  generating.value || isRecording.value || isSubmittingAnswer.value || isFinishing.value
))
const answerActionLocked = computed(() => generating.value || isSubmittingAnswer.value || isFinishing.value)
const canFinish = computed(() => allDone.value && !questionControlsLocked.value)
const completionTitle = computed(() => skippedCount.value
  ? '모든 질문을 확인했습니다.'
  : '모든 질문에 답변했습니다.')
const feedbackNotice = computed(() => {
  if (allSkipped.value) return '모든 질문을 건너뛰어 질의응답 점수와 피드백이 생성되지 않습니다.'
  if (skippedCount.value) return `건너뛴 ${skippedCount.value}개 질문은 질의응답 점수와 피드백에서 제외됩니다.`
  return '질문을 건너뛰면 해당 질문의 질의응답 점수와 피드백은 생성되지 않습니다.'
})

const timerLabel = computed(() => {
  const s = Math.floor(elapsed.value)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const isOvertime = computed(() => elapsed.value > 60)
const fillWidth = computed(() => `${Math.min((elapsed.value / 60) * 100, 100)}%`)
const timerGuide = computed(() =>
  isOvertime.value ? `권장 시간보다 ${Math.floor(elapsed.value - 60)}초 초과했습니다.` : '권장 답변 시간은 1분입니다.',
)
const hint = computed(() => {
  if (allDone.value) return `${completionTitle.value} 발표를 최종 종료해 주세요.`
  if (!answeredCount.value) return '질문 카드를 선택한 뒤 답변을 시작해 주세요.'
  return `${remaining.value.length}개의 질문이 남았습니다.`
})

// 녹음 중 실시간 자막(음성 인식이 지원되는 브라우저에서만 채워진다).
const liveTranscript = computed(() => speech.transcript.value)
const formatDuration = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

const selectQuestion = (id) => {
  if (questionControlsLocked.value) return
  const question = questions.value.find((item) => item.id === id)
  if (!question || question.answered || question.skipped) return
  selectedId.value = id
}

const loop = (now) => {
  if (!isRecording.value) return
  elapsed.value = (now - startedAt) / 1000
  rafId = requestAnimationFrame(loop)
}

const startAnswer = () => {
  if (answerActionLocked.value || isRecording.value || !selected.value) return
  if (pendingAnswer.value?.id === selected.value.id) {
    void submitPendingAnswer()
    return
  }
  finishError.value = ''
  isRecording.value = true
  elapsed.value = 0
  startedAt = performance.now()
  speech.reset()
  try {
    speech.start({ lang: 'ko-KR' })
  } catch {
    /* timer-only if speech unsupported */
  }
  rafId = requestAnimationFrame(loop)
}

const stopCapture = () => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  speech.stop()
}

const shouldWarnBeforeExit = () => !allowRouteLeave

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
  if (isDiscardingExit.value) return
  const exitLocation = pendingExitLocation ?? '/'
  isDiscardingExit.value = true
  allowRouteLeave = true
  showExit.value = false
  isRecording.value = false
  stopCapture()
  clearActiveRecording('presentation')
  presentation.reset()
  recording.reset()
  try {
    await router.push(exitLocation)
  } catch (error) {
    allowRouteLeave = false
    showExit.value = true
    finishError.value = error?.message || '질의 응답 화면에서 나가지 못했습니다.'
  } finally {
    isDiscardingExit.value = false
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

const submitPendingAnswer = async () => {
  if (!pendingAnswer.value || isSubmittingAnswer.value) return
  isSubmittingAnswer.value = true
  finishError.value = ''
  const draft = pendingAnswer.value
  try {
    await presentation.submitAudienceAnswer(draft.id, draft.answer)
    answers.value.push(draft)
    const answeredQuestion = questions.value.find((question) => question.id === draft.id)
    if (answeredQuestion) answeredQuestion.answered = true
    pendingAnswer.value = null
    elapsed.value = 0
    const next = remaining.value[0]
    if (next) selectedId.value = next.id
  } catch (error) {
    finishError.value = error?.message || '답변을 저장하지 못했습니다. 같은 답변으로 다시 시도해 주세요.'
  } finally {
    isSubmittingAnswer.value = false
  }
}

const completeAnswer = async () => {
  if (!isRecording.value || !selected.value || isSubmittingAnswer.value) return
  isRecording.value = false
  const answerSnapshot = String(speech.transcript.value ?? '').trim()
  stopCapture()
  const q = selected.value
  pendingAnswer.value = {
    id: q.id,
    question: q.text,
    answer: answerSnapshot,
    duration: Math.round(elapsed.value),
  }
  await submitPendingAnswer()
}

const skipCurrentQuestion = () => {
  if (!selected.value || isRecording.value || isSubmittingAnswer.value || isFinishing.value) return
  finishError.value = ''
  const skippedQuestion = selected.value
  skippedQuestion.skipped = true
  pendingAnswer.value = null
  elapsed.value = 0
  selectedId.value = remaining.value[0]?.id ?? null
}

const finish = async () => {
  if (!canFinish.value || isFinishing.value) return
  isFinishing.value = true
  finishError.value = ''
  allowRouteLeave = true
  try {
    await router.push({ path: '/presentation/analyzing', query: { phase: 'report' } })
  } catch (error) {
    allowRouteLeave = false
    finishError.value = error?.message || '질의 응답 화면을 종료하지 못했습니다.'
  } finally {
    isFinishing.value = false
  }
}

onMounted(async () => {
  if (await recoverReloadedPresentation()) return
  window.addEventListener('beforeunload', onBeforeUnload)
  await loadQuestions()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  stopCapture()
})

onBeforeRouteLeave((to) => {
  if (!shouldWarnBeforeExit()) return true
  pendingExitLocation = to.fullPath
  showExit.value = true
  return false
})
</script>

<template>
  <main class="qna-page-shell">
    <header class="qna-page-head">
      <h1>질의 응답</h1>
      <span class="qna-progress">{{ answeredCount }} / {{ total }} 답변</span>
    </header>
    <section class="qna-question-panel" aria-label="답변할 질문 선택">
      <div v-if="generating" class="qna-generating" aria-live="polite">
        <span class="qna-generating-spinner" aria-hidden="true"></span>
        <p>발표 내용을 바탕으로 질문을 만들고 있어요<span class="qna-generating-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      </div>
      <ol class="qna-question-list" :style="{ '--qna-question-count': Math.max(total, 1) }">
        <li
          v-for="q in questions"
          :key="q.id"
          class="qna-question-item qna-question-item-gen"
          :class="{ 'is-active': q.id === selectedId, 'is-answered': q.answered, 'is-skipped': q.skipped }"
        >
          <button type="button" :disabled="q.answered || q.skipped || questionControlsLocked" @click="selectQuestion(q.id)">
            <span>{{ q.code }}<small v-if="q.answered">답변 완료</small><small v-else-if="q.skipped">건너뜀</small></span>
            <p>{{ q.text }}</p>
          </button>
        </li>
      </ol>
    </section>

    <section class="qna-answer-panel">
      <div class="qna-active-question">
        <span>{{ generating ? '생성 중' : (allDone ? '완료' : selected?.code) }}</span>
        <h2>{{ generating ? '질문을 만들고 있어요…' : (allDone ? completionTitle : selected?.text) }}</h2>
      </div>

      <div class="qna-answer-bar" :class="{ 'is-recording': isRecording, 'is-overtime': isOvertime }">
        <div class="qna-answer-time">
          <strong>{{ timerLabel }}</strong>
          <span>{{ timerGuide }}</span>
        </div>
        <button
          type="button"
          :class="{ 'is-complete': isRecording, 'is-start': !isRecording }"
          :disabled="allDone || answerActionLocked"
          @click="isRecording ? completeAnswer() : startAnswer()"
        >{{ allDone ? '답변 완료' : (isSubmittingAnswer ? '답변 저장 중…' : (isRecording ? '답변 완료' : (pendingAnswer?.id === selected?.id ? '저장 다시 시도' : '답변 시작'))) }}</button>
      </div>
      <div class="qna-answer-timeline" :class="{ 'is-overtime': isOvertime }" aria-hidden="true">
        <span class="qna-answer-timeline-fill" :style="{ width: fillWidth }"></span>
      </div>

      <div class="qna-live-caption-slot">
        <div v-if="isRecording" class="qna-live-caption" aria-live="polite">
          <span class="qna-live-caption-dot" aria-hidden="true"></span>
          <p v-if="liveTranscript">{{ liveTranscript }}</p>
          <p v-else class="qna-live-caption-empty">답변을 시작하면 말한 내용이 여기에 실시간으로 표시됩니다.</p>
        </div>
      </div>

      <div class="qna-answer-log-slot">
        <div v-if="answers.length" class="qna-answer-log">
          <h3>내 답변 기록</h3>
          <ul>
            <li v-for="item in answers" :key="item.id">
              <div class="qna-answer-log-head">
                <p class="qna-answer-log-q">{{ item.question }}</p>
                <span class="qna-answer-log-dur">{{ formatDuration(item.duration) }}</span>
              </div>
              <p v-if="item.answer" class="qna-answer-log-a">{{ item.answer }}</p>
              <p v-else class="qna-answer-log-a is-empty">음성이 인식되지 않았어요. (답변 시간만 기록됨)</p>
            </li>
          </ul>
        </div>
      </div>

      <div class="qna-complete-row">
        <p>{{ finishError || hint }}</p>
        <p class="qna-feedback-notice" :class="{ 'is-warning': skippedCount > 0 }">{{ feedbackNotice }}</p>
        <button
          data-testid="skip-question"
          type="button"
          class="qna-skip-button"
          :disabled="allDone || generating || isRecording || isSubmittingAnswer || isFinishing"
          @click="skipCurrentQuestion"
        >{{ allDone ? '모든 질문 확인 완료' : '현재 질문 건너뛰기' }}</button>
        <button
          id="finishQnaBtn"
          data-testid="finish-qna"
          type="button"
          :disabled="!canFinish || isFinishing"
          @click="finish"
        >
          {{ isFinishing ? '세션 저장 중…' : (allSkipped ? '피드백 없이 발표 종료' : '발표 최종 종료') }}
        </button>
      </div>
    </section>
  </main>

  <div
    v-if="showExit"
    class="qna-exit-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="presentationQnaExitTitle"
    data-testid="presentation-qna-exit-dialog"
  >
    <div class="qna-exit-dialog">
      <h2 id="presentationQnaExitTitle">발표를 종료하고 나갈까요?</h2>
      <p>지금 나가면 답변과 발표 기록이 저장되지 않으며 리포트도 생성되지 않습니다.</p>
      <div class="qna-exit-actions">
        <button type="button" data-testid="continue-presentation-qna" @click="cancelExit">계속 답변하기</button>
        <button
          type="button"
          class="is-danger"
          data-testid="discard-presentation-qna"
          :disabled="isDiscardingExit"
          @click="confirmExit"
        >{{ isDiscardingExit ? '기록 삭제 중…' : '기록 삭제하고 나가기' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 질의응답 질문 생성 중 표시 — 발표 내용 기반 생성 대기를 알린다. */
.qna-generating {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #e0dcff;
  border-radius: 12px;
  background: #f5f3ff;
}

.qna-generating-spinner {
  flex: none;
  width: 16px;
  height: 16px;
  border: 2px solid #cabffb;
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: qnaGenSpin .7s linear infinite;
}

.qna-generating p {
  display: inline-flex;
  align-items: baseline;
  margin: 0;
  color: #4c1d95;
  font-size: 13px;
  font-weight: 700;
}

.qna-generating-dots {
  display: inline-flex;
  gap: 2px;
  margin-left: 2px;
}

.qna-generating-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  animation: qnaGenDot 1s ease-in-out infinite;
}

.qna-generating-dots i:nth-child(2) { animation-delay: .18s; }
.qna-generating-dots i:nth-child(3) { animation-delay: .36s; }

/* 질문이 하나씩 나타날 때 페이드인 */
.qna-question-item-gen {
  animation: qnaQGen .34s cubic-bezier(.33, 1, .68, 1) both;
}

@keyframes qnaGenSpin { to { transform: rotate(360deg); } }
@keyframes qnaGenDot { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
@keyframes qnaQGen { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .qna-generating-spinner, .qna-generating-dots i, .qna-question-item-gen { animation: none; }
}

.qna-live-caption {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  padding: 12px 14px;
  background: #f5f3ff;
  border: 1px solid #e0dcff;
  border-radius: 12px;
  min-height: 44px;
}

.qna-live-caption-dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: #7c3aed;
  animation: qnaCaptionPulse 1.1s ease-in-out infinite;
}

@keyframes qnaCaptionPulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.qna-live-caption p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
  color: #4c1d95;
}

.qna-live-caption-empty {
  color: #a78bcf !important;
  font-weight: 500 !important;
}

.qna-answer-log {
  margin-top: 18px;
}

.qna-answer-log h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
  color: #64748b;
}

.qna-answer-log ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qna-answer-log li {
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e4e7f0;
  border-radius: 12px;
}

.qna-answer-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.qna-answer-log-q {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: #1f2440;
}

.qna-answer-log-dur {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.qna-answer-log-a {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
  color: #475569;
}

.qna-answer-log-a.is-empty {
  color: #b0b7c5;
  font-style: italic;
}

.qna-skip-button {
  min-width: 176px;
  padding: 12px 20px;
  border: 1px solid #cbd2e3;
  border-radius: 12px;
  background: #fff;
  color: #59627a;
  font-weight: 800;
  cursor: pointer;
}

.qna-skip-button:hover,
.qna-skip-button:focus-visible {
  border-color: #7a88b8;
  color: #303a5c;
}

.qna-skip-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.qna-exit-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(23, 35, 70, .42);
}

.qna-exit-dialog {
  box-sizing: border-box;
  width: min(440px, 100%);
  padding: 28px;
  border: 1px solid #dbe3f3;
  border-radius: 16px;
  background: #fff;
  color: #172346;
  box-shadow: 0 20px 55px rgba(23, 35, 70, .2);
}

.qna-exit-dialog h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.35;
}

.qna-exit-dialog p {
  margin: 12px 0 24px;
  color: #66738f;
  font-size: 15px;
  line-height: 1.55;
  word-break: keep-all;
}

.qna-exit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.qna-exit-actions button {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid #d4ddef;
  border-radius: 999px;
  background: #fff;
  color: #33405f;
  font-weight: 800;
  cursor: pointer;
}

.qna-exit-actions .is-danger {
  border-color: #e05252;
  background: #e05252;
  color: #fff;
}

.qna-exit-actions button:disabled {
  cursor: wait;
  opacity: .65;
}

@media (max-width: 520px) {
  .qna-exit-actions {
    flex-direction: column-reverse;
  }

  .qna-exit-actions button {
    width: 100%;
  }
}
</style>
