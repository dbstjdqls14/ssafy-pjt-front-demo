<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useDebouncedCallback } from '../../composables/useDebouncedCallback.js'
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
const visibleFolders = computed(() => archive.folders)

// 페이지네이션: 한 페이지에 5개씩. 스크롤 대신 아래 < 1 2 > 컨트롤로 이동한다.
const PAGE_SIZE = 5
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(visibleFolders.value.length / PAGE_SIZE)))
const pagedFolders = computed(() =>
  visibleFolders.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE),
)
const goPage = (page) => {
  currentPage.value = Math.min(totalPages.value, Math.max(1, page))
}

const selectedTitle = ref(archive.folders[0]?.title ?? null)
const selected = computed(() => archive.folderByTitle(selectedTitle.value))
const hasSelection = computed(() => Boolean(selected.value))
const paperCount = computed(() => (selected.value ? Math.min(selected.value.count, 3) : 1))

const typeLabel = (type) => (type === 'presentation' ? '발표' : '면접')

const selectFolder = (title) => {
  selectedTitle.value = title
}
const closeDetail = () => {
  selectedTitle.value = null
}
const openFolder = () => {
  if (!selected.value) return
  router.push(`/archive/folders?title=${encodeURIComponent(selected.value.title)}`)
}

const fetchRecords = () => archive.loadRecords({
  type: activeType.value === 'all' ? '' : activeType.value,
  keyword: keyword.value.trim(),
})
const { schedule: scheduleFetchRecords } = useDebouncedCallback(fetchRecords, 250)

watch([activeType, keyword], () => {
  // 검색어를 입력하는 순간 폴더 카드를 닫아 푸터를 가리지 않게 한다. 결과는 목록에서만 필터링.
  if (keyword.value.trim()) selectedTitle.value = null
  currentPage.value = 1
  scheduleFetchRecords()
})
watch(visibleFolders, (folders) => {
  // 목록이 바뀌면 현재 페이지 범위를 다시 맞춘다.
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
  if (selectedTitle.value && !folders.some((folder) => folder.title === selectedTitle.value)) {
    // 검색 중에는 자동으로 첫 폴더를 열지 않는다(닫힌 상태 유지).
    selectedTitle.value = keyword.value.trim() ? null : (folders[0]?.title ?? null)
  }
})
onMounted(fetchRecords)
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
      <div class="archive-list">
        <button
          v-for="folder in pagedFolders"
          :key="folder.title"
          type="button"
          class="archive-row"
          :class="{ selected: folder.title === selectedTitle }"
          @click="selectFolder(folder.title)"
        >
          <span class="archive-row-meta">
            <em class="archive-type-tag" :class="`is-${folder.type}`">{{ typeLabel(folder.type) }}</em>
            <time>{{ folder.latest.date }}</time>
          </span>
          <strong>{{ folder.title }}</strong>
          <b>{{ folder.best }}점</b>
        </button>
        <p v-if="archive.loading" class="archive-list-state" aria-live="polite">기록을 불러오는 중입니다.</p>
        <p v-else-if="archive.error" class="archive-list-state is-error" role="alert">{{ archive.error }}</p>
        <p v-else-if="!visibleFolders.length" class="archive-list-state">검색 조건에 맞는 연습 기록이 없어요.</p>
      </div>

      <nav v-if="!archive.loading && !archive.error && totalPages > 1" class="archive-pagination" aria-label="기록 페이지 이동">
        <button type="button" class="archive-page-arrow" :disabled="currentPage === 1" aria-label="이전 페이지" @click="goPage(currentPage - 1)">‹</button>
        <button
          v-for="page in totalPages"
          :key="page"
          type="button"
          class="archive-page-num"
          :class="{ 'is-active': page === currentPage }"
          :aria-current="page === currentPage ? 'page' : undefined"
          @click="goPage(page)"
        >{{ page }}</button>
        <button type="button" class="archive-page-arrow" :disabled="currentPage === totalPages" aria-label="다음 페이지" @click="goPage(currentPage + 1)">›</button>
      </nav>

      <aside
        v-if="selected"
        :key="selected.title"
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
          <strong class="archive-detail-title">{{ selected.title }}</strong>

          <div class="archive-detail-stats">
            <div><small>총 시도</small><strong>{{ selected.count }}회</strong></div>
            <div><small>최고 점수</small><strong>{{ selected.best }}점</strong></div>
            <div><small>최근 점수</small><strong>{{ selected.latest.score }}점</strong></div>
          </div>

          <p class="archive-detail-meta">최근 연습 · {{ selected.latest.date }} {{ selected.latest.time }}</p>

          <a
            :href="`/archive/folders?title=${encodeURIComponent(selected.title)}`"
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
