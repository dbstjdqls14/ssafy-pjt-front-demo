<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { queryRequiredMediaPermissions } from '../../composables/useMediaDevices.js'
import { usePresentationStore } from '../../stores/presentationStore.js'

const router = useRouter()
const presentation = usePresentationStore()

const checks = ref({ screen: false, audio: false, ppt: false, ready: false })
const canOpenReview = ref(false)
const readyState = ref('checklist') // 'checklist' | 'review' | 'ready'
const slideError = ref('')
const permissionStates = ref({ video: 'checking', audio: 'checking' })
const permissionResolved = ref(false)
const checkSteps = [
  { key: 'screen', title: '화면 연결 확인', doneStatus: '연결 정상', pendingStatus: '연결 확인 중', automatic: true },
  { key: 'audio', title: '음성 오디오 확인', doneStatus: '오디오 정상', pendingStatus: '오디오 확인 중', automatic: true },
  { key: 'ppt', title: '발표 PPT 업로드', doneStatus: '업로드 완료', pendingStatus: '확인 필요', automatic: true, opensReview: true },
  { key: 'ready', title: '발표 준비', doneStatus: '작성 완료', pendingStatus: '작성 완료', automatic: false, reviewAction: true },
]
const automaticCheckSteps = checkSteps.filter((step) => step.automatic)
const permissionGranted = (state) => state === 'granted' || state === 'unsupported'
const devicePermissionMessage = computed(() => {
  if (!permissionResolved.value) return ''
  const cameraMissing = !permissionGranted(permissionStates.value.video)
  const microphoneMissing = !permissionGranted(permissionStates.value.audio)
  if (cameraMissing && microphoneMissing) return '카메라와 마이크 권한이 필요합니다. 장치 확인 화면에서 권한을 허용해주세요.'
  if (cameraMissing) return '카메라 권한이 필요합니다. 장치 확인 화면에서 권한을 허용해주세요.'
  if (microphoneMissing) return '마이크 권한이 필요합니다. 장치 확인 화면에서 권한을 허용해주세요.'
  return ''
})

const refreshDevicePermissions = async ({ applyChecks = true } = {}) => {
  const states = await queryRequiredMediaPermissions()
  if (!active) return false
  permissionStates.value = states
  permissionResolved.value = true
  const screenAllowed = permissionGranted(states.video)
  const audioAllowed = permissionGranted(states.audio)
  if (applyChecks) {
    checks.value.screen = screenAllowed
    checks.value.audio = audioAllowed
  }
  const allowed = screenAllowed && audioAllowed
  if (!allowed) {
    checks.value.ready = false
    if (readyState.value === 'ready') readyState.value = 'checklist'
    presentation.setPreflightDone(false)
  }
  return allowed
}

const stepStatus = (step) => {
  if (checks.value[step.key]) return step.doneStatus
  if (permissionResolved.value && (step.key === 'screen' || step.key === 'audio')) return '권한 필요'
  return step.pendingStatus
}

const reviewIndex = ref(0)
const slides = computed(() => presentation.slides)
const reviewSlide = computed(() => slides.value[reviewIndex.value] ?? { title: '', keyPoints: '' })
const reviewKeyContent = computed(() => reviewSlide.value.keyPoints?.trim() || '작성한 핵심 내용이 없습니다.')

let active = true
const timers = []
const wait = (ms) => new Promise((resolve) => timers.push(setTimeout(resolve, ms)))

// 순환 없이: 처음/끝에서 멈춘다(버튼은 끝에서 비활성화).
const prevSlide = () => {
  if (reviewIndex.value > 0) reviewIndex.value -= 1
}
const nextSlide = () => {
  if (reviewIndex.value < slides.value.length - 1) reviewIndex.value += 1
}

const openReview = () => { if (canOpenReview.value) readyState.value = 'review' }
const editNotes = () => router.push('/presentation/slides')
const confirmSlides = async () => {
  readyState.value = 'checklist'
  await wait(420)
  if (!active) return
  checks.value.ready = true
  await wait(520)
  if (!active) return
  if (!await refreshDevicePermissions()) return
  readyState.value = 'ready'
  // 이 다음부터는(핵심 내용을 고치러 돌아갔다 와도) 같은 확인을 반복하지 않는다.
  presentation.setPreflightDone(true)
}
const start = async () => {
  if (readyState.value !== 'ready' || !await refreshDevicePermissions()) return
  router.push('/presentation/record')
}

const onPermissionFocus = () => { void refreshDevicePermissions() }
const onPermissionVisibility = () => {
  if (document.visibilityState === 'visible') void refreshDevicePermissions()
}

