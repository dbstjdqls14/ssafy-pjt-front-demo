<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDocumentsStore } from '../../stores/documentsStore.js'
import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { validateSupportDocumentFile } from '../../utils/supportDocumentFiles.js'
import {
  TEXT_INPUT_POLICIES,
  countGraphemes,
  textPolicyValidationMessage,
} from '../../utils/textInputPolicy.js'

const router = useRouter()
const store = useDocumentsStore()

const filters = [
  { value: 'all', label: '전체' },
  { value: 'resume', label: '자소서' },
  { value: 'portfolio', label: '포트폴리오' },
]

const activeFilter = ref('all')
const deleteTarget = ref(null)
const registrationOpen = ref(false)
const registrationStep = ref('type')
const documentType = ref('')
const documentTitle = ref('')
const documentFile = ref(null)
const documentTitleError = ref('')
const formError = ref('')
const documentTitleInput = ref(null)

const documentTitlePolicyMessage = (value) => textPolicyValidationMessage(value, {
  policy: TEXT_INPUT_POLICIES.SINGLE_LINE_CONTENT,
  maxLength: INPUT_LIMITS.DOCUMENT_TITLE,
})
const onDocumentTitleInput = (event) => {
  documentTitleError.value = documentTitlePolicyMessage(event.target.value)
}

const visibleDocs = computed(() =>
  activeFilter.value === 'all'
    ? store.documents
    : store.documents.filter((doc) => doc.type === activeFilter.value),
)

const selectedTypeLabel = computed(() => documentType.value === 'portfolio' ? '포트폴리오' : '자소서')

const loadDocuments = () => store.loadDocuments().catch(() => {})
onMounted(loadDocuments)

const openRegistration = () => {
  registrationOpen.value = true
  registrationStep.value = 'type'
  documentType.value = ''
  documentTitle.value = ''
  documentFile.value = null
  documentTitleError.value = ''
  formError.value = ''
}

const closeRegistration = () => {
  if (store.loading) return
  registrationOpen.value = false
}

const chooseType = (type) => {
  documentType.value = type
  registrationStep.value = 'form'
  formError.value = ''
}

const goBackToType = () => {
  if (store.loading) return
  registrationStep.value = 'type'
  formError.value = ''
}

const selectFile = (event) => {
  documentFile.value = event.target.files?.[0] ?? null
  formError.value = ''
}

const validateTitle = () => {
  const title = documentTitle.value.trim()
  if (!title) return '자료 제목을 입력해 주세요.'
  const policyError = documentTitlePolicyMessage(documentTitle.value)
  if (policyError) return policyError
  return ''
}

const submitRegistration = async () => {
  documentTitleError.value = validateTitle()
  if (documentTitleError.value) {
    documentTitleInput.value?.focus()
    return
  }
  formError.value = validateSupportDocumentFile(documentFile.value)
  if (formError.value) return

  try {
    await store.uploadDocument({
      type: documentType.value,
      title: documentTitle.value.trim(),
      file: documentFile.value,
    })
    registrationOpen.value = false
  } catch {
    formError.value = '자료를 등록하지 못했습니다. 입력 내용을 유지했으니 다시 시도해 주세요.'
  }
}

const openDocument = (doc) => router.push({ name: 'mypage-document-detail', params: { id: doc.id } })
const requestDelete = (doc) => { deleteTarget.value = doc }
const cancelDelete = () => { deleteTarget.value = null }
const confirmDelete = async () => {
  if (!deleteTarget.value) return
  try {
    await store.removeDocument(deleteTarget.value.id)
    deleteTarget.value = null
  } catch {
    // The store error is rendered in the page and the dialog remains retryable.
  }
}
</script>

