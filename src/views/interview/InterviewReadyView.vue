<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

// checklist → review(질문 확인) → 확인 완료 시 면접 질문 체크 + 면접 시작 활성화
const readyState = ref('checklist')
const checks = ref({ camera: false, mic: false, style: false, questions: false })
const canReview = ref(false)

const STYLE_LABELS = { practical: '실무 중심형', growth: '성장 코치형', pressure: '압박 검증형' }
const styleLabel = computed(() => STYLE_LABELS[interview.interviewerStyle] ?? '실무 중심형')
const questions = computed(() => interview.questions)
const questionCount = computed(() => questions.value.length)
const totalMinutes = computed(() => questions.value.reduce((sum, q) => sum + (q.min || 0), 0))

let active = true
const timers = []
const wait = (ms) => new Promise((resolve) => timers.push(setTimeout(resolve, ms)))

const openReview = () => { if (canReview.value) readyState.value = 'review' }
const editQuestions = () => router.push('/interview/questions')
const confirmQuestions = () => {
  readyState.value = 'checklist'
  checks.value.questions = true
}
const start = () => { if (checks.value.questions) router.push('/interview/record') }

onMounted(async () => {
  for (const key of ['camera', 'mic', 'style']) {
    await wait(720)
    if (!active) return
    checks.value[key] = true
  }
  canReview.value = true
})

onBeforeUnmount(() => {
  active = false
  timers.forEach(clearTimeout)
})
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <!-- 마지막 확인 단계라 이전 단계로 돌아가지 않음 → 이전(뒤로) 버튼 제거 -->

        <div class="workflow-stage-content ready-flow-content" data-flow-content>
          <section v-show="readyState !== 'review'" class="ready-confirm-card" aria-label="면접 시작 전 확인 항목">
            <ol class="ready-check-list" aria-live="polite">
              <li class="ready-item" :class="{ done: checks.camera }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.camera ? '✓' : '' }}</i>
                <div><strong>카메라 연결 확인</strong><span class="status">카메라 정상</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.mic }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.mic ? '✓' : '' }}</i>
                <div><strong>마이크 입력 확인</strong><span class="status">마이크 정상</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.style }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.style ? '✓' : '' }}</i>
                <div><strong>면접관</strong><span class="status">{{ styleLabel }}</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.questions }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.questions ? '✓' : '' }}</i>
                <div class="ready-item-main">
                  <div><strong>면접 질문</strong><span class="status">{{ checks.questions ? `${questionCount}문항 준비 완료` : '질문을 확인해 주세요' }}</span></div>
                  <button type="button" class="ready-review-link" :disabled="!canReview" @click="openReview">질문 확인하러가기</button>
                </div>
              </li>
            </ol>

            <button
              type="button"
              class="btn-primary ready-start-button"
              :class="{ 'is-ready': checks.questions }"
              :disabled="!checks.questions"
              @click="start"
            >면접 시작</button>
          </section>

          <section v-show="readyState === 'review'" class="iv-question-review" aria-label="면접 질문 확인">
            <div class="iv-review-head">
              <strong>면접 질문 확인</strong>
              <small>총 {{ questionCount }}문항 · 예상 {{ totalMinutes }}분</small>
            </div>
            <ul class="iv-review-list">
              <li v-for="(q, i) in questions" :key="i" class="iv-review-item">
                <span class="iv-review-q"><b>Q{{ i + 1 }}.</b> {{ q.text }}</span>
                <small>{{ q.cat }} · {{ q.min }}분</small>
              </li>
            </ul>
            <div class="ready-review-actions">
              <button type="button" class="ready-edit-button" @click="editQuestions">다시 편집하러 가기</button>
              <button type="button" class="btn-primary ready-confirm-button" @click="confirmQuestions">확인 완료</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>