onMounted(async () => {
  window.addEventListener('focus', onPermissionFocus)
  document.addEventListener('visibilitychange', onPermissionVisibility)
  await refreshDevicePermissions({ applyChecks: false })
  await presentation.ensureSlidesLoaded()
  const hasRenderableSlides = presentation.hasRenderableSlides
  if (!hasRenderableSlides) {
    slideError.value = '변환된 슬라이드 이미지를 불러오지 못했습니다. 발표 자료를 다시 업로드해 주세요.'
  }

  // 이미 한 번 확인을 끝낸 연습이면 체크 애니메이션·슬라이드 확인을 건너뛰고
  // 바로 '발표 시작'을 열어 준다. ('다시 작성하러 가기' 후 재진입 경로)
  if (presentation.preflightDone && hasRenderableSlides) {
    checks.value.screen = permissionGranted(permissionStates.value.video)
    checks.value.audio = permissionGranted(permissionStates.value.audio)
    checks.value.ppt = true
    checks.value.ready = checks.value.screen && checks.value.audio
    canOpenReview.value = true
    readyState.value = checks.value.ready ? 'ready' : 'checklist'
    return
  }

  for (const step of automaticCheckSteps) {
    await wait(760)
    if (!active) return
    let completed
    if (step.key === 'screen') completed = permissionGranted(permissionStates.value.video)
    else if (step.key === 'audio') completed = permissionGranted(permissionStates.value.audio)
    else completed = hasRenderableSlides
    checks.value[step.key] = completed
    if (step.opensReview) canOpenReview.value = completed
  }
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
        <div class="workflow-stage-content ready-flow-content" data-flow-content>
          <section v-show="readyState !== 'review'" class="ready-confirm-card" aria-label="설정 확인 항목">
            <ol class="ready-check-list" aria-live="polite">
              <li
                v-for="step in checkSteps"
                :key="step.key"
                class="ready-item"
                :class="{ done: checks[step.key] }"
              >
                <i class="ready-check-icon" aria-hidden="true">{{ checks[step.key] ? '✓' : '' }}</i>
                <div :class="{ 'ready-item-main': step.reviewAction }">
                  <div><strong>{{ step.title }}</strong><span class="status">{{ stepStatus(step) }}</span></div>
                  <button v-if="step.reviewAction" type="button" class="ready-review-link" :disabled="!canOpenReview" @click="openReview">
                    슬라이드 확인하러가기
                  </button>
                </div>
              </li>
            </ol>

            <p v-if="slideError" class="ready-slide-error" role="alert">{{ slideError }}</p>
            <p v-if="devicePermissionMessage" class="ready-slide-error" role="alert">
              {{ devicePermissionMessage }}
            </p>

            <button
              type="button"
              class="btn-primary ready-start-button"
              :class="{ 'is-ready': readyState === 'ready' }"
              :disabled="readyState !== 'ready'"
              @click="start"
            >발표 시작</button>
          </section>

          <section
            v-show="readyState === 'review'"
            class="ready-slide-review is-visible"
            aria-label="슬라이드 핵심 내용 확인"
          >
            <header class="slide-key-head ready-review-head">
              <div>
                <h1>슬라이드별 핵심 내용</h1>
                <p>발표 전 슬라이드별 핵심 내용을 다시 확인해 보세요.</p>
              </div>
              <div class="slide-page-control" aria-label="슬라이드 이동">
                <button type="button" aria-label="이전 슬라이드" :disabled="reviewIndex === 0" @click="prevSlide">‹</button>
                <span class="slide-counter">{{ reviewIndex + 1 }} 슬라이드</span>
                <button type="button" aria-label="다음 슬라이드" :disabled="reviewIndex === slides.length - 1" @click="nextSlide">›</button>
              </div>
            </header>
            <div class="ready-slide-panel">
              <div class="ready-slide-preview">
                <img
                  v-if="reviewSlide.previewUrl"
                  class="ready-slide-image"
                  :src="reviewSlide.previewUrl"
                  :alt="`${reviewIndex + 1}번 슬라이드 미리보기`"
                />
                <div v-else class="slide-nav-body ready-slide-unavailable">
                  <span class="eyebrow">SPEECH COACH</span>
                  <h3>슬라이드 이미지를 불러올 수 없어요.</h3>
                  <p>발표 자료를 다시 업로드해 주세요.</p>
                </div>
              </div>
              <div class="ready-key-content">
                <span class="ready-key-label">핵심 내용</span>
                <p class="ready-note-plain">{{ reviewKeyContent }}</p>
              </div>
            </div>
            <div class="ready-review-actions">
              <button type="button" class="ready-edit-button" @click="editNotes">다시 작성하러 가기</button>
              <button type="button" class="btn-primary ready-confirm-button" @click="confirmSlides">확인 완료</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>
