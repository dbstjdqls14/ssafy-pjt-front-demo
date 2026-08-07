<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

// 면접관 3인 — 얼굴 이미지(public/interviewers/*.png) + 성격 설명. 이미지가 없으면 이모지로 대체.
// example: 이 면접관을 고르면 질문이 어떤 느낌으로 나오는지 미리 알려주는 예시 문구.
const personas = [
  { value: 'practical', img: '/interviewers/1.png', avatar: '🧑‍💼', title: '실무 중심형', desc: '논리적인 직무 질문 및 차분한 피드백', example: '예: "이 구조를 선택한 기준과 트레이드오프를 설명해 주세요."', tone: '#4e6fc2' },
  { value: 'growth', img: '/interviewers/2.png', avatar: '👩‍🏫', title: '성장 코치형', desc: '친절한 후속 질문 및 강점 발견', example: '예: "그 경험에서 본인의 강점은 무엇이었다고 생각하세요?"', tone: '#3f9d7a' },
  { value: 'pressure', img: '/interviewers/3.png', avatar: '🧐', title: '압박 검증형', desc: '꼬리 질문 중심 및 실전 긴장감', example: '예: "그 판단이 틀렸다면 어떻게 대응하시겠어요?"', tone: '#c2703f' },
]
const imgFailed = reactive({})
const selectedStyle = ref(interview.interviewerStyle)

// 질문은 면접관마다 달라지므로 여기서 미리 만들지 않는다(토큰·시간 절약).
// 면접관만 확정하고, 다음 단계(질문 확인)에서 LLM이 한 번만 생성한다.
const saveError = ref('')
const goNext = async () => {
  saveError.value = ''
  interview.setInterviewerStyle(selectedStyle.value)
  try {
    await interview.saveStyleAndQuestions()
    router.push('/interview/questions')
  } catch (error) {
    saveError.value = error?.message || '면접 설정을 저장하지 못했습니다.'
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
              <h2 class="iv-page-title">면접관 선택</h2>
              <p class="iv-persona-guide">면접관에 따라 질문 유형과 분위기가 달라져요. 원하는 면접관을 선택해 주세요.</p>

              <div class="iv-persona-row" role="group" aria-label="면접관 선택">
                <button
                  v-for="p in personas"
                  :key="p.value"
                  type="button"
                  class="iv-persona"
                  :class="{ active: selectedStyle === p.value }"
                  :style="{ '--tone': p.tone }"
                  :aria-pressed="selectedStyle === p.value"
                  @click="selectedStyle = p.value"
                >
                  <span class="iv-persona-face">
                    <img v-if="!imgFailed[p.value]" :src="p.img" :alt="p.title" @error="imgFailed[p.value] = true" />
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
          <button type="button" class="workflow-side-button workflow-side-next" :disabled="interview.saving" aria-label="면접 질문 확인으로 이동" @click="goNext">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