<template>
  <section class="mypage-panel">
    <header class="mypage-content-head mypage-documents-head">
      <div>
        <h2>자소서 및 포트폴리오</h2>
        <p>지원 자료를 등록하고 한곳에서 관리하세요.</p>
      </div>
      <button
        type="button"
        class="btn-primary mypage-primary-action"
        data-testid="open-document-registration"
        :disabled="store.loading"
        @click="openRegistration"
      >새 자료 등록</button>
    </header>

    <div class="doc-filter-chips" role="tablist" aria-label="자료 유형">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        :class="{ active: activeFilter === filter.value }"
        role="tab"
        :aria-selected="activeFilter === filter.value"
        @click="activeFilter = filter.value"
      >{{ filter.label }}</button>
    </div>

    <div v-if="store.error" class="doc-state-message is-error" role="alert">
      <p>{{ store.error }}</p>
      <button type="button" class="btn-secondary" data-testid="retry-documents" :disabled="store.loading" @click="loadDocuments">다시 시도</button>
    </div>
    <p v-if="store.loading && !store.documents.length" class="doc-state-message">지원 자료를 불러오는 중입니다.</p>

    <div v-else-if="visibleDocs.length" class="doc-grid">
      <article v-for="doc in visibleDocs" :key="doc.id" class="doc-card">
        <span class="doc-tag" :class="{ portfolio: doc.type === 'portfolio' }">{{ doc.type === 'portfolio' ? '포트폴리오' : '자소서' }}</span>
        <strong class="doc-card-title" :title="doc.name">{{ doc.name }}</strong>
        <small>{{ doc.date }}</small>
        <div class="doc-footer">
          <button type="button" class="doc-delete-button" aria-label="지원 자료 삭제" @click="requestDelete(doc)">삭제</button>
          <button type="button" @click="openDocument(doc)">보기</button>
        </div>
      </article>
    </div>

    <div v-else-if="!store.error" class="doc-empty-state">
      <span aria-hidden="true">＋</span>
      <strong>{{ activeFilter === 'all' ? '등록된 지원 자료가 없어요.' : '이 유형의 지원 자료가 없어요.' }}</strong>
      <p>자소서나 포트폴리오를 등록하면 면접 연습에서 바로 선택할 수 있어요.</p>
      <button type="button" class="btn-primary" @click="openRegistration">첫 자료 등록</button>
    </div>
  </section>

  <Teleport to="body">
    <div v-if="registrationOpen" class="doc-modal-backdrop" @click.self="closeRegistration">
      <section
        class="doc-registration-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="documentRegistrationTitle"
        data-testid="document-registration-modal"
      >
        <div v-if="registrationStep === 'type'" data-testid="document-type-step">
          <header class="doc-registration-head">
            <div>
              <span>새 자료 등록</span>
              <h3 id="documentRegistrationTitle">자료 유형을 선택해 주세요</h3>
              <p>등록할 자료에 맞는 서버 저장소로 연결됩니다.</p>
            </div>
            <button type="button" aria-label="등록 창 닫기" @click="closeRegistration">×</button>
          </header>
          <div class="doc-type-options">
            <button type="button" data-document-type="resume" @click="chooseType('resume')">
              <strong>자소서</strong>
              <span>지원 동기와 경험이 담긴 자소서를 등록합니다.</span>
            </button>
            <button type="button" data-document-type="portfolio" @click="chooseType('portfolio')">
              <strong>포트폴리오</strong>
              <span>프로젝트와 작업물을 정리한 자료를 등록합니다.</span>
            </button>
          </div>
        </div>

        <form v-else data-testid="submit-document" @submit.prevent="submitRegistration">
          <header class="doc-registration-head">
            <div>
              <span>{{ selectedTypeLabel }} 등록</span>
              <h3 id="documentRegistrationTitle">자료 정보를 입력해 주세요</h3>
              <p>제목과 PDF 파일은 모두 필수입니다.</p>
            </div>
            <button type="button" aria-label="등록 창 닫기" :disabled="store.loading" @click="closeRegistration">×</button>
          </header>

          <label class="doc-form-field" :class="{ 'field-invalid': documentTitleError }">
            <span>자료 제목</span>
            <div class="limited-field is-inline-field">
               <input ref="documentTitleInput" v-model="documentTitle" v-grapheme-max="INPUT_LIMITS.DOCUMENT_TITLE" data-testid="document-title" type="text" placeholder="자료 제목을 입력해 주세요" :disabled="store.loading" @input="onDocumentTitleInput" />
              <small class="field-counter" data-testid="document-title-counter" aria-live="polite">{{ countGraphemes(documentTitle) }}/{{ INPUT_LIMITS.DOCUMENT_TITLE }}</small>
            </div>
            <small v-if="documentTitleError" class="field-error" data-testid="document-title-error" role="alert">{{ documentTitleError }}</small>
          </label>

          <label class="doc-file-field">
            <span>PDF 파일</span>
            <input data-testid="document-file" type="file" accept=".pdf,application/pdf" :disabled="store.loading" @change="selectFile" />
            <strong class="doc-file-name" :title="documentFile?.name || ''">{{ documentFile?.name || 'PDF 파일을 선택해 주세요' }}</strong>
            <small class="doc-file-help" data-testid="document-file-help">PDF · 최대 50MB</small>
          </label>

          <p v-if="formError" class="doc-form-error" data-testid="document-form-error" role="alert">{{ formError }}</p>

          <div class="doc-registration-actions">
            <button type="button" class="btn-secondary" :disabled="store.loading" @click="goBackToType">이전</button>
            <button type="submit" class="btn-primary" :disabled="store.loading">{{ store.loading ? '등록 중...' : '등록하기' }}</button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="deleteTarget" class="doc-modal-backdrop" @click.self="cancelDelete">
      <section class="doc-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="deleteDocumentTitle">
        <span class="doc-confirm-icon" aria-hidden="true">!</span>
        <h3 id="deleteDocumentTitle">지원 자료를 삭제할까요?</h3>
        <p><strong class="doc-delete-title" :title="deleteTarget.name">{{ deleteTarget.name }}</strong><br />삭제한 자료는 복구할 수 없습니다.</p>
        <div class="doc-confirm-actions">
          <button type="button" class="btn-secondary" @click="cancelDelete">취소</button>
          <button type="button" class="doc-danger-button" :disabled="store.loading" @click="confirmDelete">삭제</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
