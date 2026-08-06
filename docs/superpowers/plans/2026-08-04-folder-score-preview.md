# Folder Score Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표와 면접 폴더 선택 화면에 완료된 리포트 기준 최근 점수, 최고 점수와 최근 3회 기록을 표시한다.

**Architecture:** 기존 `practiceStore`가 일반 폴더 목록과 archive 통계를 폴더 ID로 병합하고, 선택 폴더의 공통 연습 목록 API를 별도 상태로 관리한다. `FolderSelectView`는 선택 ID를 감시하여 최신 3회를 조회하며 요청 순번으로 오래된 응답을 폐기한다.

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest, Vue Test Utils, Spring REST API

## Global Constraints

- 백엔드 코드는 수정하지 않는다.
- 발표와 면접은 동일한 공통 화면을 사용하되 현재 경로의 타입만 표시한다.
- 리포트가 생성되어 점수가 존재하는 완료 연습만 횟수와 통계에 포함한다.
- 가짜 점수나 가짜 최근 기록을 만들지 않는다.
- 브라우저 수동 테스트는 수행하지 않는다.

---

### Task 1: 폴더 통계와 최근 기록 Store 계약

**Files:**
- Modify: `frontend-vue-main/tests/stores/stores.test.js`
- Modify: `frontend-vue-main/src/stores/practiceStore.js`

**Interfaces:**
- Consumes: `archiveApi.listFolders({ type, keyword, page })`, `archiveApi.listPractices(folderId, { page: 0, sort: 'latest' })`
- Produces: `folder.best`, `folder.latestScore`, `folder.reportCount`, `recentPractices`, `recentPracticesLoading`, `recentPracticesError`, `loadRecentPractices(folderId)`

- [ ] **Step 1: Write the failing Store tests**

```js
test('merges completed archive score statistics into selectable folders', async () => {
  // general list contains an abandoned session count; archive response contains completed statistics
  // assert reportCount=2, best=91, latestScore=88
})

test('keeps only the latest three completed practices for the current folder request', async () => {
  // resolve a newer folder request before an older request
  // assert stale response cannot replace recentPractices
})
```

- [ ] **Step 2: Run the Store tests and verify RED**

Run: `node node_modules/vitest/vitest.mjs run tests/stores/stores.test.js`

Expected: FAIL because archive score fields are discarded and `loadRecentPractices` does not exist.

- [ ] **Step 3: Implement the Store state and request sequencing**

```js
const recentPractices = ref([])
const recentPracticesLoading = ref(false)
const recentPracticesError = ref('')
let recentPracticeRequestSequence = 0
const recentPracticeItems = (response) => readApiCollection(response, ['practices', 'items', 'content'])

const loadRecentPractices = async (selectedFolderId) => {
  const sequence = ++recentPracticeRequestSequence
  const response = await archiveApi.listPractices(selectedFolderId, { page: 0, sort: 'latest' })
  const items = recentPracticeItems(response).map(normalizeArchivePractice).slice(0, 3)
  if (sequence === recentPracticeRequestSequence) recentPractices.value = items
  return items
}
```

Archive 폴더 통계 Map에는 `reportCount`, `best`, `latestScore`, `recentPracticeDate`를 보관하고 일반 목록 정규화 결과와 ID 기준으로 병합한다.

- [ ] **Step 4: Run the Store tests and verify GREEN**

Run: `node node_modules/vitest/vitest.mjs run tests/stores/stores.test.js`

Expected: PASS.

### Task 2: 발표·면접 공통 폴더 점수 미리보기

**Files:**
- Modify: `frontend-vue-main/tests/views/FolderSelectView.test.js`
- Modify: `frontend-vue-main/src/views/practice/FolderSelectView.vue`
- Modify: `frontend-vue-main/src/assets/styles/views/folder-select.css`

**Interfaces:**
- Consumes: Task 1의 `selected.best`, `selected.latestScore`, `selected.reportCount`, `practice.recentPractices`
- Produces: 왼쪽 최근 점수 배지와 오른쪽 최고 점수·최근 3회 UI

- [ ] **Step 1: Write failing view tests for both types and empty data**

```js
test.each(['presentation', 'interview'])('shows best score and latest three completed reports for %s folders', async (type) => {
  // assert recent score badge, best score, exactly three rows, date labels and scores
})

test('shows an honest empty state when a folder has no completed report', async () => {
  // assert no fabricated score and the empty-state copy is visible
})
```

- [ ] **Step 2: Run view tests and verify RED**

Run: `node node_modules/vitest/vitest.mjs run tests/views/FolderSelectView.test.js`

Expected: FAIL because the current preview renders only the illustration and description.

- [ ] **Step 3: Implement selection watcher and score preview markup**

```js
watch(selected, (folder) => {
  if (!folder?.id) return practice.clearRecentPractices()
  void practice.loadRecentPractices(folder.id)
}, { immediate: true })
```

왼쪽 배지는 `최근 {latestScore}점`, 오른쪽은 폴더명, `최고 점수`, 최신 기록 최대 3개를 표시한다. 날짜는 오늘이면 `오늘`, 아니면 `M월 D일`로 변환하며 점수가 없는 행은 `점수 없음`으로 표시한다.

- [ ] **Step 4: Add responsive styles without changing the page structure**

`.folder-preview-score`, `.folder-preview-history`, `.folder-row-score`를 기존 두 열 레이아웃 안에 추가한다. 폴더명과 배지는 `min-width: 0`, `text-overflow: ellipsis`, `white-space: nowrap`으로 보호한다.

- [ ] **Step 5: Run view tests and verify GREEN**

Run: `node node_modules/vitest/vitest.mjs run tests/views/FolderSelectView.test.js`

Expected: PASS.

### Task 3: 회귀 검증

**Files:**
- Verify only

**Interfaces:**
- Consumes: Task 1~2 결과
- Produces: 푸시 가능한 검증 결과

- [ ] **Step 1: Run focused API, Store and View tests**

Run: `node node_modules/vitest/vitest.mjs run tests/api/archivePracticeApi.test.js tests/stores/stores.test.js tests/views/FolderSelectView.test.js`

Expected: PASS.

- [ ] **Step 2: Run the complete test suite**

Run: `node node_modules/vitest/vitest.mjs run`

Expected: all tests pass.

- [ ] **Step 3: Run the production build**

Run: `node node_modules/vite/bin/vite.js build`

Expected: exit code 0.

- [ ] **Step 4: Inspect the final diff**

Confirm that only the plan/spec and frontend Store/View/style/tests changed, with no backend changes.
