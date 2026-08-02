<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { usePresentationStore } from '../../stores/presentationStore.js'
import { usePracticeStore } from '../../stores/practiceStore.js'
import { validatePresentationFile } from '../../utils/presentationFiles.js'
import { practiceApi } from '../../api/practiceApi.js'
import { withMock } from '../../api/withMock.js'

const router = useRouter()
const presentation = usePresentationStore()
const practice = usePracticeStore()

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
const isSubmitting = ref(false)
const DESCRIPTION_MAX_LENGTH = 50

watch(description, (value) => {
  const limited = String(value ?? '').slice(0, DESCRIPTION_MAX_LENGTH)
  if (limited !== value) description.value = limited
}, { immediate: true })

// 이 폴더에 자료 재사용(reuse) vs 새 파일 업로드(new). 이전 단계(폴더 선택)에서
// 넘어온 폴더의 기존 자료를 여기 자료 업로드 영역에서 바로 고를 수 있게 한다.
const folderMaterials = ref([])
const materialsLoading = ref(false)
// null = 아직 아무것도 안 고른 초기 상태(그냥 "자료 선택" 버튼만 보임).
const materialMode = ref(
  presentation.stagedMaterialId != null
    ? 'reuse'
    : (presentation.stagedFile || presentation.sourceFile) ? 'new' : null,
)
const selectedMaterialId = ref(presentation.stagedMaterialId)

// TODO(backend): GET /practice-folders/{id}/materials 나오면 목 제거.
const buildFolderMaterialsMock = () => [
  { id: 'mat-3', name: '3차_발표자료.pptx', type: 'pptx', uploadedAt: '2026-07-20' },
  { id: 'mat-2', name: '2차_발표.pdf', type: 'pdf', uploadedAt: '2026-07-12' },
  { id: 'mat-1', name: '1차_초안.pptx', type: 'pptx', uploadedAt: '2026-07-05' },
]

const loadFolderMaterials = async () => {
  const folderId = practice.folderId
  if (!folderId) {
    folderMaterials.value = []
    if (materialMode.value == null) materialMode.value = 'new'
    return
  }
  materialsLoading.value = true
  try {
    const response = await withMock(
      () => practiceApi.listFolderMaterials(folderId),
      () => ({ materials: buildFolderMaterialsMock() }),
    )
    folderMaterials.value = response?.materials ?? (Array.isArray(response) ? response : [])
  } catch {
    folderMaterials.value = []
  } finally {
    materialsLoading.value = false
  }
  // 이미 뭔가 고른 상태(재사용/새 파일)라면 그대로 둔다. 재사용할 자료가 아예
  // 없는 폴더는 고를 게 없으니 바로 새 파일 업로드로 확정한다. 그 외엔 아무것도
  // 자동으로 고르지 않고 "자료 선택" 버튼만 보이는 초기 상태를 유지한다.
  if (materialMode.value != null) return
  if (!folderMaterials.value.length) materialMode.value = 'new'
}

const chooseReuseMaterial = (id) => {
  materialMode.value = 'reuse'
  selectedMaterialId.value = id
  fileError.value = ''
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  presentation.clearPresentationFile()
}
const chooseNewFile = () => {
  materialMode.value = 'new'
  selectedMaterialId.value = null
}

// 자료가 늘어나도 화면이 길어지지 않도록, 목록은 검색 가능한 팝업으로 고르고
// 이 화면에는 지금 선택된 자료 한 줄만 보여준다.
const isMaterialModalOpen = ref(false)
const materialSearch = ref('')
const selectedMaterial = computed(() => (
  folderMaterials.value.find((m) => m.id === selectedMaterialId.value) ?? null
))
const filteredMaterials = computed(() => {
  const keyword = materialSearch.value.trim().toLowerCase()
  if (!keyword) return folderMaterials.value
  return folderMaterials.value.filter((m) => m.name.toLowerCase().includes(keyword))
})
const openMaterialModal = () => {
  materialSearch.value = ''
  isMaterialModalOpen.value = true
}
const closeMaterialModal = () => { isMaterialModalOpen.value = false }
const pickMaterialFromModal = (id) => {
  chooseReuseMaterial(id)
  closeMaterialModal()
}
const pickNewFileFromModal = () => {
  chooseNewFile()
  closeMaterialModal()
  openFilePicker()
}

const displayFile = computed(() => selectedFile.value ?? presentation.sourceFile)

// Upload progress is driven entirely by the store's reactive `uploadStatus`, so
// the label flips to 완료 the instant processing resolves — no navigation needed.
const isProcessing = computed(() => presentation.uploadStatus === 'processing')
const isUploaded = computed(() => presentation.uploadStatus === 'ready' && presentation.hasRenderableSlides)
const hasSelectedFile = computed(() => Boolean(
  selectedFile.value || presentation.stagedFile || presentation.sourceFile,
))
const hasSelectedMaterial = computed(() => materialMode.value === 'reuse' && selectedMaterialId.value != null)
const hasAnySelection = computed(() => hasSelectedMaterial.value || hasSelectedFile.value)

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
onMounted(loadFolderMaterials)

