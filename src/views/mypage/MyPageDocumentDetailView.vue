<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDocumentsStore } from '../../stores/documentsStore.js'

const route = useRoute()
const router = useRouter()
const store = useDocumentsStore()
const documentItem = ref(store.find(route.params.id))
const deleteOpen = ref(false)

const typeLabel = computed(() => documentItem.value?.type === 'portfolio' ? '포트폴리오' : '자소서')
const canPreview = computed(() => Boolean(documentItem.value?.previewUrl))

onMounted(async () => {
  documentItem.value = await store.loadDocument(route.params.id)
})

const remove = async () => {
  if (!documentItem.value) return
  await store.removeDocument(documentItem.value.id)
  await router.replace({ name: 'mypage-documents' })
}
</script>

<template>
  <section class="mypage-panel document-detail-panel">
    <RouterLink :to="{ name: 'mypage-documents' }" class="document-detail-back">← 지원 자료 목록</RouterLink>

    <div v-if="documentItem" class="document-detail-card">
      <header>
        <span class="doc-tag" :class="{ portfolio: documentItem.type === 'portfolio' }">{{ typeLabel }}</span>
        <h2>{{ documentItem.name }}</h2>
        <p>{{ documentItem.date }} · {{ documentItem.size }}</p>
      </header>

      <div class="document-preview" :class="{ 'has-preview': canPreview }">
        <iframe v-if="canPreview && documentItem.mimeType === 'application/pdf'" :src="documentItem.previewUrl" :title="`${documentItem.name} 미리보기`"></iframe>
        <div v-else>
          <span aria-hidden="true">PDF</span>
          <strong>등록된 지원 자료</strong>
          <p>서버에서 미리보기 주소를 제공하면 이 영역에서 문서를 바로 확인할 수 있어요.</p>
        </div>
      </div>

      <footer>
        <button type="button" class="doc-danger-outline" @click="deleteOpen = true">자료 삭제</button>
        <a v-if="documentItem.downloadUrl || documentItem.previewUrl" class="btn-primary" :href="documentItem.downloadUrl || documentItem.previewUrl" target="_blank" rel="noopener">새 창에서 열기</a>
      </footer>
    </div>

    <div v-else class="doc-empty-state">
      <strong>지원 자료를 찾을 수 없어요.</strong>
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
          <button type="button" class="doc-danger-button" :disabled="store.loading" @click="remove">삭제</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
