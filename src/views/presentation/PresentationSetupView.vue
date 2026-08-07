<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
import { validatePresentationFile } from '../../utils/presentationFiles.js'
import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  textPolicyValidationMessage,
} from '../../utils/textInputPolicy.js'
import { practiceTitleValidationMessage } from '../../utils/validators.js'

const router = useRouter()
const presentation = usePresentationStore()

const title = ref(presentation.title)
const description = ref(presentation.description)
const durationMinutes = ref(presentation.targetMinutes)
const qnaEnabled = ref(presentation.qnaEnabled)

const titleError = ref('')
const descriptionError = ref('')
const fileError = ref('')
const isDragging = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)
const titleInput = ref(null)
const descriptionInput = ref(null)
const isSubmitting = ref(false)
const leavePromptOpen = ref(false)
let pendingLeaveLocation = null
let allowRouteLeave = false
let submissionAbandoned = false
const TITLE_MAX_LENGTH = INPUT_LIMITS.PRACTICE_TITLE
const DESCRIPTION_MAX_LENGTH = INPUT_LIMITS.PRACTICE_DESCRIPTION
const DURATION_MIN_MINUTES = INPUT_LIMITS.PRESENTATION_TARGET_MINUTES_MIN
const DURATION_MAX_MINUTES = INPUT_LIMITS.PRESENTATION_TARGET_MINUTES_MAX

const displayFile = computed(() => selectedFile.value ?? presentation.sourceFile)

// 같은 폴더에서 이전에 올린 발표 자료를 다시 쓰는 경로. 파일 업로드와 배타적이다.
const reuseModalOpen = ref(false)
const reusedSource = computed(() => presentation.reusedSource)
const openReuseModal = async () => {
  reuseModalOpen.value = true
  try {
    await presentation.loadReusableMaterials()
  } catch {
    // 모달 안에서 store의 reusableMaterialsError를 그대로 보여준다.
  }
}
const closeReuseModal = () => { reuseModalOpen.value = false }
const chooseReusableMaterial = (material) => {
  presentation.selectReusableMaterial(material)
  selectedFile.value = null
  fileError.value = ''
  if (fileInput.value) fileInput.value.value = ''
  reuseModalOpen.value = false
}
const clearReusedSource = () => {
  presentation.selectReusableMaterial(null)
  fileError.value = ''
}

// Upload progress is driven entirely by the store's reactive `uploadStatus`, so
// the label flips to 완료 the instant processing resolves — no navigation needed.
const isProcessing = computed(() => presentation.uploadStatus === 'processing')
const isUploaded = computed(() => presentation.uploadStatus === 'ready' && presentation.hasRenderableSlides)
const hasSelectedFile = computed(() => Boolean(
  selectedFile.value || presentation.stagedFile || presentation.sourceFile || presentation.reusedSource,
))

// '다음'을 누른 뒤(업로드·슬라이드 변환 중)에는 설정을 못 바꾼다. 이때부터는 서버가
// 이 설정으로 발표를 만들고 있어서, 값만 바꾸면 화면과 서버가 어긋난다.
// 이름·설명·자료·질의응답·목표 시간을 한꺼번에 잠근다.
const isLocked = computed(() => isSubmitting.value || isProcessing.value)

// 실제 변환은 하나의 비동기 작업이지만, 사용자에게는 'AI가 단계별로 처리 중'인
// 것처럼 보여야 멈춘 느낌이 들지 않는다. 처리 중에는 아래 단계 문구를 순서대로
// 넘기고(마지막 단계에서 정지), 스피너 + 점(...) 애니메이션으로 살아있게 한다.
const PROCESSING_PHASES = ['슬라이드 이미지 변환 중', '슬라이드 이미지 분석 중']
const phaseIndex = ref(0)
let phaseTimer = null
const stopPhaseTimer = () => {
  if (phaseTimer) { window.clearInterval(phaseTimer); phaseTimer = null }
}
watch(isProcessing, (active) => {
  stopPhaseTimer()
  if (!active) return
  phaseIndex.value = 0
  phaseTimer = window.setInterval(() => {
    if (phaseIndex.value < PROCESSING_PHASES.length - 1) phaseIndex.value += 1
    else stopPhaseTimer() // 마지막 단계에 도달하면 문구는 고정, 점 애니메이션만 계속
  }, 1400)
})
onBeforeUnmount(stopPhaseTimer)

