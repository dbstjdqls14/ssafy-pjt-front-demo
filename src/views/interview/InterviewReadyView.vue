<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { queryRequiredMediaPermissions } from '../../composables/useMediaDevices.js'
import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

// checklist → review(질문 확인) → 확인 완료 시 면접 질문 체크 + 면접 시작 활성화
const readyState = ref('checklist')
const checks = ref({ camera: false, mic: false, style: false, questions: false })
const canReview = ref(false)
const permissionStates = ref({ video: 'checking', audio: 'checking' })
const permissionResolved = ref(false)

const STYLE_LABELS = { practical: '실무 중심형', growth: '성장 코치형', pressure: '압박 검증형' }
const styleLabel = computed(() => STYLE_LABELS[interview.interviewerStyle] ?? '실무 중심형')
const questions = computed(() => interview.questions)
const questionCount = computed(() => questions.value.length)
const totalMinutes = computed(() => questions.value.reduce((sum, q) => sum + (q.min || 0), 0))
const permissionGranted = (state) => state === 'granted' || state === 'unsupported'
const canStart = computed(() => (
  checks.value.camera
    && checks.value.mic
    && checks.value.style
    && checks.value.questions
))
const cameraStatus = computed(() => (
  permissionResolved.value && !checks.value.camera ? '권한 필요' : '카메라 정상'
))
const microphoneStatus = computed(() => (
  permissionResolved.value && !checks.value.mic ? '권한 필요' : '마이크 정상'
))
const devicePermissionMessage = computed(() => {
  if (!permissionResolved.value) return ''
  if (!checks.value.camera && !checks.value.mic) return '카메라와 마이크 권한이 필요합니다. 장치 확인 화면에서 권한을 허용해 주세요.'
  if (!checks.value.camera) return '카메라 권한이 필요합니다. 장치 확인 화면에서 권한을 허용해 주세요.'
  if (!checks.value.mic) return '마이크 권한이 필요합니다. 장치 확인 화면에서 권한을 허용해 주세요.'
  return ''
})

let active = true
const timers = []
const wait = (ms) => new Promise((resolve) => timers.push(setTimeout(resolve, ms)))

const refreshDevicePermissions = async () => {
  const states = await queryRequiredMediaPermissions()
  if (!active) return false
  permissionStates.value = states
  permissionResolved.value = true
  checks.value.camera = permissionGranted(states.video)
  checks.value.mic = permissionGranted(states.audio)
  return checks.value.camera && checks.value.mic
}

const openReview = () => { if (canReview.value) readyState.value = 'review' }
const editQuestions = () => router.push('/interview/questions')
const confirmQuestions = () => {
  readyState.value = 'checklist'
  checks.value.questions = true
  // 이 다음부터는 질문을 고치러 돌아갔다 와도 같은 확인을 반복하지 않는다.
  interview.setPreflightDone(true)
}
const start = async () => {
  if (!await refreshDevicePermissions() || !canStart.value) return
  router.push('/interview/record')
}

const onPermissionFocus = () => { void refreshDevicePermissions() }
const onPermissionVisibility = () => {
  if (document.visibilityState === 'visible') void refreshDevicePermissions()
}

onMounted(async () => {
  window.addEventListener('focus', onPermissionFocus)
  document.addEventListener('visibilitychange', onPermissionVisibility)
  await refreshDevicePermissions()
  canReview.value = true
  // 이미 한 번 확인을 끝낸 면접이면 체크 애니메이션·질문 확인을 건너뛰고 바로
  // '면접 시작'을 열어 준다. ('다시 편집하러 가기' 후 재진입 경로)
  if (interview.preflightDone) {
    checks.value.style = true
    checks.value.questions = true
    return
  }
  canReview.value = false
  for (const key of ['camera', 'mic', 'style']) {
    await wait(720)
    if (!active) return
    if (key === 'camera') checks.value.camera = permissionGranted(permissionStates.value.video)
    else if (key === 'mic') checks.value.mic = permissionGranted(permissionStates.value.audio)
    else checks.value.style = true
  }
  canReview.value = true
})

onBeforeUnmount(() => {
  active = false
  window.removeEventListener('focus', onPermissionFocus)
  document.removeEventListener('visibilitychange', onPermissionVisibility)
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
                <div><strong>카메라 연결 확인</strong><span class="status" data-testid="ready-camera-status">{{ cameraStatus }}</span></div>
              </li>
              <li class="ready-item" :class="{ done: checks.mic }">
                <i class="ready-check-icon" aria-hidden="true">{{ checks.mic ? '✓' : '' }}</i>
                <div><strong>마이크 입력 확인</strong><span class="status" data-testid="ready-microphone-status">{{ microphoneStatus }}</span></div>
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

            <p v-if="devicePermissionMessage" class="ready-slide-error" role="alert">
              {{ devicePermissionMessage }}
            </p>

            <button
              type="button"
              class="btn-primary ready-start-button"
              :class="{ 'is-ready': canStart }"
              :disabled="!canStart"
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
