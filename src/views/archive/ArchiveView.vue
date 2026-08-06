<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { useArchiveStore } from '../../stores/archiveStore.js'

const router = useRouter()
const archive = useArchiveStore()

const tabs = [
  { value: 'all', label: '전체' },
  { value: 'presentation', label: '발표' },
  { value: 'interview', label: '면접' },
]
const activeType = ref('all')
const keyword = ref('')
const selectedId = ref(null)
const deleteTarget = ref(null)
const deleteError = ref('')
const isDeletingFolder = ref(false)
const selected = computed(() => archive.folderById(selectedId.value))
const hasSelection = computed(() => Boolean(selected.value))
const paperCount = computed(() => (selected.value ? Math.min(selected.value.count, 3) : 1))

const currentPage = ref(0)
const totalPages = computed(() => Math.max(1, Number(archive.pagination.totalPage) || 0))
const pagedFolders = computed(() => archive.folders)

const typeLabel = (type) => (type === 'interview' ? '면접' : '발표')
const folderLocation = (folder) => `/archive/folders/${encodeURIComponent(folder.id)}?type=${encodeURIComponent(folder.type)}`

const fetchFolders = async (page = currentPage.value) => {
  try {
    const folders = await archive.loadFolders({
      type: activeType.value === 'all' ? undefined : activeType.value,
      keyword: keyword.value.trim() || undefined,
      page,
    })
    currentPage.value = archive.pagination.currentPage
    if (!keyword.value.trim() && !folders.some((folder) => folder.id === selectedId.value)) {
      selectedId.value = folders[0]?.id ?? null
    }
  } catch {
    selectedId.value = null
  }
}
// v-model(vModelText)은 한글 조합이 끝날 때까지 값을 갱신하지 않아서, 'ㅇ→여→연'을
// 치는 동안 검색이 멈춘 것처럼 보인다. 조합 중 input 이벤트까지 그대로 반영한다.
const onKeywordInput = (event) => {
  keyword.value = event.target.value
}

const goPage = async (page) => {
  const nextPage = Math.min(totalPages.value - 1, Math.max(0, page))
  if (nextPage === currentPage.value) return
  currentPage.value = nextPage
  await fetchFolders(nextPage)
}
const selectFolder = (id) => { selectedId.value = id }
const openFolder = () => {
  if (selected.value) router.push(folderLocation(selected.value))
}
const requestFolderDelete = () => {
  if (!selected.value || isDeletingFolder.value) return
  deleteError.value = ''
  deleteTarget.value = selected.value
}
const closeFolderDelete = () => {
  if (isDeletingFolder.value) return
  deleteTarget.value = null
  deleteError.value = ''
}
const confirmFolderDelete = async () => {
  if (!deleteTarget.value || isDeletingFolder.value) return

  const folderId = deleteTarget.value.id
  isDeletingFolder.value = true
  deleteError.value = ''

  try {
    await archive.removeFolder(folderId)
    if (String(selectedId.value) === String(folderId)) {
      selectedId.value = archive.folders[0]?.id ?? null
    }
    deleteTarget.value = null
  } catch (error) {
    deleteError.value = error?.message || '폴더를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.'
  } finally {
    isDeletingFolder.value = false
  }
}

// 글자를 칠 때마다 바로 조회한다(디바운스 없음). 응답 순서가 뒤바뀌어도
// archiveStore의 requestSequence가 오래된 응답을 버리므로 목록이 튀지 않는다.
watch([activeType, keyword], () => {
  if (keyword.value.trim()) selectedId.value = null
  currentPage.value = 0
  fetchFolders(0)
})
watch(() => archive.folders, (folders) => {
  if (selectedId.value && !folders.some((folder) => folder.id === selectedId.value)) {
    selectedId.value = keyword.value.trim() ? null : (folders[0]?.id ?? null)
  }
})
onMounted(fetchFolders)
</script>

