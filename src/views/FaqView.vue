<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { INPUT_LIMITS } from '../constants/inputLimits.js'

const CATEGORY_LABEL = {
  notice: '공지사항',
  presentation: '발표 연습',
  interview: '면접 연습',
  ai: 'AI 분석',
  account: '계정 및 결제',
}
const tabs = [
  { value: 'all', label: '전체' },
  { value: 'notice', label: '공지사항' },
  { value: 'presentation', label: '발표 연습' },
  { value: 'interview', label: '면접 연습' },
  { value: 'ai', label: 'AI 분석' },
  { value: 'account', label: '계정 및 결제' },
]

const faqs = [
  { cat: 'notice', q: '정기 점검은 언제 진행되나요?', a: '안정적인 서비스 운영을 위해 매월 둘째 주 수요일 새벽 2시부터 4시까지 정기 점검을 진행해요.' },
  { cat: 'notice', q: '발표 자료 지원 형식이 확대됐어요.', a: '발표 연습에서 PPTX와 PDF 파일을 지원하며, 파일당 최대 50MB까지 업로드할 수 있어요.' },
  { cat: 'presentation', q: 'PPT는 어떤 형식까지 지원하나요?', a: 'PPTX와 PDF 파일을 지원하며 최대 50MB까지 업로드할 수 있어요.' },
  { cat: 'presentation', q: '카메라 없이도 연습할 수 있나요?', a: '네, 카메라를 꺼두면 음성만으로 말하기 속도와 표현을 분석해드려요.' },
  { cat: 'presentation', q: '목표 발표 시간은 나중에 바꿀 수 있나요?', a: '설정 단계에서 언제든 1분 단위로 목표 시간을 조정할 수 있어요.' },
  { cat: 'presentation', q: '슬라이드별 핵심 내용은 꼭 입력해야 하나요?', a: '선택 사항이에요. 입력하면 슬라이드별 전달 여부를 더 정확히 분석해드려요.' },
  { cat: 'presentation', q: '발표를 다시 녹화하고 싶어요.', a: '리포트 화면에서 "다시 연습하기"를 누르면 같은 설정으로 바로 재녹화할 수 있어요.' },
  { cat: 'interview', q: '면접 질문은 어떻게 만들어지나요?', a: '입력하신 직무 및 경력 정보와 업로드한 이력서를 바탕으로 맞춤 질문을 생성해요.' },
  { cat: 'interview', q: '면접관 스타일은 나중에 바꿀 수 있나요?', a: '네, 새 연습을 시작할 때마다 우호형 및 실무형 및 압박형 중 다시 선택할 수 있어요.' },
  { cat: 'interview', q: '이력서를 꼭 등록해야 하나요?', a: '등록하지 않아도 연습할 수 있지만, 등록하면 훨씬 구체적인 질문을 받을 수 있어요.' },
  { cat: 'interview', q: '답변을 질문별로 다시 녹화할 수 있나요?', a: '네, 녹화 화면에서 "답변 다시 녹화"를 누르면 해당 질문만 다시 녹화돼요.' },
  { cat: 'interview', q: '질문 개수는 조정할 수 있나요?', a: '질문 생성 단계에서 "AI 다시 생성"을 눌러 질문 구성을 새로 받을 수 있어요.' },
  { cat: 'ai', q: 'AI 분석은 얼마나 걸리나요?', a: '연습 길이에 따라 다르지만 보통 10~30초 내에 리포트가 생성돼요.' },
  { cat: 'ai', q: '분석 결과의 점수는 어떻게 계산되나요?', a: '말하기 속도, 발음 명료도, 시선 처리, 답변 구조 등을 종합해 100점 만점으로 산출해요.' },
  { cat: 'ai', q: '인터넷 연결 없이도 분석이 가능한가요?', a: '아니요, AI 분석에는 서버 연결이 필요해서 인터넷 연결이 필요해요.' },
  { cat: 'ai', q: '분석 정확도는 어느 정도인가요?', a: '실제 발화와 표정을 기반으로 분석하며, 지속적으로 정확도를 개선하고 있어요.' },
  { cat: 'ai', q: '영어로도 분석이 가능한가요?', a: '현재는 한국어만 지원하며, 다국어 지원은 준비 중이에요.' },
  { cat: 'account', q: '요금제는 어떻게 되나요?', a: '현재 데모 버전에서는 모든 기능을 무료로 체험하실 수 있어요.' },
  { cat: 'account', q: '연습 기록을 삭제할 수 있나요?', a: '내 연습 기록 페이지에서 원하는 세션을 선택해 삭제할 수 있어요.' },
  { cat: 'account', q: '비밀번호는 어떻게 변경하나요?', a: '마이페이지 > 내 정보에서 "비밀번호 변경" 버튼을 눌러 변경할 수 있어요.' },
  { cat: 'account', q: '소셜 로그인 연동을 해제할 수 있나요?', a: '마이페이지 > 내 정보 수정에서 연동된 계정을 해제할 수 있어요.' },
  { cat: 'account', q: '연습 데이터는 얼마나 보관되나요?', a: '별도로 삭제하지 않는 한 계정이 유지되는 동안 계속 보관돼요.' },
]