const uploadLabel = computed(() => {
  if (isProcessing.value) return PROCESSING_PHASES[phaseIndex.value]
  if (presentation.uploadStatus === 'ready') return '완료'
  if (presentation.uploadStatus === 'error') return '업로드 실패'
  if (selectedFile.value) return '업로드 대기'
  return ''
})

// reuse는 파일 변환이 아니라 서버가 기존 슬라이드를 복사하는 것이라 업로드
// 단계 문구 대신 일반적인 문구를 쓴다. 처리 중이 아니면 null → 화면에서
// 정적인 "OO 자료 재사용 중" 문구로 대체.
const reuseStatusLabel = computed(() => {
  if (isProcessing.value) return '자료 준비 중'
  if (presentation.uploadStatus === 'ready') return '완료'
  if (presentation.uploadStatus === 'error') return '생성 실패'
  return null
})

const fileSizeLabel = computed(() =>
  displayFile.value ? `${(displayFile.value.size / 1024 / 1024).toFixed(1)}MB` : '',
)

const canProceed = computed(() => (
  Boolean(title.value.trim())
  && Boolean(description.value.trim())
  && (hasSelectedFile.value || hasSelectedMaterial.value)
  && !isProcessing.value
))

const clampDuration = (value) => Math.min(60, Math.max(1, Number.parseInt(value, 10) || 1))

