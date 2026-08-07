<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getAccessToken } from '../../api/authToken.js'
import SearchableSelect from '../../components/interview/SearchableSelect.vue'
import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { useInterviewStore } from '../../stores/interviewStore.js'
import { validateSupportDocumentFile } from '../../utils/supportDocumentFiles.js'
import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  textPolicyValidationMessage,
} from '../../utils/textInputPolicy.js'
import { practiceTitleValidationMessage } from '../../utils/validators.js'

const router = useRouter()
const interview = useInterviewStore()

const title = ref(interview.title)
const description = ref(interview.description)
const company = ref(interview.company)
const field = ref(interview.field)
const position = ref(interview.position)
const careerLevel = ref(interview.careerLevel)
const titleError = ref('')
const descriptionError = ref('')
const submitError = ref('')
const DESCRIPTION_MAX_LENGTH = INPUT_LIMITS.PRACTICE_DESCRIPTION
const TITLE_MAX_LENGTH = INPUT_LIMITS.PRACTICE_TITLE
const titleInput = ref(null)
const descriptionInput = ref(null)

const descriptionPolicyMessage = (value) => textPolicyValidationMessage(value, {
  policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
  maxLength: DESCRIPTION_MAX_LENGTH,
})

const onTitleInput = (event) => {
  titleError.value = practiceTitleValidationMessage(event.target.value)
}

const onDescriptionInput = (event) => {
  descriptionError.value = descriptionPolicyMessage(event.target.value)
}

// 회사·직군·직무 목록은 실 API(무인증 공개)에서 내려온다.
// SearchableSelect는 이름 문자열로 고르고, 저장 시 이름→id로 매핑한다.
const companyOptions = computed(() => interview.companies.map((item) => item.name))
const fieldOptions = computed(() => interview.occupations.map((item) => item.name))
const positionOptions = computed(() => interview.jobs.map((item) => item.name))
const CAREER_LEVELS = ['신입', '1~3년', '4년 이상', '무관']

const selectedOccupation = computed(() => interview.occupations.find((item) => item.name === field.value))

onMounted(async () => {
  submitError.value = ''
  try {
    await Promise.all([interview.loadCompanies(), interview.loadOccupations()])
    if (selectedOccupation.value) await interview.loadJobs(selectedOccupation.value.id)
  } catch (error) {
    submitError.value = error?.message || '선택 목록을 불러오지 못했습니다.'
  }
  if (getAccessToken()) {
    await Promise.all([interview.loadResumeCatalog(), interview.loadPortfolioCatalog()])
  }
})

// 직군이 바뀌면 해당 직군의 직무 목록을 다시 불러오고 기존 직무 선택은 초기화.
watch(field, async (nextField, prevField) => {
  if (nextField === prevField) return
  position.value = ''
  try {
    await interview.loadJobs(selectedOccupation.value?.id)
  } catch (error) {
    submitError.value = error?.message || '직무 목록을 불러오지 못했습니다.'
  }
})

// 지원 자료 — 자기소개서·포트폴리오를 실 API(자기소개서=resumeApi, 포트폴리오=
// portfolioApi)로 관리한다. 선택 목록은 스토어(interview.resumeDocs/portfolioDocs)
// 가 들고 있다가 면접 생성 시 resumeIds/portfolioIds로 전달된다.
const selectedDocs = computed(() => [...interview.resumeDocs, ...interview.portfolioDocs])
const removeDoc = (doc) => {
  if (doc.kind === 'portfolio') {
    interview.setPortfolioSelection(interview.portfolioDocs.filter((d) => d.id !== doc.id))
  } else {
    interview.setResumeSelection(interview.resumeDocs.filter((d) => d.id !== doc.id))
  }
}

const docsAuthError = ref('')
const requireAuthForDocs = () => {
  if (getAccessToken()) return true
  docsAuthError.value = '로그인 후 자료를 등록·선택할 수 있어요.'
  return false
}