const PAGE_SIZE = 15
const activeCat = ref('all')
const search = ref('')
const currentPage = ref(1)
const openKeys = ref(new Set())

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return faqs.filter((item) => {
    const matchesCat = activeCat.value === 'all' || item.cat === activeCat.value
    const matchesKeyword = !keyword || item.q.toLowerCase().includes(keyword) || item.a.toLowerCase().includes(keyword)
    return matchesCat && matchesKeyword
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageItems = computed(() => {
  const page = Math.min(currentPage.value, totalPages.value)
  const start = (page - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})
const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1))

const keyOf = (item) => `${item.cat}:${item.q}`
const toggleItem = (item) => {
  const key = keyOf(item)
  const next = new Set(openKeys.value)
  next.has(key) ? next.delete(key) : next.add(key)
  openKeys.value = next
}
const selectCat = (value) => {
  activeCat.value = value
  currentPage.value = 1
}
// v-model(vModelText)은 한글 조합이 끝날 때까지 값을 갱신하지 않아서, 'ㅇ→여→연'을
// 치는 동안 검색이 멈춘 것처럼 보인다. 조합 중 input 이벤트까지 그대로 반영해
// 키를 누르는 즉시 목록이 걸러지게 한다.
const onSearch = (event) => {
  if (event) search.value = event.target.value
  currentPage.value = 1
}
const isSearching = computed(() => search.value.trim().length > 0)
const clearSearch = () => {
  search.value = ''
  onSearch()
}

// 검색어와 일치하는 구간을 <mark>로 감싸기 위해 텍스트를 조각으로 나눈다.
// v-html 없이 대소문자 무시 하이라이트를 렌더한다.
const highlightParts = (text) => {
  const keyword = search.value.trim()
  if (!keyword) return [{ text, hit: false }]
  const source = String(text)
  const lower = source.toLowerCase()
  const needle = keyword.toLowerCase()
  const parts = []
  let cursor = 0
  while (cursor < source.length) {
    const idx = lower.indexOf(needle, cursor)
    if (idx === -1) {
      parts.push({ text: source.slice(cursor), hit: false })
      break
    }
    if (idx > cursor) parts.push({ text: source.slice(cursor, idx), hit: false })
    parts.push({ text: source.slice(idx, idx + keyword.length), hit: true })
    cursor = idx + keyword.length
  }
  return parts
}
const goPage = (page) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const showTop = ref(false)
const onScroll = () => {
  showTop.value = window.scrollY > 480
}
const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <main class="faq-shell">
    <header class="faq-head">
      <h1>FAQ</h1>
      <p>AIVO 사용 중 자주 묻는 질문을 확인하세요.</p>
    </header>

    <div class="faq-toolbar">
      <div class="faq-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="faq-tab-btn"
          :class="{ active: activeCat === tab.value }"
          @click="selectCat(tab.value)"
        >{{ tab.label }}</button>
      </div>

      <div class="faq-search-box">
        <input :value="search" type="text" :maxlength="INPUT_LIMITS.SEARCH" placeholder="질문이나 키워드를 검색해보세요" @input="onSearch" />
        <svg v-show="!isSearching" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.6" />
          <line x1="13.6" y1="13.6" x2="18" y2="18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <button
          v-if="isSearching"
          type="button"
          class="faq-search-clear"
          aria-label="검색어 지우기"
          @click="clearSearch"
        >×</button>
      </div>
    </div>

    <section class="faq-panel">
      <p v-if="isSearching && filtered.length" class="faq-result-count">
        ‘{{ search.trim() }}’ 검색 결과 <strong>{{ filtered.length }}</strong>개
      </p>

      <div class="faq-list">
        <div
          v-for="item in pageItems"
          :key="keyOf(item)"
          class="faq-item"
          :class="{ open: openKeys.has(keyOf(item)) }"
          @click="toggleItem(item)"
        >
          <div class="faq-item-q">
            <span><template v-for="(part, i) in highlightParts(item.q)" :key="i"><mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
            <span class="faq-item-cat">{{ CATEGORY_LABEL[item.cat] }}</span>
            <i>⌄</i>
          </div>
          <div class="faq-item-a"><template v-for="(part, i) in highlightParts(item.a)" :key="i"><mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></div>
        </div>
      </div>
      <p class="faq-no-result" :class="{ show: !filtered.length }">검색 결과가 없어요. 다른 키워드로 검색해보세요.</p>

      <div v-if="totalPages > 1" class="faq-pagination">
        <button type="button" class="faq-page-arrow" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">‹</button>
        <template v-for="(page, i) in pageNumbers" :key="page">
          <span v-if="i > 0" class="faq-page-sep">|</span>
          <button type="button" class="faq-page-num" :class="{ active: page === currentPage }" @click="goPage(page)">{{ page }}</button>
        </template>
        <button type="button" class="faq-page-arrow" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">›</button>
      </div>
    </section>
  </main>

  <button type="button" class="faq-top-btn" :class="{ show: showTop }" aria-label="맨 위로" @click="scrollTop">
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 15V5M10 5L5 10M10 5l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<style scoped>
.faq-search-clear {
  position: absolute;
  right: 0;
  top: 1px;
  width: 20px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--aivo-muted, #94a3b8);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s ease;
}

.faq-search-clear:hover {
  color: var(--aivo-navy, #1f2440);
}

.faq-result-count {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
}

.faq-result-count strong {
  color: var(--type-page-blue, #2f6bff);
  font-weight: 800;
}

.faq-item-q mark,
.faq-item-a mark {
  background: #fff2b8;
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
  font-weight: 700;
}
</style>
