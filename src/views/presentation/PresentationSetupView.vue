<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { usePresentationStore } from '../../stores/presentationStore.js'
import { validatePresentationFile } from '../../utils/presentationFiles.js'

const router = useRouter()
const presentation = usePresentationStore()

const title = ref(presentation.title)
const description = ref(presentation.description)
const durationMinutes = ref(presentation.targetMinutes)
const qnaEnabled = ref(presentation.qnaEnabled)

const titleError = ref('')
const fileError = ref('')
const isDragging = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)
const isSubmitting = ref(false)

const displayFile = computed(() => selectedFile.value ?? presentation.sourceFile)

// Upload progress is driven entirely by the store's reactive `uploadStatus`, so
// the label flips to 완료 the instant processing resolves — no navigation needed.
const isProcessing = computed(() => presentation.uploadStatus === 'processing')
const isUploaded = computed(() => presentation.uploadStatus === 'ready' && presentation.hasRenderableSlides)

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
  if (selectedFile.value) return '업로드 대기'
  return ''
})

const fileSizeLabel = computed(() =>
  displayFile.value ? `${(displayFile.value.size / 1024 / 1024).toFixed(1)}MB` : '',
)

// Task 3: the CTA is only enabled once the required fields are truly satisfied —
// a name is present and the slides finished processing on the server/mock.
const canProceed = computed(() => Boolean(title.value.trim()) && isUploaded.value && !isProcessing.value)

const clampDuration = (value) => Math.min(60, Math.max(1, Number.parseInt(value, 10) || 1))

const stepDuration = (delta) => {
  durationMinutes.value = clampDuration(durationMinutes.value + delta)
}
const onDurationBlur = () => {
  durationMinutes.value = clampDuration(durationMinutes.value)
}

const openFilePicker = () => fileInput.value?.click()

// Task 1: kick off the async upload the moment a file is chosen. The store sets
// uploadStatus 'processing' → 'ready', and every dependent computed (label,
// canProceed) reacts immediately — the old code deferred this to goNext(), so
// the "대기" label only cleared after a route round-trip re-read the store.
const runUpload = async (file) => {
  fileError.value = ''
  try {
    await presentation.uploadPresentation(file)
  } catch (error) {
    fileError.value = error?.message || presentation.uploadError || '자료 처리에 실패했습니다. 다시 시도해 주세요.'
  }
}
const selectFile = (file) => {
  const error = validatePresentationFile(file)
  fileError.value = error
  if (error) {
    selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  selectedFile.value = file
  runUpload(file)
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

const goNext = async () => {
  titleError.value = ''
  fileError.value = ''
  if (!title.value.trim()) {
    titleError.value = '연습 이름을 입력해주세요.'
    return
  }
  if (isProcessing.value) {
    fileError.value = '자료 처리가 끝나면 다음 단계로 이동할 수 있어요.'
    return
  }
  if (!isUploaded.value) {
    fileError.value = '발표 자료를 업로드해 주세요.'
    return
  }

  presentation.setTitle(title.value.trim())
  presentation.setDescription(description.value.trim())
  presentation.setTargetMinutes(clampDuration(durationMinutes.value))
  presentation.setQnaEnabled(qnaEnabled.value)

  // The file was already uploaded on selection (Task 1); here we only persist
  // the remaining settings before advancing.
  isSubmitting.value = true
  try {
    await presentation.syncSettings()
    await router.push('/presentation/slides')
  } catch (error) {
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
            <section class="presentation-panel setup-form-panel" aria-labelledby="settingsTitle">
              <div class="presentation-panel-head"><strong id="settingsTitle">연습 설정</strong></div>

              <div class="form-field" :class="{ 'field-invalid': titleError }">
                <label for="title">연습 이름</label>
                <input
                  id="title"
                  v-model="title"
                  type="text"
                  placeholder="예) 서비스 소개 발표"
                  @input="titleError = ''"
                />
                <small v-if="titleError" class="field-error">{{ titleError }}</small>
              </div>

              <div class="form-field">
                <label for="description">연습 설명 <span>(선택)</span></label>
                <textarea
                  id="description"
                  v-model="description"
                  rows="2"
                  maxlength="160"
                  placeholder="이번 연습에서 집중할 내용을 간단히 적어주세요."
                ></textarea>
              </div>

              <div class="form-field upload-field">
                <label id="uploadTitle">자료 업로드</label>
                <div
                  class="upload-dropzone"
                  :class="{ 'is-dragging': isDragging, 'is-disabled': isSubmitting }"
                  role="button"
                  tabindex="0"
                  aria-labelledby="uploadTitle"
                  aria-describedby="uploadHelp"
                  @click="!isSubmitting && openFilePicker()"
                  @keydown.enter.prevent="openFilePicker"
                  @keydown.space.prevent="openFilePicker"
                  @dragenter.prevent="isDragging = true"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="onDrop"
                >
                  <span class="upload-copy">
                    <strong>파일을 끌어놓거나 클릭해 업로드</strong>
                    <small id="uploadHelp">PPTX 또는 PDF · 최대 100MB</small>
                  </span>
                </div>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".pptx,.pdf"
                  hidden
                  :disabled="isSubmitting"
                  @change="onFileChange"
                />
                <div class="upload-file-row" :class="{ show: displayFile }">
                  <div>
                    <strong>{{ displayFile?.name }}</strong>
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
                  <button type="button" aria-label="파일 제거" :disabled="isSubmitting" @click="removeFile">×</button>
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
                    @click="qnaEnabled = !qnaEnabled"
                  >
                    <span class="qna-switch-track" aria-hidden="true"><i class="qna-switch-thumb"></i></span>
                    <b>{{ qnaEnabled ? 'ON' : 'OFF' }}</b>
                  </button>
                </div>

                <div class="form-field duration-setting">
                  <label for="durationInput">목표 발표 시간</label>
                  <div class="stepper-row">
                    <button type="button" class="stepper-btn" aria-label="목표 시간 1분 줄이기" @click="stepDuration(-1)">−</button>
                    <label class="duration-input-wrap">
                      <input
                        id="durationInput"
                        v-model.number="durationMinutes"
                        type="number"
                        min="1"
                        max="60"
                        inputmode="numeric"
                        aria-label="목표 발표 시간(분)"
                        @blur="onDurationBlur"
                      />
                      <span>분</span>
                    </label>
                    <button type="button" class="stepper-btn" aria-label="목표 시간 1분 늘리기" @click="stepDuration(1)">+</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="workflow-footer-actions">
          <RouterLink
            class="workflow-side-button workflow-side-prev"
            to="/practice/folders?type=presentation"
            aria-label="폴더 선택으로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
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
</template>