// 기존 자료 선택 모달 — 자기소개서/포트폴리오 탭을 따로 두고, 임시 선택 후 확인 시 반영.
const showDocModal = ref(false)
const modalTab = ref('resume') // 'resume' | 'portfolio'
const modalResumeSelection = ref(new Set())
const modalPortfolioSelection = ref(new Set())
const modalCatalog = computed(() => (modalTab.value === 'resume' ? interview.resumeCatalog : interview.portfolioCatalog))
const activeModalSelectionRef = () => (modalTab.value === 'resume' ? modalResumeSelection : modalPortfolioSelection)
const modalSelection = computed(() => activeModalSelectionRef().value)

const openDocModal = () => {
  if (!requireAuthForDocs()) return
  modalResumeSelection.value = new Set(interview.resumeDocs.map((doc) => doc.id))
  modalPortfolioSelection.value = new Set(interview.portfolioDocs.map((doc) => doc.id))
  showDocModal.value = true
}
const closeDocModal = () => { showDocModal.value = false }
const toggleModalDoc = (id) => {
  const selectionRef = activeModalSelectionRef()
  const next = new Set(selectionRef.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectionRef.value = next
}
const deleteModalDoc = async (doc) => {
  const label = doc.kind === 'portfolio' ? '포트폴리오' : '자기소개서'
  if (!window.confirm(`\"${doc.title}\" ${label}를 삭제할까요?`)) return
  try {
    if (doc.kind === 'portfolio') {
      await interview.deletePortfolioDoc(doc.id)
      modalPortfolioSelection.value.delete(doc.id)
      modalPortfolioSelection.value = new Set(modalPortfolioSelection.value)
    } else {
      await interview.deleteResumeDoc(doc.id)
      modalResumeSelection.value.delete(doc.id)
      modalResumeSelection.value = new Set(modalResumeSelection.value)
    }
  } catch {
    // 스토어의 docsError를 모달에 표시한다.
  }
}
const applyDocModal = () => {
  interview.setResumeSelection(interview.resumeCatalog.filter((doc) => modalResumeSelection.value.has(doc.id)))
  interview.setPortfolioSelection(interview.portfolioCatalog.filter((doc) => modalPortfolioSelection.value.has(doc.id)))
  showDocModal.value = false
}

// 새 자료 등록 — 파일 선택 → 제목 입력 → 업로드. 업로드된 자료는 바로 선택 상태가 된다.
const uploadDoc = (kind) => {
  if (!requireAuthForDocs()) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,application/pdf'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    const validationError = validateSupportDocumentFile(file)
    if (validationError) {
      docsAuthError.value = validationError
      return
    }
    docsAuthError.value = ''
    const defaultTitle = file.name.replace(/\.[^.]+$/, '')
    const docTitle = window.prompt(`${kind === 'portfolio' ? '포트폴리오' : '자기소개서'} 제목을 입력해주세요.`, defaultTitle)
    if (!docTitle?.trim()) return
    if (docTitle.trim().length > INPUT_LIMITS.DOCUMENT_TITLE) {
      docsAuthError.value = `자료 제목은 ${INPUT_LIMITS.DOCUMENT_TITLE}자 이하로 입력해주세요. (현재 ${docTitle.trim().length}자)`
      return
    }
    try {
      if (kind === 'portfolio') await interview.uploadPortfolioDoc({ title: docTitle.trim(), file })
      else await interview.uploadResumeDoc({ title: docTitle.trim(), file })
    } catch {
      // 에러 문구는 interview.docsError로 화면에 표시됨.
    }
  })
  input.click()
}

