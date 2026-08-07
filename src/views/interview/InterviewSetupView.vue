<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import SearchableSelect from '../../components/interview/SearchableSelect.vue'
import { useInterviewStore } from '../../stores/interviewStore.js'

const router = useRouter()
const interview = useInterviewStore()

const title = ref(interview.title)
const company = ref(interview.company)
const field = ref(interview.field)
const position = ref(interview.position)
const careerLevel = ref(interview.careerLevel)
const titleError = ref('')
const submitError = ref('')
const pendingUploads = ref([])

const COMPANIES = ['A사', '카카오', '네이버클라우드', '삼성SDS', '한화시스템']
const FIELDS = ['공학 및 IT', '경영 및 기획', '디자인']
const POSITIONS = ['백엔드 개발자', '프론트엔드 개발자', 'AI/ML 엔지니어', '서비스 기획자']
const CAREER_LEVELS = ['신입', '1~3년', '4년 이상', '무관']

// 지원 자료 — 카드 안에서 기존 자료 선택(모달) / 새 자료 등록으로 관리.
// 기본값은 비어 있어야 하므로 모두 미선택. 기존 자료는 모달에서 고를 수 있게 목록만 유지.
const docs = ref([
  { name: '백엔드_개발자_이력서.pdf', type: '이력서', size: '1.2MB', date: '7월 14일', selected: false },
  { name: 'A사_지원_자기소개서.pdf', type: '자기소개서', size: '840KB', date: '7월 12일', selected: false },
  { name: 'AIVO_프로젝트_포트폴리오.pdf', type: '포트폴리오', size: '8.4MB', date: '7월 9일', selected: false },
  { name: 'TripMate_프로젝트.pdf', type: '포트폴리오', size: '6.2MB', date: '6월 28일', selected: false },
])
const selectedDocs = computed(() => docs.value.filter((doc) => doc.selected))
const removeDoc = (doc) => { doc.selected = false }

// 기존 자료 선택 모달 (임시 선택 → 확인 시 반영)
const showDocModal = ref(false)
const modalSelection = ref(new Set())
const openDocModal = () => {
  modalSelection.value = new Set(selectedDocs.value.map((doc) => doc.name))
  showDocModal.value = true
}
const closeDocModal = () => { showDocModal.value = false }
const toggleModalDoc = (name) => {
  const next = new Set(modalSelection.value)
  next.has(name) ? next.delete(name) : next.add(name)
  modalSelection.value = next
}
const applyDocModal = () => {
  docs.value.forEach((doc) => { doc.selected = modalSelection.value.has(doc.name) })
  showDocModal.value = false
}

const uploadDoc = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.doc,.docx'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    docs.value.unshift({ name: file.name, type: '이력서', size: `${(file.size / 1024 / 1024).toFixed(1)}MB`, date: '방금 전', selected: true, file })
    pendingUploads.value.push(file)
  })
  input.click()
}

const goNext = async () => {
  titleError.value = ''
  submitError.value = ''
  if (!title.value.trim()) {
    titleError.value = '연습 이름을 입력해주세요.'
    return
  }
  interview.setInfo({
    title: title.value.trim(),
    company: company.value,
    field: field.value,
    position: position.value,
    careerLevel: careerLevel.value,
  })
  interview.setResumeDocs(selectedDocs.value.map((doc) => doc.name))
  try {
    await interview.saveSetup(pendingUploads.value)
    pendingUploads.value = []
    router.push('/interview/style')
  } catch (error) {
    submitError.value = error?.message || '면접 설정을 저장하지 못했습니다.'
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
              <h2 class="iv-page-title">면접 정보 설정</h2>

              <div class="form-field iv-loose-field" :class="{ 'field-invalid': titleError }">
                <label for="title">연습 이름</label>
                <input id="title" v-model="title" type="text" placeholder="예) A사 백엔드 개발자 면접" @input="titleError = ''" />
                <small v-if="titleError" class="field-error">{{ titleError }}</small>
              </div>

              <section class="presentation-panel iv-form-panel iv-field-card" aria-label="지원 맥락 설정">
                <div class="form-row-2 iv-form-row">
                  <div class="form-field">
                    <label>회사명</label>
                    <SearchableSelect v-model="company" :options="COMPANIES" placeholder="회사 선택" search-placeholder="회사명 검색" />
                  </div>
                  <div class="form-field">
                    <label>직군</label>
                    <SearchableSelect v-model="field" :options="FIELDS" placeholder="직군 선택" search-placeholder="직군 검색" />
                  </div>
                </div>

                <div class="form-row-2 iv-form-row">
                  <div class="form-field">
                    <label>지원 직무</label>
                    <SearchableSelect v-model="position" :options="POSITIONS" placeholder="직무 선택" search-placeholder="직무 검색" />
                  </div>
                  <div class="form-field">
                    <label for="level">경력 구분</label>
                    <select id="level" v-model="careerLevel">
                      <option value="" disabled>경력 선택</option>
                      <option v-for="level in CAREER_LEVELS" :key="level">{{ level }}</option>
                    </select>
                  </div>
                </div>

                <div class="form-field iv-docs-field">
                  <label>지원 자료</label>
                  <div class="iv-docs-actions">
                    <button type="button" class="iv-doc-choice" @click="openDocModal">기존 자료 선택</button>
                    <button type="button" class="iv-doc-choice" @click="uploadDoc">새 자료 등록</button>
                  </div>
                  <ul v-if="selectedDocs.length" class="iv-docs-chosen">
                    <li v-for="doc in selectedDocs" :key="doc.name">
                      <div><strong>{{ doc.name }}</strong><small>{{ doc.type }} · {{ doc.size }}</small></div>
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
        <ul class="iv-modal-doc-list">
          <li
            v-for="doc in docs"
            :key="doc.name"
            class="iv-modal-doc"
            :class="{ selected: modalSelection.has(doc.name) }"
            @click="toggleModalDoc(doc.name)"
          >
            <div class="iv-modal-doc-meta">
              <strong>{{ doc.name }}</strong>
              <small>{{ doc.type }} · {{ doc.size }} · {{ doc.date }}</small>
            </div>
            <span class="iv-modal-check" aria-hidden="true">{{ modalSelection.has(doc.name) ? '✓' : '' }}</span>
          </li>
        </ul>
        <div class="iv-modal-actions">
          <button type="button" class="iv-ghost-btn" @click="closeDocModal">취소</button>
          <button type="button" class="iv-solid-btn" @click="applyDocModal">확인 ({{ modalSelection.size }})</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
