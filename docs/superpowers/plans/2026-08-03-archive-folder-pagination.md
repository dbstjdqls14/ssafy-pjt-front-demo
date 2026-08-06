# Archive Folder Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 내 기록 화면이 `GET /api/v1/practice-folders/archive`의 서버 페이지네이션 응답만 사용하도록 변경한다.

**Architecture:** `archiveApi`가 내 기록 전용 경로를 소유하고, `archiveStore`가 폴더 배열과 페이지 메타데이터를 함께 정규화한다. `ArchiveView`는 서버가 반환한 현재 페이지 폴더를 그대로 렌더링하고 UI의 1 기반 페이지 번호를 API의 0 기반 `page`로 변환한다.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest

## Global Constraints

- 폴더 선택 화면의 `GET /practice-folders` 호출은 유지한다.
- 내 기록 화면에서만 `GET /practice-folders/archive`를 사용한다.
- 전체 탭과 빈 검색어는 각각 `type`, `keyword` Query Parameter를 생략한다.
- API `page`는 0부터 시작하며 화면 표시는 1부터 시작한다.
- 응답의 `folders`를 프런트에서 다시 잘라내지 않는다.

---

### Task 1: Archive API and Store Contract

**Files:**
- Modify: `frontend-vue-main/src/api/archiveApi.js`
- Modify: `frontend-vue-main/src/api/normalizers/practice.js`
- Modify: `frontend-vue-main/src/stores/archiveStore.js`
- Test: `frontend-vue-main/tests/api/archivePracticeApi.test.js`
- Test: `frontend-vue-main/tests/stores/stores.test.js`

**Interfaces:**
- Consumes: `archiveApi.listFolders({ type?, keyword?, page })`
- Produces: `archive.pagination = { totalElements, currentPage, totalPage, hasNext }`

- [ ] **Step 1: Write failing API, normalizer, and store tests**

Assert `/practice-folders/archive?page=0`, `maxScore -> best`, `recentScore -> latestScore`, `averageScore`, `recentPracticeDate`, and response pagination state.

- [ ] **Step 2: Run focused tests and verify expected failures**

Run: `vitest run tests/api/archivePracticeApi.test.js tests/stores/stores.test.js`

- [ ] **Step 3: Implement the archive path and pagination state**

Keep `practiceApi.listFolders` unchanged; update only `archiveApi.listFolders`, folder normalization, and `archiveStore.loadFolders`.

- [ ] **Step 4: Run focused tests and verify they pass**

Run the same focused test command and require exit code 0.

### Task 2: Server-Driven Archive Pagination UI

**Files:**
- Modify: `frontend-vue-main/src/views/archive/ArchiveView.vue`
- Test: `frontend-vue-main/tests/views/ArchiveView.test.js`

**Interfaces:**
- Consumes: `archive.pagination.currentPage` as 0-based and `archive.pagination.totalPage`
- Produces: page buttons shown as 1-based values and `loadFolders({ page: displayedPage - 1 })`

- [ ] **Step 1: Write failing UI tests**

Assert initial `page: 0`, page-button navigation to `page: 1`, and no client-side `slice` of the returned folders.

- [ ] **Step 2: Run the focused view test and verify expected failures**

Run: `vitest run tests/views/ArchiveView.test.js`

- [ ] **Step 3: Implement server-driven pagination**

Render `archive.folders` directly, reset to page 0 on filter/search changes, and request the selected server page.

- [ ] **Step 4: Run focused and full verification**

Run focused tests, the full Vitest suite, `vite build`, and `git diff --check`.
