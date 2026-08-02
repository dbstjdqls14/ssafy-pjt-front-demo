<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useDebouncedCallback } from '../../composables/useDebouncedCallback.js'
import { useArchiveStore } from '../../stores/archiveStore.js'

const router = useRouter()
const archive = useArchiveStore()

const tabs = [
  { value: '', label: '전체' },
  { value: 'presentation', label: '발표' },
  { value: 'interview', label: '면접' },
]

const activeType = ref('')
const keyword = ref('')
// 서버 페이지는 0부터 시작. 화면 표기는 1부터.
const currentPage = ref(0)

const folders = computed(() => archive.folderPage.folders)
const totalPages = computed(() => Math.max(1, archive.folderPage.totalPage))

const selectedId = ref(null)
const selected = computed(() => folders.value.find((folder) => folder.folderId === selectedId.value) ?? null)
const hasSelection = computed(() => Boolean(selected.value))
const paperCount = computed(() => (selected.value ? Math.min(selected.value.attemptCount, 3) : 1))

const typeLabel = (type) => (type === 'presentation' ? '발표' : '면접')

const selectFolder = (folderId) => {
  selectedId.value = folderId
}
const closeDetail = () => {
  selectedId.value = null
}
const openFolder = () => {
  if (!selected.value) return
  router.push(`/archive/folders/${selected.value.folderId}?type=${selected.value.type}`)
}

const fetchFolders = () => archive.loadFolders({
  type: activeType.value,
  keyword: keyword.value.trim(),
  page: currentPage.value,
})

const { schedule: scheduleFetchFolders } = useDebouncedCallback(fetchFolders, 250)

const goPage = (page) => {
  currentPage.value = Math.min(totalPages.value - 1, Math.max(0, page))
  fetchFolders()
}

watch([activeType, keyword], () => {
  // 검색어를 입력하는 순간 폴더 카드를 닫아 푸터를 가리지 않게 한다. 결과는 목록에서만 필터링.
  if (keyword.value.trim()) selectedId.value = null
  currentPage.value = 0
  scheduleFetchFolders()
})
watch(folders, (list) => {
  if (selectedId.value && !list.some((folder) => folder.folderId === selectedId.value)) {
    // 검색 중에는 자동으로 첫 폴더를 열지 않는다(닫힌 상태 유지).
    selectedId.value = keyword.value.trim() ? null : (list[0]?.folderId ?? null)
  }
})
onMounted(fetchFolders)
</script>

<template>
  <main class="archive-shell">
    <header class="faq-head">
      <h1>내 기록</h1>
      <p>지금까지 진행한 발표 및 면접 연습 폴더를 모아봤어요. 폴더를 선택하면 요약 정보를 볼 수 있어요.</p>
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
        <input v-model="keyword" type="search" placeholder="연습 이름 검색" aria-label="연습 이름 검색" />
        <button v-if="keyword" type="button" aria-label="검색어 지우기" @click="keyword = ''">×</button>
      </label>
    </div>

    <div class="archive-master" :class="{ 'has-selection': hasSelection }">
      <div class="archive-list has-desc">
        <button
          v-for="folder in folders"
          :key="folder.folderId"
          type="button"
          class="archive-row"
          :class="{ selected: folder.folderId === selectedId }"
          @click="selectFolder(folder.folderId)"
        >
          <span class="archive-row-meta">
            <em class="archive-type-tag" :class="`is-${folder.type}`">{{ typeLabel(folder.type) }}</em>
            <time>{{ folder.recentPracticeDateLabel }}</time>
          </span>
          <span class="archive-row-title-wrap">
            <strong>{{ folder.name }}</strong>
            <small v-if="folder.description" class="archive-row-desc">{{ folder.description }}</small>
          </span>
          <b>{{ folder.maxScore }}점</b>
        </button>
        <p v-if="archive.foldersLoading" class="archive-list-state" aria-live="polite">기록을 불러오는 중입니다.</p>
        <p v-else-if="archive.foldersError" class="archive-list-state is-error" role="alert">{{ archive.foldersError }}</p>
        <p v-else-if="!folders.length" class="archive-list-state">검색 조건에 맞는 연습 기록이 없어요.</p>
      </div>

      <nav v-if="!archive.foldersLoading && !archive.foldersError && totalPages > 1" class="archive-pagination" aria-label="기록 페이지 이동">
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
        <button type="button" class="archive-page-arrow" :disabled="currentPage >= totalPages - 1" aria-label="다음 페이지" @click="goPage(currentPage + 1)">›</button>
      </nav>

      <aside
        v-if="selected"
        :key="selected.folderId"
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
          <button type="button" class="archive-detail-close" aria-label="닫기" @click.stop="closeDetail">×</button>
          <span class="archive-detail-type">{{ typeLabel(selected.type) }} 연습</span>
          <strong class="archive-detail-title">{{ selected.name }}</strong>

          <div class="archive-detail-stats">
            <div><small>총 시도</small><strong>{{ selected.attemptCount }}회</strong></div>
            <div><small>최고 점수</small><strong>{{ selected.maxScore }}점</strong></div>
            <div><small>최근 점수</small><strong>{{ selected.recentScore }}점</strong></div>
          </div>

          <p class="archive-detail-meta">최근 연습 · {{ selected.recentPracticeDateLabel }}</p>

          <a
            :href="`/archive/folders/${selected.folderId}?type=${selected.type}`"
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
  </main>
</template>

<style scoped>
.archive-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.archive-row-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.archive-row-desc {
  overflow: hidden;
  color: #8b93a7;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archive-list.has-desc :deep(.archive-row) {
  min-height: calc(var(--archive-row-height, 74px) + 14px);
}
.archive-detail-desc {
  margin: 4px 0 0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  opacity: .88;
}
</style>
