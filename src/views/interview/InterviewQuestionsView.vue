<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

// 이 화면 진입 시 POST /interviews로 면접을 생성한다 — AI 질문이 함께 생성되어
// questionItems로 반환된다. 같은 설정으로 이미 생성했다면(뒤로 갔다 온 경우) 재사용.
const generating = ref(true)
const loadError = ref('')

// 질문이 하나씩 생성되어 추가되는 느낌(스트리밍 연출) — 응답은 한 번에 오지만
// displayCount를 시차로 늘려 화면이 멈추지 않았음을 알린다.
const GEN_INTERVAL = 380
const displayCount = ref(0)
let genTimers = []
const clearGenTimers = () => { genTimers.forEach((t) => clearTimeout(t)); genTimers = [] }

const questions = computed(() => (
  generating.value ? interview.questions.slice(0, displayCount.value) : interview.questions
))

const generateQuestions = async () => {
  clearGenTimers()
  generating.value = true
  loadError.value = ''
  displayCount.value = 0
  page.value = 0
  try {
    const { reused } = await interview.createInterview()
    if (reused) {
      displayCount.value = interview.questions.length
      generating.value = false
      return
    }
    const step = () => {
      if (displayCount.value >= interview.questions.length) {
        generating.value = false
        return
      }
      displayCount.value += 1
      genTimers.push(setTimeout(step, GEN_INTERVAL))
    }
    genTimers.push(setTimeout(step, 200))
  } catch (error) {
    generating.value = false
    if (error?.code === 'INVALID_SERVER_ID') {
      await router.replace({ path: '/practice/folders', query: { type: 'interview' } })
      return
    }
    loadError.value = error?.message || '면접 질문을 생성하지 못했습니다. 로그인 상태를 확인해주세요.'
  }
}

onMounted(generateQuestions)
onBeforeUnmount(clearGenTimers)

// 한 화면에 최대 5문항, 그 이상은 페이지로 넘긴다.
const PAGE_SIZE = 5
const page = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(questions.value.length / PAGE_SIZE)))
const pagedQuestions = computed(() => {
  const start = page.value * PAGE_SIZE
  return questions.value.slice(start, start + PAGE_SIZE).map((q, i) => ({ q, index: start + i }))
})
const clampPage = () => { page.value = Math.min(page.value, totalPages.value - 1) }
const prevPage = () => { if (page.value > 0) page.value -= 1 }
const nextPage = () => { if (page.value < totalPages.value - 1) page.value += 1 }

const newQuestion = ref('')
const mutating = ref(false)
const addQuestion = async () => {
  const text = newQuestion.value.trim()
  if (!text || mutating.value) return
  mutating.value = true
  loadError.value = ''
  try {
    await interview.addQuestion(text) // POST /interviews/{id}/questions
    newQuestion.value = ''
    page.value = totalPages.value - 1 // 방금 추가한 질문이 있는 페이지로 이동
  } catch (error) {
    loadError.value = error?.message || '질문을 추가하지 못했습니다.'
  } finally {
    mutating.value = false
  }
}
const removeQuestion = async (question) => {
  if (mutating.value) return
  mutating.value = true
  loadError.value = ''
  try {
    await interview.removeQuestion(question.questionId) // DELETE /interviews/{id}/questions/{qId}
    clampPage()
  } catch (error) {
    loadError.value = error?.message || '질문을 삭제하지 못했습니다.'
  } finally {
    mutating.value = false
  }
}

