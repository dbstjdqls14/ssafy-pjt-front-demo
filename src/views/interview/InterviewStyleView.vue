<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { INTERVIEWER_STYLE_BY_CODE, useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

// 면접관 목록은 실 API(GET /interviews/interviewers)에서 내려온다.
// 얼굴 이미지·톤 색상·예시 문구는 아직 프론트 자산(profileImageUrl이 null)이라 code로 매핑.
const PERSONA_VISUALS = {
  PRACTICAL: { img: '/interviewers/1.jpg', avatar: '🧑‍💼', example: '예: "이 구조를 선택한 기준과 트레이드오프를 설명해 주세요."', tone: '#4e6fc2' },
  GROWTH_COACH: { img: '/interviewers/2.jpg', avatar: '👩‍🏫', example: '예: "그 경험에서 본인의 강점은 무엇이었다고 생각하세요?"', tone: '#3f9d7a' },
  PRESSURE: { img: '/interviewers/3.jpg', avatar: '🧐', example: '예: "그 판단이 틀렸다면 어떻게 대응하시겠어요?"', tone: '#c2703f' },
}
const FALLBACK_VISUAL = { img: '/interviewers/1.jpg', avatar: '🧑‍💼', example: '', tone: '#4e6fc2' }

// 면접 연습에는 꼬리 질문이 없다(꼬리 질문은 발표의 질의응답 기능) → 면접관 소개에서
// 서버가 내려주는 '꼬리 질문' 표현만 실제 동작에 맞는 '기술 질문'으로 바꿔 보여준다.
const DESCRIPTION_WORDING = [['꼬리 질문', '기술 질문']]
const applyWording = (description) => DESCRIPTION_WORDING.reduce(
  (text, [from, to]) => text.split(from).join(to),
  String(description ?? ''),
)

const personas = computed(() => interview.interviewers.map((item) => {
  const visual = PERSONA_VISUALS[item.code] ?? FALLBACK_VISUAL
  return {
    id: item.id,
    title: item.name,
    desc: applyWording(item.description),
    ...visual,
    img: item.profileImageUrl || visual.img,
  }
}))

const imgFailed = reactive({})
const selectedId = ref(interview.interviewerId)
const loading = ref(true)
const saveError = ref('')

onMounted(async () => {
  try {
    await interview.loadInterviewers()
    // 저장된 선택이 없으면 기존 스타일(기본 practical)에 해당하는 면접관을 미리 선택.
    if (selectedId.value == null) {
      const byStyle = interview.interviewers.find(
        (item) => INTERVIEWER_STYLE_BY_CODE[item.code] === interview.interviewerStyle,
      )
      selectedId.value = (byStyle ?? interview.interviewers[0])?.id ?? null
    }
  } catch (error) {
    saveError.value = error?.message || '면접관 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

// 질문은 면접관마다 달라지므로 여기서 미리 만들지 않는다. 면접관만 확정하고,
// 다음 단계(질문 생성)에서 POST /interviews가 생성과 질문을 한 번에 처리한다.
const goNext = () => {
  saveError.value = ''
  const selected = interview.interviewers.find((item) => item.id === selectedId.value)
  if (!selected) {
    saveError.value = '면접관을 선택해 주세요.'
    return
  }
  interview.setInterviewer(selected)
  router.push('/interview/questions')
}
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content" data-flow-content>
          <div class="setup-grid setup-single-column iv-single-column">
            <div class="iv-setup-column">
              <h2 class="iv-page-title">면접관 선택</h2>
              <p class="iv-persona-guide">면접관에 따라 질문 유형과 분위기가 달라져요. 원하는 면접관을 선택해 주세요.</p>

              <p v-if="loading" class="iv-persona-guide" aria-live="polite">면접관 목록을 불러오는 중이에요…</p>
              <div v-else class="iv-persona-row" role="group" aria-label="면접관 선택">
                <button
                  v-for="p in personas"
                  :key="p.id"
                  type="button"
                  class="iv-persona"
                  :class="{ active: selectedId === p.id }"
                  :style="{ '--tone': p.tone }"
                  :aria-pressed="selectedId === p.id"
                  @click="selectedId = p.id"
                >
                  <span class="iv-persona-face">
                    <img v-if="!imgFailed[p.id]" :src="p.img" :alt="p.title" @error="imgFailed[p.id] = true" />
                    <span v-else class="iv-persona-emoji">{{ p.avatar }}</span>
                  </span>
                  <strong>{{ p.title }}</strong>
                  <small>{{ p.desc }}</small>
                  <em class="iv-persona-example">{{ p.example }}</em>
                </button>
              </div>
            </div>
          </div>
        </div>

        <p v-if="saveError || interview.saveError" class="iv-flow-error" role="alert">{{ saveError || interview.saveError }}</p>
        <div class="workflow-footer-actions">
          <RouterLink class="workflow-side-button workflow-side-prev" to="/interview/setup" aria-label="면접 정보 설정으로 돌아가기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button type="button" class="workflow-side-button workflow-side-next" :disabled="loading" aria-label="면접 질문 생성으로 이동" @click="goNext">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
