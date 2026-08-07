<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDocumentsStore } from '../../stores/documentsStore.js'

const router = useRouter()
const store = useDocumentsStore()

const filters = [
  { value: 'all', label: '전체' },
  { value: 'resume', label: '자소서' },
  { value: 'portfolio', label: '포트폴리오' },
]

const activeFilter = ref('all')
const deleteTarget = ref(null)
const visibleDocs = computed(() =>
  activeFilter.value === 'all'
    ? store.documents
    : store.documents.filter((doc) => doc.type === activeFilter.value),
)

onMounted(() => store.loadDocuments())

const upload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.doc,.docx'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    await store.uploadDocument(file)
  })
  input.click()
}

const openDocument = (doc) => router.push({ name: 'mypage-document-detail', params: { id: doc.id } })
const requestDelete = (doc) => { deleteTarget.value = doc }
const cancelDelete = () => { deleteTarget.value = null }
const confirmDelete = async () => {
  if (!deleteTarget.value) return
  await store.removeDocument(deleteTarget.value.id)
  deleteTarget.value = null
}
</script>

<template>
  <section class="mypage-panel">
    <header class="mypage-content-head mypage-documents-head">
      <div>
        <h2>자소서 및 포트폴리오</h2>
        <p>지원 자료를 등록하고 한곳에서 관리하세요.</p>
      </div>
      <button type="button" class="btn-primary mypage-primary-action" :disabled="store.loading" @click="upload">새 자료 등록</button>
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

    <p v-if="store.error" class="doc-state-message is-error" role="alert">{{ store.error }}</p>
    <p v-else-if="store.loading && !store.documents.length" class="doc-state-message">지원 자료를 불러오는 중입니다.</p>

    <div v-else-if="visibleDocs.length" class="doc-grid">
      <article v-for="doc in visibleDocs" :key="doc.id" class="doc-card">
        <span class="doc-tag" :class="{ portfolio: doc.type === 'portfolio' }">{{ doc.type === 'portfolio' ? '포트폴리오' : '자소서' }}</span>
        <strong>{{ doc.name }}</strong>
        <small>{{ doc.date }} · {{ doc.size }}</small>
        <div class="doc-footer">
          <button type="button" class="doc-delete-button" aria-label="지원 자료 삭제" @click="requestDelete(doc)">삭제</button>
          <button type="button" @click="openDocument(doc)">보기</button>
        </div>
      </article>
    </div>

    <div v-else class="doc-empty-state">
      <span aria-hidden="true">＋</span>
      <strong>{{ activeFilter === 'all' ? '등록된 지원 자료가 없어요.' : '이 유형의 지원 자료가 없어요.' }}</strong>
      <p>자소서나 포트폴리오를 등록하면 면접 연습에서 바로 선택할 수 있어요.</p>
      <button type="button" class="btn-primary" @click="upload">첫 자료 등록</button>
    </div>
  </section>

  <Teleport to="body">
    <div v-if="deleteTarget" class="doc-modal-backdrop" @click.self="cancelDelete">
      <section class="doc-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="deleteDocumentTitle">
        <span class="doc-confirm-icon" aria-hidden="true">!</span>
        <h3 id="deleteDocumentTitle">지원 자료를 삭제할까요?</h3>
        <p><strong>{{ deleteTarget.name }}</strong><br />삭제한 자료는 복구할 수 없습니다.</p>
        <div class="doc-confirm-actions">
          <button type="button" class="btn-secondary" @click="cancelDelete">취소</button>
          <button type="button" class="doc-danger-button" :disabled="store.loading" @click="confirmDelete">삭제</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
