<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js'
import { usePresentationStore } from '../../stores/presentationStore.js'

const router = useRouter()
const speech = useSpeechRecognition()
const presentation = usePresentationStore()

const questions = ref([])
const generating = ref(true)
const answers = ref([])
const selectedId = ref(null)
const isFinishing = ref(false)
const finishError = ref('')

const loadQuestions = async () => {
  generating.value = true
  questions.value = []
  finishError.value = ''
  try {
    const loaded = presentation.audienceQuestions.length
      ? presentation.audienceQuestions
      : await presentation.loadAudienceQuestions()
    questions.value = loaded.map((question, index) => ({
      id: question.id,
      code: `Q${index + 1}`,
      text: question.content,
      answered: false,
    }))
    selectedId.value = questions.value[0]?.id ?? null
  } catch (error) {
    finishError.value = error?.message || '청중 질문을 불러오지 못했습니다.'
  } finally {
    generating.value = false
  }
}
onMounted(loadQuestions)

const isRecording = ref(false)
const elapsed = ref(0) // seconds
let rafId = null
let startedAt = 0

const total = computed(() => questions.value.length)
const remaining = computed(() => questions.value.filter((q) => !q.answered))
const selected = computed(() => questions.value.find((q) => q.id === selectedId.value) ?? null)

const answeredCount = computed(() => answers.value.length)
const canFinish = computed(() => answeredCount.value > 0 && !isRecording.value)
const allDone = computed(() => !generating.value && questions.value.length > 0 && remaining.value.length === 0)

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
  if (allDone.value) return '모든 질문의 브라우저 녹음을 마쳤습니다.'
  if (!answeredCount.value) return '질문 카드를 선택한 뒤 답변을 시작해 주세요.'
  return `${remaining.value.length}개의 질문이 남았습니다.`
})

// 녹음 중 실시간 자막(음성 인식이 지원되는 브라우저에서만 채워진다).
const liveTranscript = computed(() => speech.transcript.value)
const formatDuration = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

const selectQuestion = (id) => {
  if (isRecording.value) return
  selectedId.value = id
}

const loop = (now) => {
  if (!isRecording.value) return
  elapsed.value = (now - startedAt) / 1000
  rafId = requestAnimationFrame(loop)
}

const startAnswer = () => {
  if (generating.value || isRecording.value || !selected.value) return
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

const completeAnswer = () => {
  if (!isRecording.value || !selected.value) return
  isRecording.value = false
  stopCapture()
  const q = selected.value
  answers.value.push({
    id: q.id,
    question: q.text,
    answer: speech.transcript.value,
    duration: Math.round(elapsed.value),
  })
  q.answered = true
  elapsed.value = 0
  const next = remaining.value[0]
  if (next) selectedId.value = next.id
}

const finish = async () => {
  if (!canFinish.value || isFinishing.value) return
  isFinishing.value = true
  finishError.value = ''
  try {
    await router.push('/presentation/report')
  } catch (error) {
    finishError.value = error?.message || '질의 응답 화면을 종료하지 못했습니다.'
  } finally {
    isFinishing.value = false
  }
}

onBeforeUnmount(stopCapture)
</script>

<template>
  <main class="qna-page-shell">
    <header class="qna-page-head">
      <h1>질의 응답</h1>
      <span class="qna-progress">{{ answeredCount }} / {{ total }} 답변</span>
    </header>
    <p class="qna-api-notice">
      질문은 Spring API에서 생성·조회합니다. 답변 평가 API는 백엔드의 종합 피드백 선행 데이터가 아직 생성되지 않아 이번 연결 범위에서 제외했습니다.
    </p>

    <section class="qna-question-panel" aria-label="답변할 질문 선택">
      <div v-if="generating" class="qna-generating" aria-live="polite">
        <span class="qna-generating-spinner" aria-hidden="true"></span>
        <p>발표 내용을 바탕으로 질문을 만들고 있어요<span class="qna-generating-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      </div>
      <ol class="qna-question-list" :style="{ '--qna-question-count': Math.max(remaining.length, 1) }">
        <li
          v-for="q in remaining"
          :key="q.id"
          class="qna-question-item qna-question-item-gen"
          :class="{ 'is-active': q.id === selectedId }"
        >
          <button type="button" @click="selectQuestion(q.id)"><span>{{ q.code }}</span><p>{{ q.text }}</p></button>
        </li>
      </ol>
    </section>

    <section class="qna-answer-panel">
      <div class="qna-active-question">
        <span>{{ generating ? '생성 중' : (allDone ? '완료' : selected?.code) }}</span>
        <h2>{{ generating ? '질문을 만들고 있어요…' : (allDone ? '모든 질문에 답변했습니다.' : selected?.text) }}</h2>
      </div>

      <div class="qna-answer-bar" :class="{ 'is-recording': isRecording, 'is-overtime': isOvertime }">
        <div class="qna-answer-time">
          <strong>{{ timerLabel }}</strong>
          <span>{{ timerGuide }}</span>
        </div>
        <button
          v-if="!allDone"
          type="button"
          :class="{ 'is-complete': isRecording, 'is-start': !isRecording }"
          :disabled="generating"
          @click="isRecording ? completeAnswer() : startAnswer()"
        >{{ isRecording ? '답변 완료' : '답변 시작' }}</button>
      </div>
      <div class="qna-answer-timeline" :class="{ 'is-overtime': isOvertime }" aria-hidden="true">
        <span class="qna-answer-timeline-fill" :style="{ width: fillWidth }"></span>
      </div>

      <div v-if="isRecording" class="qna-live-caption" aria-live="polite">
        <span class="qna-live-caption-dot" aria-hidden="true"></span>
        <p v-if="liveTranscript">{{ liveTranscript }}</p>
        <p v-else class="qna-live-caption-empty">답변을 시작하면 말한 내용이 여기에 실시간으로 표시됩니다.</p>
      </div>

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

      <div class="qna-complete-row">
        <p>{{ finishError || hint }}</p>
        <button id="finishQnaBtn" type="button" :disabled="!canFinish || isFinishing" @click="finish">
          {{ isFinishing ? '세션 저장 중…' : 'AI 분석 하기' }}
        </button>
      </div>
    </section>
  </main>
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
</style>
