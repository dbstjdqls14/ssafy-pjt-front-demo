<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDocumentsStore } from '../../stores/documentsStore.js'

const route = useRoute()
const router = useRouter()
const store = useDocumentsStore()
const documentItem = ref(store.find(route.params.id))
const loading = ref(true)
const loadError = ref('')
const deleteOpen = ref(false)

const typeLabel = computed(() => documentItem.value?.type === 'portfolio' ? '포트폴리오' : '자소서')
const contentLabel = computed(() => documentItem.value?.type === 'portfolio' ? '포트폴리오 요약' : '자소서 추출 내용')
const extractedContent = computed(() => {
  if (!documentItem.value) return ''
  return documentItem.value.type === 'portfolio'
    ? documentItem.value.summary
    : documentItem.value.content
})

onMounted(async () => {
  try {
    documentItem.value = await store.loadDocument(route.params.id)
  } catch {
    loadError.value = '지원 자료를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

const remove = async () => {
  if (!documentItem.value) return
  try {
    await store.removeDocument(documentItem.value.id)
    await router.replace({ name: 'mypage-documents' })
  } catch {
    deleteOpen.value = false
  }
}
</script>

<template>
  <section class="mypage-panel document-detail-panel">
    <RouterLink :to="{ name: 'mypage-documents' }" class="document-detail-back">← 지원 자료 목록</RouterLink>

    <p v-if="loading" class="doc-state-message">지원 자료를 불러오는 중입니다.</p>

    <div v-else-if="loadError" class="doc-state-message is-error" role="alert">
      <strong>{{ loadError }}</strong>
      <RouterLink :to="{ name: 'mypage-documents' }" class="btn-secondary">목록으로 돌아가기</RouterLink>
    </div>

    <div v-else-if="documentItem" class="document-detail-card">
      <header>
        <span class="doc-tag" :class="{ portfolio: documentItem.type === 'portfolio' }">{{ typeLabel }}</span>
        <h2 :title="documentItem.name">{{ documentItem.name }}</h2>
        <p>{{ documentItem.date }}</p>
      </header>

      <section class="document-content" data-testid="document-extracted-content">
        <span>{{ contentLabel }}</span>
        <h3>{{ contentLabel }}</h3>
        <p v-if="extractedContent" class="is-breakable">{{ extractedContent }}</p>
        <p v-else class="document-content-empty">서버에 저장된 분석 내용이 아직 없습니다.</p>
      </section>

      <footer>
        <button type="button" class="doc-danger-outline" data-testid="open-detail-delete" @click="deleteOpen = true">자료 삭제</button>
      </footer>
    </div>

    <div v-else class="doc-empty-state" data-testid="document-not-found">
      <strong>지원 자료를 찾을 수 없어요.</strong>
      <p>삭제되었거나 접근할 수 없는 자료입니다.</p>
      <RouterLink :to="{ name: 'mypage-documents' }" class="btn-primary">목록으로 돌아가기</RouterLink>
    </div>
  </section>

  <Teleport to="body">
    <div v-if="deleteOpen" class="doc-modal-backdrop" @click.self="deleteOpen = false">
      <section class="doc-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="deleteDetailTitle">
        <span class="doc-confirm-icon" aria-hidden="true">!</span>
        <h3 id="deleteDetailTitle">이 자료를 삭제할까요?</h3>
        <p>삭제한 자료는 복구할 수 없습니다.</p>
        <div class="doc-confirm-actions">
          <button type="button" class="btn-secondary" @click="deleteOpen = false">취소</button>
          <button type="button" class="doc-danger-button" data-testid="confirm-detail-delete" :disabled="store.loading" @click="remove">삭제</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