const goNext = () => {
  titleError.value = ''
  descriptionError.value = ''
  submitError.value = ''
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
  // 여기서는 로컬 드래프트만 확정한다. 실제 생성(POST /interviews)은 질문 단계에서
  // AI 질문 생성과 함께 한 번에 일어난다.
  interview.setInfo({
    title: title.value.trim(),
    description: description.value.trim(),
    company: company.value,
    companyId: interview.companies.find((item) => item.name === company.value)?.id ?? null,
    field: field.value,
    occupationId: selectedOccupation.value?.id ?? null,
    position: position.value,
    jobId: interview.jobs.find((item) => item.name === position.value)?.id ?? null,
    careerLevel: careerLevel.value,
  })
  // 자소서·포트폴리오 선택은 등록/선택 즉시 스토어에 반영되므로 여기서 따로 저장할 게 없다.
  router.push('/interview/style')
}
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content" data-flow-content>
          <div class="setup-grid setup-single-column iv-single-column">
            <div class="iv-setup-column">
              <h2 class="iv-page-title">면접 정보 설정</h2>

              <div class="form-field iv-loose-field" :class="{ 'field-invalid': titleError }">
                <label for="title">연습 이름</label>
                <div class="limited-field is-inline-field">
                  <input ref="titleInput" id="title" v-model="title" v-grapheme-max="TITLE_MAX_LENGTH" type="text" placeholder="예) A사 백엔드 개발자 면접" @input="onTitleInput" />
                  <small class="field-counter" aria-live="polite">{{ countGraphemes(title) }}/{{ TITLE_MAX_LENGTH }}</small>
                </div>
                <small v-if="titleError" class="field-error" role="alert">{{ titleError }}</small>
              </div>

              <div class="form-field iv-loose-field" :class="{ 'field-invalid': descriptionError }">
                <label for="description">연습 설명</label>
                <div class="limited-field">
                  <textarea
                    ref="descriptionInput"
                    id="description"
                    v-model="description"
                    v-grapheme-max="DESCRIPTION_MAX_LENGTH"
                    rows="4"
                    placeholder="이번 연습에서 집중할 내용을 간단히 적어주세요."
                    @input="onDescriptionInput"
                  ></textarea>
                  <span class="field-counter" aria-live="polite">{{ countGraphemes(description) }}/{{ DESCRIPTION_MAX_LENGTH }}</span>
                </div>
                <small v-if="descriptionError" class="field-error" role="alert">{{ descriptionError }}</small>
              </div>

              <section class="presentation-panel iv-form-panel iv-field-card" aria-label="지원 맥락 설정">
                <div class="form-row-2 iv-form-row">
                  <div class="form-field">
                    <label>회사명</label>
                    <SearchableSelect v-model="company" :options="companyOptions" placeholder="회사 선택" search-placeholder="회사명 검색" />
                  </div>
                  <div class="form-field">
                    <label>직군</label>
                    <SearchableSelect v-model="field" :options="fieldOptions" placeholder="직군 선택" search-placeholder="직군 검색" />
                  </div>
                </div>

                <div class="form-row-2 iv-form-row">
                  <div class="form-field">
                    <label>지원 직무</label>
                    <SearchableSelect v-model="position" :options="positionOptions" :disabled="!selectedOccupation" :placeholder="selectedOccupation ? '직무 선택' : '직군을 먼저 선택하세요'" search-placeholder="직무 검색" />
                  </div>
                  <div class="form-field">
                    <label id="levelLabel">경력 구분</label>
                    <!-- 브라우저 기본 select는 회사·직군·직무와 모양이 달라(OS 드롭다운)
                         같은 커스텀 셀렉트를 쓴다. 옵션이 4개뿐이라 검색칸은 뺀다. -->
                    <SearchableSelect
                      v-model="careerLevel"
                      :options="CAREER_LEVELS"
                      :searchable="false"
                      placeholder="경력 선택"
                      aria-labelledby="levelLabel"
                    />
                  </div>
                </div>

                <div class="form-field iv-docs-field">
                  <label>지원 자료</label>
                  <div class="iv-docs-actions">
                    <button type="button" class="iv-doc-choice" @click="openDocModal">기존 자료 선택</button>
                    <button type="button" class="iv-doc-choice iv-doc-upload-choice" :disabled="interview.docsSaving" @click="uploadDoc('resume')">
                      <span>자기소개서 등록</span>
                      <small data-testid="resume-upload-limit">최대 50MB</small>
                    </button>
                    <button type="button" class="iv-doc-choice iv-doc-upload-choice" :disabled="interview.docsSaving" @click="uploadDoc('portfolio')">
                      <span>포트폴리오 등록</span>
                      <small data-testid="portfolio-upload-limit">최대 50MB</small>
                    </button>
                  </div>
                  <p v-if="docsAuthError || interview.docsError" class="field-error">{{ docsAuthError || interview.docsError }}</p>
                  <ul v-if="selectedDocs.length" class="iv-docs-chosen">
                    <li v-for="doc in selectedDocs" :key="`${doc.kind}-${doc.id}`">
                      <div><strong :title="doc.title">{{ doc.title }}</strong><small>{{ doc.label }}</small></div>
                      <button type="button" aria-label="자료 제거" @click="removeDoc(doc)">×</button>
                    </li>
                  </ul>
                  <p v-else class="iv-docs-empty">선택된 자료가 없어요. 기존 자료를 선택하거나 새로 등록하세요.</p>
                </div>
              </section>
            </div>
          </div>
        </div>

        <p v-if="submitError || interview.saveError" class="iv-flow-error" role="alert">{{ submitError || interview.saveError }}</p>
        <div class="workflow-footer-actions">
          <RouterLink class="workflow-side-button workflow-side-prev" to="/practice/folders?type=interview" aria-label="폴더 선택으로 돌아가기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button type="button" class="workflow-side-button workflow-side-next" :disabled="interview.saving" aria-label="면접관 선택으로 이동" @click="goNext">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>

  <Teleport to="body">
    <div v-if="showDocModal" class="iv-modal-backdrop" @click.self="closeDocModal">
      <div class="iv-modal" role="dialog" aria-modal="true" aria-labelledby="docModalTitle">
        <header class="iv-modal-head">
          <h3 id="docModalTitle">기존 자료 선택</h3>
          <button type="button" class="iv-modal-close" aria-label="닫기" @click="closeDocModal">×</button>
        </header>
        <div class="auth-tabs" role="tablist" aria-label="자료 종류">
          <button type="button" :class="{ active: modalTab === 'resume' }" role="tab" :aria-selected="modalTab === 'resume'" @click="modalTab = 'resume'">자기소개서</button>
          <button type="button" :class="{ active: modalTab === 'portfolio' }" role="tab" :aria-selected="modalTab === 'portfolio'" @click="modalTab = 'portfolio'">포트폴리오</button>
        </div>
        <ul class="iv-modal-doc-list">
          <li
            v-for="doc in modalCatalog"
            :key="doc.id"
            class="iv-modal-doc"
            :class="{ selected: modalSelection.has(doc.id) }"
            @click="toggleModalDoc(doc.id)"
          >
            <div class="iv-modal-doc-meta">
              <strong :title="doc.title">{{ doc.title }}</strong>
            </div>
            <button
              type="button"
              class="iv-modal-doc-delete"
              :disabled="interview.docsSaving"
              :aria-label="`${doc.title} 삭제`"
              @click.stop="deleteModalDoc(doc)"
            >삭제</button>
            <span class="iv-modal-check" aria-hidden="true">{{ modalSelection.has(doc.id) ? '✓' : '' }}</span>
          </li>
          <li v-if="!modalCatalog.length" class="iv-modal-doc-empty">등록된 {{ modalTab === 'resume' ? '자기소개서' : '포트폴리오' }}가 없어요.</li>
        </ul>
        <p v-if="interview.docsError" class="field-error">{{ interview.docsError }}</p>
        <div class="iv-modal-actions">
          <button type="button" class="iv-ghost-btn" @click="closeDocModal">취소</button>
          <button type="button" class="iv-solid-btn" @click="applyDocModal">확인 ({{ modalResumeSelection.size + modalPortfolioSelection.size }})</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