const stepDuration = (delta) => {
  durationMinutes.value = clampDuration(durationMinutes.value + delta)
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
  materialMode.value = 'new'
  selectedMaterialId.value = null
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

// 자료 카드 자체가 하나의 클릭 영역 — 아무것도 안 골랐든, 이미 골랐든 눌러서
// 다시 고를 수 있다(폴더에 재사용할 자료가 있으면 팝업, 없으면 바로 파일 탐색기).
// ×는 선택을 완전히 지우기만 하는 별도 동작.
const onCardClick = () => {
  if (isSubmitting.value) return
  if (folderMaterials.value.length) openMaterialModal()
  else openFilePicker()
}
const clearMaterialSelection = () => {
  materialMode.value = folderMaterials.value.length ? null : 'new'
  selectedMaterialId.value = null
  selectedFile.value = null
  fileError.value = ''
  if (fileInput.value) fileInput.value.value = ''
  presentation.clearPresentationFile()
}

const goNext = async () => {
  titleError.value = ''
  descriptionError.value = ''
  fileError.value = ''
  if (!title.value.trim()) {
    titleError.value = '연습 이름을 입력해주세요.'
    return
  }
  if (!description.value.trim()) {
    descriptionError.value = '연습 설명을 입력해주세요.'
    return
  }
  if (description.value.trim().length > DESCRIPTION_MAX_LENGTH) {
    descriptionError.value = `연습 설명은 ${DESCRIPTION_MAX_LENGTH}자 이하여야 합니다.`
    return
  }
  if (isProcessing.value) {
    fileError.value = '자료 처리가 끝나면 다음 단계로 이동할 수 있어요.'
    return
  }
  if (materialMode.value === 'reuse') {
    if (selectedMaterialId.value == null) {
      fileError.value = '사용할 자료를 선택해 주세요.'
      return
    }
    presentation.stageReusedMaterial(selectedMaterialId.value)
  } else if (materialMode.value === 'new') {
    if (!hasSelectedFile.value) {
      fileError.value = '발표 자료를 업로드해 주세요.'
      return
    }
  } else {
    fileError.value = '자료를 선택해 주세요.'
    return
  }

  presentation.setTitle(title.value.trim())
  presentation.setDescription(description.value.trim())
  presentation.setTargetMinutes(clampDuration(durationMinutes.value))
  presentation.setQnaEnabled(qnaEnabled.value)

  isSubmitting.value = true
  try {
    if (materialMode.value === 'reuse') {
      await presentation.reusePresentation()
    } else {
      const file = selectedFile.value ?? presentation.stagedFile
      if (file) await presentation.uploadPresentation(file)
      else if (!presentation.hasRenderableSlides) await presentation.ensureSlidesLoaded()
    }
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
                  maxlength="128"
                  placeholder="예) 서비스 소개 발표"
                  @input="titleError = ''"
                />
                <small v-if="titleError" class="field-error">{{ titleError }}</small>
              </div>

              <div class="form-field" :class="{ 'field-invalid': descriptionError }">
                <label for="description">연습 설명</label>
                <div class="desc-input-wrap">
                  <textarea
                    id="description"
                    v-model="description"
                    rows="2"
                    :maxlength="DESCRIPTION_MAX_LENGTH"
                    placeholder="이번 연습에서 집중할 내용을 간단히 적어주세요."
                    @input="descriptionError = ''"
                  ></textarea>
                  <span class="folder-desc-counter">{{ description.length }}/{{ DESCRIPTION_MAX_LENGTH }}</span>
                </div>
                <small v-if="descriptionError" class="field-error">{{ descriptionError }}</small>
              </div>

              <div class="form-field upload-field">
                <label id="uploadTitle">자료 업로드</label>

                <p v-if="materialsLoading" class="material-hint">이 폴더의 자료 목록을 불러오는 중…</p>

                <div
                  v-else
                  class="material-card"
                  :class="{
                    'is-empty': !hasAnySelection,
                    'is-dragging': isDragging,
                    'is-disabled': isSubmitting,
                    'is-error': presentation.uploadStatus === 'error',
                  }"
                  role="button"
                  tabindex="0"
                  aria-labelledby="uploadTitle"
                  @click="onCardClick"
                  @keydown.enter.prevent="onCardClick"
                  @keydown.space.prevent="onCardClick"
                  @dragenter.prevent="isDragging = true"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="onDrop"
                >
                  <span class="material-card-icon" aria-hidden="true">
                    <svg v-if="hasAnySelection" viewBox="0 0 24 24"><path d="M6 3.5h8.5L19 8v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h5" /></svg>
                    <svg v-else viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  </span>

                  <span class="material-card-body">
                    <template v-if="!hasAnySelection">
                      <strong>자료 선택</strong>
                      <small>{{ folderMaterials.length ? '이 폴더의 기존 자료를 쓰거나 새로 업로드해요' : '파일을 끌어놓거나 클릭해 업로드 (PPTX·PDF, 최대 100MB)' }}</small>
                    </template>
                    <template v-else-if="materialMode === 'reuse'">
                      <strong :title="selectedMaterial?.name">{{ selectedMaterial?.name }}</strong>
                      <small
                        class="material-card-status"
                        :class="{ 'is-processing': isProcessing, 'is-done': isUploaded, 'is-error': presentation.uploadStatus === 'error' }"
                      >
                        <span v-if="isProcessing" class="upload-state-spinner" aria-hidden="true"></span>
                        <span :key="reuseStatusLabel" class="upload-state-text">
                          <template v-if="reuseStatusLabel">{{ reuseStatusLabel }}</template>
                          <template v-else>{{ selectedMaterial?.type ? `${selectedMaterial.type.toUpperCase()} ` : '' }}자료 재사용 중</template>
                        </span>
                        <span v-if="isProcessing" class="upload-state-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                      </small>
                    </template>
                    <template v-else>
                      <strong :title="displayFile?.name">{{ displayFile?.name }}</strong>
                      <small
                        class="material-card-status"
                        :class="{ 'is-processing': isProcessing, 'is-done': isUploaded, 'is-error': presentation.uploadStatus === 'error' }"
                      >
                        <span v-if="isProcessing" class="upload-state-spinner" aria-hidden="true"></span>
                        <span :key="uploadLabel" class="upload-state-text">{{ fileSizeLabel }}<template v-if="uploadLabel"> · {{ uploadLabel }}</template></span>
                        <span v-if="isProcessing" class="upload-state-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                      </small>
                    </template>
                  </span>

                  <button
                    v-if="hasAnySelection"
                    type="button"
                    class="material-card-remove"
                    aria-label="자료 선택 취소"
                    :disabled="isSubmitting"
                    @click.stop="clearMaterialSelection"
                  >×</button>
                </div>

                <input
                  ref="fileInput"
                  type="file"
                  accept=".pptx,.pdf"
                  hidden
                  :disabled="isSubmitting"
                  @change="onFileChange"
                />
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

  <Teleport to="body">
    <div v-if="isMaterialModalOpen" class="material-modal-backdrop" @click.self="closeMaterialModal">
      <section class="material-modal" role="dialog" aria-modal="true" aria-labelledby="materialModalTitle">
        <header class="material-modal-head">
          <h3 id="materialModalTitle">이 연습에 사용할 자료</h3>
          <button type="button" class="material-modal-close" aria-label="닫기" @click="closeMaterialModal">×</button>
        </header>

        <label class="material-modal-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input v-model="materialSearch" type="text" placeholder="파일명 검색" />
        </label>

        <div class="material-modal-list" role="radiogroup" aria-label="이 폴더의 자료 목록">
          <label
            v-for="m in filteredMaterials"
            :key="m.id"
            class="material-option"
            :class="{ 'is-selected': materialMode === 'reuse' && selectedMaterialId === m.id }"
          >
            <input
              type="radio"
              name="modalMaterial"
              :checked="materialMode === 'reuse' && selectedMaterialId === m.id"
              @change="pickMaterialFromModal(m.id)"
            />
            <span class="material-name" :title="m.name">{{ m.name }}</span>
            <span v-if="m.type" class="material-type">{{ m.type }}</span>
          </label>
          <p v-if="!filteredMaterials.length" class="material-modal-empty">검색 결과가 없어요.</p>
        </div>

        <button type="button" class="material-modal-newfile" @click="pickNewFileFromModal">
          + 새 자료 업로드
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.desc-input-wrap {
  position: relative;
}
.desc-input-wrap textarea {
  padding-bottom: 26px;
}
.desc-input-wrap .folder-desc-counter {
  position: absolute;
  right: 12px;
  bottom: 8px;
  color: #9aa4ba;
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
}
</style>