const uploadLabel = computed(() => {
  if (isProcessing.value) return PROCESSING_PHASES[phaseIndex.value]
  if (presentation.uploadStatus === 'ready') return '완료'
  if (presentation.uploadStatus === 'error') return '업로드 실패'
  return ''
})

const fileSizeLabel = computed(() =>
  displayFile.value ? `${(displayFile.value.size / 1024 / 1024).toFixed(1)}MB` : '',
)

const descriptionPolicyMessage = (value) => textPolicyValidationMessage(value, {
  policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
  maxLength: DESCRIPTION_MAX_LENGTH,
})

const canProceed = computed(() => (
  !practiceTitleValidationMessage(title.value)
  && Boolean(description.value.trim())
  && !descriptionPolicyMessage(description.value)
  && hasSelectedFile.value
  && !isProcessing.value
))

const onTitleInput = (event) => {
  titleError.value = practiceTitleValidationMessage(event.target.value)
}

const onDescriptionInput = (event) => {
  descriptionError.value = descriptionPolicyMessage(event.target.value)
}

const clampDuration = (value) => Math.min(
  DURATION_MAX_MINUTES,
  Math.max(DURATION_MIN_MINUTES, Number.parseInt(value, 10) || DURATION_MIN_MINUTES),
)

const stepDuration = (delta) => {
  durationMinutes.value = clampDuration(durationMinutes.value + delta)
}
const onDurationInput = (event) => {
  if (event.target.value === '') return
  const clamped = clampDuration(event.target.value)
  durationMinutes.value = clamped
  event.target.value = String(clamped)
}
const onDurationBlur = () => {
  durationMinutes.value = clampDuration(durationMinutes.value)
}

const openFilePicker = () => fileInput.value?.click()

const selectFile = (file) => {
  const error = validatePresentationFile(file)
  fileError.value = error
  if (error) {
    selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  selectedFile.value = file
  presentation.stagePresentationFile(file)
}
const onFileChange = (event) => {
  const file = event.target.files?.[0]
  if (file) selectFile(file)
}
const onDrop = (event) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) selectFile(file)
}
const removeFile = () => {
  selectedFile.value = null
  fileError.value = ''
  presentation.clearPresentationFile()
  if (fileInput.value) fileInput.value.value = ''
}

const openLeavePrompt = (location) => {
  pendingLeaveLocation = location
  leavePromptOpen.value = true
}

const requestPrevious = async () => {
  if (isSubmitting.value) {
    openLeavePrompt('/practice/folders?type=presentation')
    return
  }

  allowRouteLeave = true
  await router.push('/practice/folders?type=presentation')
}

const continueUpload = () => {
  leavePromptOpen.value = false
  pendingLeaveLocation = null
}

const confirmLeave = async () => {
  submissionAbandoned = true
  allowRouteLeave = true
  const target = pendingLeaveLocation || '/practice/folders?type=presentation'
  leavePromptOpen.value = false
  pendingLeaveLocation = null
  await router.push(target)
}

onBeforeRouteLeave((to) => {
  if (allowRouteLeave || !isSubmitting.value) return true

  openLeavePrompt(to.fullPath)
  return false
})

