<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

let uid = 0
const withId = (q) => ({ ...q, id: (uid += 1) })

// 면접관별 질문 세트(데모). 실제로는 이전 단계에서 고른 면접관 스타일 + 이력서를
// 바탕으로 LLM이 생성한다. 백엔드가 붙으면 이 맵 대신 API 응답을 스트리밍한다.
const QUESTION_SETS = {
  practical: [
    { text: '1분 자기소개를 해주세요.', cat: '공통', min: 2 },
    { text: '지원한 직무에서 가장 자신 있는 프로젝트를 설명해 주세요.', cat: '직무 적합성', min: 3 },
    { text: '대용량 트래픽 문제를 어떻게 진단하고 해결했나요?', cat: '문제 해결', min: 3 },
    { text: '기술 스택을 선택할 때 기준과 트레이드오프는 무엇이었나요?', cat: '기술', min: 3 },
    { text: '협업 과정에서 의견 차이를 어떻게 조율했나요?', cat: '협업', min: 3 },
  ],
  growth: [
    { text: '1분 자기소개를 해주세요.', cat: '공통', min: 2 },
    { text: '가장 크게 성장했다고 느낀 경험은 무엇인가요?', cat: '성장', min: 3 },
    { text: '그 경험에서 본인의 강점은 무엇이었다고 생각하세요?', cat: '강점', min: 3 },
    { text: '최근 새롭게 학습한 기술과 학습 방법을 알려주세요.', cat: '학습', min: 2 },
    { text: '앞으로 어떤 개발자로 성장하고 싶나요?', cat: '목표', min: 3 },
  ],
  pressure: [
    { text: '1분 자기소개를 해주세요.', cat: '공통', min: 2 },
    { text: '그 판단이 틀렸다면 어떻게 대응하시겠어요?', cat: '압박', min: 3 },
    { text: '프로젝트에서 실패했던 결정과 그 이유를 말해 주세요.', cat: '문제 해결', min: 3 },
    { text: '본인 설계의 가장 큰 약점은 무엇이라고 보나요?', cat: '기술', min: 3 },
    { text: '마감이 촉박한 상황에서 무엇을 포기하시겠어요?', cat: '상황 대처', min: 3 },
  ],
}

const questions = ref([])
const generating = ref(true)
const loadError = ref('')

// 질문이 하나씩 생성되어 추가되는 느낌(스트리밍) — 화면이 멈추지 않았음을 알린다.
const FIRST_DELAY = 700 // 첫 질문 전 대기(ms)
const GEN_INTERVAL = 550 // 이후 질문 간 간격(ms)
let genTimers = []
const clearGenTimers = () => { genTimers.forEach((t) => clearTimeout(t)); genTimers = [] }

const generateQuestions = () => {
  clearGenTimers()
  generating.value = true
  questions.value = []
  page.value = 0
  const source = QUESTION_SETS[interview.interviewerStyle] ?? QUESTION_SETS.practical
  let i = 0
  const step = () => {
    if (i >= source.length) {
      generating.value = false
      interview.setQuestions(questions.value.map((q) => ({ text: q.text, cat: q.cat, min: q.min })))
      return
    }
    questions.value.push(withId(source[i]))
    i += 1
    genTimers.push(setTimeout(step, GEN_INTERVAL))
  }
  genTimers.push(setTimeout(step, FIRST_DELAY))
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
const addQuestion = () => {
  const text = newQuestion.value.trim()
  if (!text) return
  questions.value.push({ text, cat: '직접 추가', min: 2, id: (uid += 1) })
  newQuestion.value = ''
  page.value = totalPages.value - 1 // 방금 추가한 질문이 있는 페이지로 이동
}
const removeQuestion = (index) => {
  questions.value.splice(index, 1)
  clampPage()
}

const goNext = async () => {
  if (generating.value || !questions.value.length) return
  loadError.value = ''
  const nextQuestions = questions.value.map((q) => ({ questionId: q.questionId, text: q.text, cat: q.cat, min: q.min }))
  try {
    await interview.saveQuestions(nextQuestions)
    router.push('/interview/check')
  } catch (error) {
    loadError.value = error?.message || '질문을 저장하지 못했습니다.'
  }
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
                <h2 class="iv-page-title">면접 질문 확인</h2>
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
                    :disabled="generating"
                    @keydown.enter.prevent="addQuestion"
                  />
                  <button
                    type="button"
                    class="iv-question-add-ok"
                    :disabled="generating || !newQuestion.trim()"
                    @click="addQuestion"
                  >추가</button>
                </div>

                <ul class="iv-question-list">
                  <li v-for="{ q, index } in pagedQuestions" :key="q.id" class="iv-question-item iv-question-item-gen">
                    <span class="iv-question-text"><b>Q{{ index + 1 }}.</b> {{ q.text }}</span>
                    <span class="iv-question-meta">
                      <small class="iv-question-cat">{{ q.cat }}</small>
                      <button type="button" class="iv-question-remove" aria-label="질문 삭제" :disabled="generating" @click="removeQuestion(index)">×</button>
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