const goNext = () => {
  if (generating.value || !questions.value.length) return
  router.push('/interview/check')
}
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content" data-flow-content>
          <div class="setup-grid setup-single-column iv-single-column">
            <div class="iv-setup-column">
              <div class="iv-page-title-row">
                <h2 class="iv-page-title">면접 질문 생성</h2>
                <small class="iv-page-subcount">총 {{ questions.length }}문항</small>
              </div>

              <section class="presentation-panel iv-form-panel iv-field-card iv-questions-card" aria-label="면접 질문 목록">
                <div v-if="generating" class="iv-gen-status" aria-live="polite">
                  <span class="iv-gen-spinner" aria-hidden="true"></span>
                  <span class="iv-gen-text">AI가 면접관에 맞춰 질문을 만들고 있어요<span class="iv-gen-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>
                </div>

                <div class="iv-question-add">
                  <span class="iv-question-add-plus" aria-hidden="true">+</span>
                  <input
                    v-model="newQuestion"
                    type="text"
                    :placeholder="generating ? '질문을 생성하는 중이에요…' : '질문을 추가해 보세요.'"
                    aria-label="질문 추가"
                    :disabled="generating || mutating"
                    @keydown.enter.prevent="addQuestion"
                  />
                  <button
                    type="button"
                    class="iv-question-add-ok"
                    :disabled="generating || mutating || !newQuestion.trim()"
                    @click="addQuestion"
                  >추가</button>
                </div>

                <ul class="iv-question-list">
                  <li v-for="{ q, index } in pagedQuestions" :key="q.questionId" class="iv-question-item iv-question-item-gen">
                    <span class="iv-question-text"><b>Q{{ index + 1 }}.</b> {{ q.text }}</span>
                    <span class="iv-question-meta">
                      <small class="iv-question-cat">{{ q.cat }}</small>
                      <button type="button" class="iv-question-remove" aria-label="질문 삭제" :disabled="generating || mutating" @click="removeQuestion(q)">×</button>
                    </span>
                  </li>
                  <li v-if="generating && !questions.length" class="iv-question-skeleton" aria-hidden="true">
                    <span></span><span></span>
                  </li>
                  <li v-else-if="!generating && !questions.length" class="iv-question-empty">
                    선택한 질문이 없어요. 위 입력칸에서 질문을 추가해 보세요.
                  </li>
                </ul>

                <div v-if="totalPages > 1" class="iv-question-pager">
                  <button type="button" aria-label="이전 페이지" :disabled="page === 0" @click="prevPage">‹</button>
                  <span>{{ page + 1 }} / {{ totalPages }}</span>
                  <button type="button" aria-label="다음 페이지" :disabled="page === totalPages - 1" @click="nextPage">›</button>
                </div>
              </section>
            </div>
          </div>
        </div>

        <p v-if="loadError || interview.saveError" class="iv-flow-error" role="alert">{{ loadError || interview.saveError }}</p>
        <div class="workflow-footer-actions">
          <RouterLink class="workflow-side-button workflow-side-prev" to="/interview/style" aria-label="면접관 선택으로 돌아가기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button type="button" class="workflow-side-button workflow-side-next" :disabled="interview.saving || generating" aria-label="장치 확인으로 이동" @click="goNext">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* 질문 생성 중 표시 — 화면이 멈추지 않았음을 알린다. */
.iv-gen-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid #e0dcff;
  border-radius: 12px;
  background: #f5f3ff;
  color: #4c3f9a;
  font-size: 13px;
  font-weight: 700;
}

.iv-gen-spinner {
  flex: none;
  width: 16px;
  height: 16px;
  border: 2px solid #c9c2f4;
  border-top-color: #6b5fd6;
  border-radius: 50%;
  animation: ivGenSpin .7s linear infinite;
}

.iv-gen-text {
  display: inline-flex;
  align-items: baseline;
}

.iv-gen-dots {
  display: inline-flex;
  gap: 2px;
  margin-left: 2px;
}

.iv-gen-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  animation: ivGenDot 1s ease-in-out infinite;
}

.iv-gen-dots i:nth-child(2) { animation-delay: .18s; }
.iv-gen-dots i:nth-child(3) { animation-delay: .36s; }

/* 질문이 하나씩 나타날 때 살짝 위로 페이드인 */
.iv-question-item-gen {
  animation: ivQGen .34s cubic-bezier(.33, 1, .68, 1) both;
}

/* 첫 질문 생성 전 자리표시 스켈레톤 */
.iv-question-skeleton {
  display: grid;
  gap: 8px;
  padding: 6px 2px;
}

.iv-question-skeleton span {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, #eef0f6 25%, #e3e6f0 37%, #eef0f6 63%);
  background-size: 400% 100%;
  animation: ivSkel 1.2s ease infinite;
}

.iv-question-skeleton span:last-child { width: 62%; }

@keyframes ivGenSpin { to { transform: rotate(360deg); } }
@keyframes ivGenDot { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
@keyframes ivQGen { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes ivSkel { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

@media (prefers-reduced-motion: reduce) {
  .iv-gen-spinner, .iv-gen-dots i, .iv-question-item-gen, .iv-question-skeleton span { animation: none; }
}
</style>