const goNext = async () => {
  titleError.value = ''
  descriptionError.value = ''
  fileError.value = ''
  const titleValidationError = practiceTitleValidationMessage(title.value)
  if (titleValidationError) {
    titleError.value = titleValidationError
    titleInput.value?.focus()
    return
  }
  if (!description.value.trim()) {
    descriptionError.value = '연습 설명을 입력해주세요.'
    return
  }
  const descriptionValidationError = descriptionPolicyMessage(description.value)
  if (descriptionValidationError) {
    descriptionError.value = descriptionValidationError
    descriptionInput.value?.focus()
    return
  }
  if (isProcessing.value) {
    fileError.value = '자료 처리가 끝나면 다음 단계로 이동할 수 있어요.'
    return
  }
  if (!hasSelectedFile.value) {
    fileError.value = '발표 자료를 업로드하거나 이전 자료를 선택해 주세요.'
    return
  }

  presentation.setTitle(title.value.trim())
  presentation.setDescription(description.value.trim())
  presentation.setTargetMinutes(clampDuration(durationMinutes.value))
  presentation.setQnaEnabled(qnaEnabled.value)

  submissionAbandoned = false
  allowRouteLeave = false
  isSubmitting.value = true
  try {
    const file = selectedFile.value ?? presentation.stagedFile
    if (file) await presentation.uploadPresentation(file)
    // 이전 자료를 골랐고 아직 그 자료로 발표를 만들지 않았다면 슬라이드를 복사한다.
    else if (presentation.needsReuse) await presentation.reusePresentation()
    else if (!presentation.hasRenderableSlides) await presentation.ensureSlidesLoaded()
    if (submissionAbandoned) return

    leavePromptOpen.value = false
    pendingLeaveLocation = null
    allowRouteLeave = true
    await router.push('/presentation/slides')
  } catch (error) {
    leavePromptOpen.value = false
    pendingLeaveLocation = null
    fileError.value = error?.message || '설정 저장에 실패했습니다. 다시 시도해 주세요.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content" data-flow-content>
          <div class="setup-grid setup-single-column">
            <section
              class="presentation-panel setup-form-panel"
              :class="{ 'is-locked': isLocked }"
              aria-labelledby="settingsTitle"
              :aria-busy="isLocked"
            >
              <div class="presentation-panel-head">
                <strong id="settingsTitle">연습 설정</strong>
                <small v-if="isLocked" class="setup-lock-note" data-testid="setup-lock-note">
                  자료를 처리하는 중이에요. 설정은 이 단계가 끝난 뒤에 바꿀 수 있어요.
                </small>
              </div>

              <div class="form-field" :class="{ 'field-invalid': titleError }">
                <label for="title">연습 이름</label>
                <div class="limited-field is-inline-field">
                  <input
                    ref="titleInput"
                    id="title"
                    v-model="title"
                    v-grapheme-max="TITLE_MAX_LENGTH"
                    type="text"
                    :disabled="isLocked"
                    placeholder="예) 서비스 소개 발표"
                    @input="onTitleInput"
                  />
                  <small class="field-counter" data-testid="presentation-title-counter" aria-live="polite">{{ countGraphemes(title) }}/{{ TITLE_MAX_LENGTH }}</small>
                </div>
                <small v-if="titleError" class="field-error" role="alert">{{ titleError }}</small>
              </div>

              <div class="form-field" :class="{ 'field-invalid': descriptionError }">
                <label for="description">연습 설명</label>
                <div class="limited-field">
                  <textarea
                    ref="descriptionInput"
                    id="description"
                    v-model="description"
                    v-grapheme-max="DESCRIPTION_MAX_LENGTH"
                    rows="4"
                    :disabled="isLocked"
                    placeholder="이번 연습에서 집중할 내용을 간단히 적어주세요."
                    @input="onDescriptionInput"
                  ></textarea>
                  <small class="field-counter" data-testid="presentation-description-counter" aria-live="polite">{{ countGraphemes(description) }}/{{ DESCRIPTION_MAX_LENGTH }}</small>
                </div>
                <small v-if="descriptionError" class="field-error" role="alert">{{ descriptionError }}</small>
              </div>

              <div class="form-field upload-field">
                <div class="upload-field-head">
                  <label id="uploadTitle">자료 업로드</label>
                  <button
                    type="button"
                    class="reuse-open-btn"
                    data-testid="open-reuse-picker"
                    :disabled="isLocked"
                    @click="openReuseModal"
                  >이 폴더의 기존 자료 사용</button>
                </div>
                <div
                  class="upload-dropzone"
                  :class="{ 'is-dragging': isDragging, 'is-disabled': isLocked }"
                  role="button"
                  tabindex="0"
                  aria-labelledby="uploadTitle"
                  aria-describedby="uploadHelp"
                  @click="!isLocked && openFilePicker()"
                  @keydown.enter.prevent="!isLocked && openFilePicker()"
                  @keydown.space.prevent="!isLocked && openFilePicker()"
                  @dragenter.prevent="isDragging = true"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="onDrop"
                >
                  <span class="upload-copy">
                    <strong>파일을 끌어놓거나 클릭해 업로드</strong>
                    <small id="uploadHelp">PPTX 또는 PDF · 최대 50MB</small>
                  </span>
                </div>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".pptx,.pdf"
                  hidden
                  :disabled="isLocked"
                  @change="onFileChange"
                />
                <div class="upload-file-row" :class="{ show: displayFile }">
                  <div>
                    <strong :title="displayFile?.name || ''">{{ displayFile?.name }}</strong>
                    <small>{{ fileSizeLabel }}</small>
                    <small
                      v-if="uploadLabel"
                      class="upload-state-label"
                      :class="{ 'is-processing': isProcessing, 'is-done': isUploaded, 'is-error': presentation.uploadStatus === 'error' }"
                    >
                      <span v-if="isProcessing" class="upload-state-spinner" aria-hidden="true"></span>
                      <span :key="uploadLabel" class="upload-state-text">{{ uploadLabel }}</span>
                      <span v-if="isProcessing" class="upload-state-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                    </small>
                  </div>
                  <button type="button" aria-label="파일 제거" :disabled="isLocked" @click="removeFile">×</button>
                </div>

                <div v-if="reusedSource" class="upload-file-row show reused-file-row" data-testid="reused-material">
                  <div>
                    <strong :title="reusedSource.title">{{ reusedSource.title }}</strong>
                    <small>{{ reusedSource.date }} 연습 자료</small>
                    <small class="upload-state-label is-done"><span class="upload-state-text">기존 자료 재사용</span></small>
                  </div>
                  <button type="button" aria-label="기존 자료 선택 해제" :disabled="isLocked" @click="clearReusedSource">×</button>
                </div>

                <small v-if="fileError" class="field-error upload-error" role="alert">{{ fileError }}</small>
              </div>

              <div class="two-col-row">
                <div class="form-field qna-setting">
                  <div class="qna-copy"><label id="qnaLabel">질의 응답 모드</label></div>
                  <button
                    type="button"
                    class="qna-toggle"
                    :class="{ 'is-on': qnaEnabled }"
                    role="switch"
                    :aria-checked="qnaEnabled"
                    :aria-pressed="qnaEnabled"
                    aria-labelledby="qnaLabel"
                    :disabled="isLocked"
                    @click="qnaEnabled = !qnaEnabled"
                  >
                    <span class="qna-switch-track" aria-hidden="true"><i class="qna-switch-thumb"></i></span>
                    <b>{{ qnaEnabled ? 'ON' : 'OFF' }}</b>
                  </button>
                </div>

                <div class="form-field duration-setting">
                  <label for="durationInput">목표 발표 시간</label>
                  <div class="stepper-row">
                    <button type="button" class="stepper-btn" aria-label="목표 시간 1분 줄이기" :disabled="isLocked" @click="stepDuration(-1)">−</button>
                    <label class="duration-input-wrap">
                      <input
                        id="durationInput"
                        v-model.number="durationMinutes"
                        type="number"
                        :min="DURATION_MIN_MINUTES"
                        :max="DURATION_MAX_MINUTES"
                        inputmode="numeric"
                        :disabled="isLocked"
                        aria-label="목표 발표 시간(분)"
                        @input="onDurationInput"
                        @blur="onDurationBlur"
                      />
                      <span>분</span>
                    </label>
                    <button type="button" class="stepper-btn" aria-label="목표 시간 1분 늘리기" :disabled="isLocked" @click="stepDuration(1)">+</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="workflow-footer-actions">
          <button
            type="button"
            class="workflow-side-button workflow-side-prev"
            @click="requestPrevious"
            aria-label="폴더 선택으로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <button
            type="button"
            class="workflow-side-button workflow-side-next"
            aria-label="핵심 내용 설정으로 이동"
            :disabled="!canProceed || isSubmitting"
            :aria-busy="isSubmitting"
            @click="goNext"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>

  <Teleport to="body">
    <div v-if="leavePromptOpen" class="presentation-upload-leave-backdrop">
      <section
        class="presentation-upload-leave-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="presentationUploadLeaveTitle"
        aria-describedby="presentationUploadLeaveDescription"
        data-testid="presentation-upload-leave-modal"
      >
        <h2 id="presentationUploadLeaveTitle">발표 자료를 업로드 중이에요</h2>
        <p id="presentationUploadLeaveDescription">업로드가 끝나기 전에 이전 화면으로 돌아갈까요?</p>
        <div class="presentation-upload-leave-actions">
          <button
            type="button"
            class="presentation-upload-leave-continue"
            data-testid="continue-presentation-upload"
            @click="continueUpload"
          >업로드 계속하기</button>
          <button
            type="button"
            class="presentation-upload-leave-confirm"
            data-testid="leave-presentation-upload"
            @click="confirmLeave"
          >이전 화면으로 돌아가기</button>
        </div>
      </section>
    </div>

    <div v-if="reuseModalOpen" class="reuse-modal-backdrop" @click.self="closeReuseModal">
      <section
        class="reuse-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reuseModalTitle"
        data-testid="reuse-picker-modal"
      >
        <header class="reuse-modal-head">
          <div>
            <span>기존 자료 사용</span>
            <h3 id="reuseModalTitle">이 폴더에서 연습한 자료</h3>
            <p>이전에 올린 발표 자료를 그대로 다시 쓸 수 있어요. 파일을 다시 올릴 필요는 없어요.</p>
          </div>
          <button type="button" aria-label="기존 자료 목록 닫기" @click="closeReuseModal">×</button>
        </header>

        <p v-if="presentation.reusableMaterialsLoading" class="reuse-modal-state">이전 자료를 불러오는 중입니다.</p>
        <p
          v-else-if="presentation.reusableMaterialsError"
          class="reuse-modal-state is-error"
          role="alert"
        >{{ presentation.reusableMaterialsError }}</p>
        <ul v-else-if="presentation.reusableMaterials.length" class="reuse-modal-list">
          <li v-for="material in presentation.reusableMaterials" :key="material.presentationId">
            <button
              type="button"
              class="reuse-modal-item"
              :class="{ active: reusedSource?.presentationId === material.presentationId }"
              data-testid="reuse-material-option"
              @click="chooseReusableMaterial(material)"
            >
              <span class="reuse-modal-item-main">
                <strong :title="material.title">{{ material.title }}</strong>
                <small :title="material.description">{{ material.description || '설명 없음' }}</small>
              </span>
              <time>{{ material.date }}</time>
            </button>
          </li>
        </ul>
        <p v-else class="reuse-modal-state" data-testid="reuse-empty">
          이 폴더에는 아직 재사용할 발표 자료가 없어요. 첫 자료를 업로드해 주세요.
        </p>
      </section>
    </div>
  </Teleport>
</template>