<template>
  <main class="archive-shell">
    <header class="faq-head">
      <h1>내 기록</h1>
      <p>서버에 저장된 발표 및 면접 연습 폴더를 확인할 수 있어요.</p>
    </header>

    <div class="archive-toolbar">
      <div class="archive-tabs" role="tablist" aria-label="연습 유형 필터">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="faq-tab-btn"
          :class="{ active: activeType === tab.value }"
          role="tab"
          :aria-selected="activeType === tab.value"
          @click="activeType = tab.value"
        ><span class="archive-tab-label">{{ tab.label }}</span></button>
      </div>
    </div>

    <div class="archive-searchbar">
      <label class="archive-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4 4"/></svg>
        <!-- type="search"는 브라우저가 자체 지우기(×)를 하나 더 그려서 ×가 두 개로
             보였다 → type="text" + 우리 버튼 하나만 쓴다. -->
        <input :value="keyword" type="text" inputmode="search" :maxlength="INPUT_LIMITS.SEARCH" placeholder="연습 이름 검색" aria-label="연습 이름 검색" @input="onKeywordInput" />
        <button v-if="keyword" type="button" aria-label="검색어 지우기" @click="keyword = ''">×</button>
      </label>
    </div>

    <div class="archive-master" :class="{ 'has-selection': hasSelection }">
      <div class="archive-list">
        <button
          v-for="folder in pagedFolders"
          :key="folder.id"
          :data-folder-id="folder.id"
          type="button"
          class="archive-row"
          :class="{ selected: folder.id === selectedId }"
          @click="selectFolder(folder.id)"
        >
          <span class="archive-row-meta">
            <em class="archive-type-tag" :class="`is-${folder.type}`">{{ typeLabel(folder.type) }}</em>
            <span>{{ folder.count }}회 연습</span>
          </span>
          <strong class="archive-row-title" :title="folder.name">{{ folder.name }}</strong>
          <b>{{ folder.latestScore == null ? '점수 데이터 없음' : `${folder.latestScore}점` }}</b>
        </button>
        <p v-if="archive.loading" class="archive-list-state" aria-live="polite">기록을 불러오는 중입니다.</p>
        <p v-else-if="archive.error" class="archive-list-state is-error" role="alert">{{ archive.error }}</p>
        <p v-else-if="!archive.folders.length" class="archive-list-state">검색 조건에 맞는 연습 폴더가 없어요.</p>
      </div>

      <nav v-if="!archive.loading && !archive.error && totalPages > 1" class="archive-pagination" aria-label="기록 페이지 이동">
        <button type="button" class="archive-page-arrow" :disabled="currentPage === 0" aria-label="이전 페이지" @click="goPage(currentPage - 1)">‹</button>
        <button
          v-for="page in totalPages"
          :key="page"
          type="button"
          class="archive-page-num"
          :class="{ 'is-active': page - 1 === currentPage }"
          :aria-current="page - 1 === currentPage ? 'page' : undefined"
          @click="goPage(page - 1)"
        >{{ page }}</button>
        <button type="button" class="archive-page-arrow" :disabled="currentPage >= totalPages - 1 || !archive.pagination.hasNext" aria-label="다음 페이지" @click="goPage(currentPage + 1)">›</button>
      </nav>

      <aside
        v-if="selected"
        :key="selected.id"
        class="archive-detail"
        :class="`paper-count-${paperCount}`"
        tabindex="0"
        role="link"
        aria-label="선택한 폴더 상세보기"
        @click="openFolder"
        @keydown.enter.prevent="openFolder"
        @keydown.space.prevent="openFolder"
      >
        <div class="archive-detail-back" aria-hidden="true"></div>
        <div class="archive-detail-paper archive-detail-paper-tertiary" aria-hidden="true"></div>
        <div class="archive-detail-paper archive-detail-paper-secondary" aria-hidden="true"></div>
        <div class="archive-detail-paper archive-detail-paper-primary" aria-hidden="true"></div>
        <div class="archive-detail-card">
          <button
            type="button"
            class="archive-detail-close"
            data-testid="archive-folder-delete-trigger"
            aria-label="선택한 폴더 삭제"
            :disabled="isDeletingFolder"
            @click.stop="requestFolderDelete"
          >×</button>
          <span class="archive-detail-type">{{ typeLabel(selected.type) }} 연습</span>
          <strong class="archive-detail-title" :title="selected.name">{{ selected.name }}</strong>

          <div class="archive-detail-stats">
            <div><small>총 시도</small><strong>{{ selected.count }}회</strong></div>
            <div><small>최고 점수</small><strong>{{ selected.best == null ? '데이터 없음' : `${selected.best}점` }}</strong></div>
            <div><small>최근 점수</small><strong>{{ selected.latestScore == null ? '데이터 없음' : `${selected.latestScore}점` }}</strong></div>
          </div>

          <p class="archive-detail-meta is-breakable">{{ selected.description || '서버에 저장된 연습 폴더입니다.' }}</p>

          <a
            :href="folderLocation(selected)"
            class="archive-detail-link"
            aria-label="폴더 상세보기"
            @click.stop.prevent="openFolder"
          >
            <span>상세보기</span>
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
          </a>
        </div>
      </aside>
    </div>

    <div
      v-if="deleteTarget"
      class="folder-delete-backdrop"
      role="presentation"
      @click.self="closeFolderDelete"
    >
      <section
        class="folder-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-folder-delete-title"
        data-testid="archive-folder-delete-dialog"
        @click.stop
      >
        <h2 id="archive-folder-delete-title">폴더를 삭제하시겠습니까?</h2>
        <p>관련 리포트도 모두 삭제됩니다.</p>
        <strong class="folder-delete-name" :title="deleteTarget.name">{{ deleteTarget.name }}</strong>
        <p v-if="deleteError" class="folder-delete-error" role="alert">{{ deleteError }}</p>
        <div class="folder-delete-actions">
          <button
            type="button"
            class="folder-delete-cancel"
            :disabled="isDeletingFolder"
            @click="closeFolderDelete"
          >취소</button>
          <button
            type="button"
            class="folder-delete-confirm"
            data-testid="confirm-archive-folder-delete"
            :disabled="isDeletingFolder"
            @click="confirmFolderDelete"
          >{{ isDeletingFolder ? '삭제 중...' : '삭제' }}</button>
        </div>
      </section>
    </div>
  </main>
</template>
