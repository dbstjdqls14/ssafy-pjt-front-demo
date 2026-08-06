# Real Support Documents API Integration Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mock unified support-document flow with the real Spring resume and portfolio APIs, including type-aware upload, list, detail, and delete UI.

**Architecture:** Keep the page's unified document presentation model, but source it from two independent backend resources. The Pinia store owns the merge/sort and routes operations by a composite `type:id`; Vue views only collect user input and render the normalized data. No local fallback or browser-persisted mock data remains in this flow.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue Router, Vitest, Vue Test Utils, existing Spring REST API client.

---

## Task 1: Define the real resume/portfolio document model

**Files:**
- Modify: `frontend-vue-main/tests/api/normalizers.test.js`
- Modify: `frontend-vue-main/src/api/normalizers/documents.js`

- [ ] Add failing tests for resume and portfolio normalization, composite IDs, server IDs, content/summary preservation, Korean date labels, and merged descending order.
- [ ] Run the normalizer test file and verify the new assertions fail for the intended missing behavior.
- [ ] Implement type-specific normalization and deterministic merge/sort helpers without file-size or preview URL fabrication.
- [ ] Run the normalizer test file and verify it passes.

## Task 2: Replace mock storage with real domain APIs

**Files:**
- Modify: `frontend-vue-main/tests/stores/stores.test.js`
- Modify: `frontend-vue-main/src/stores/documentsStore.js`

- [ ] Replace the unified `documentApi` test with failing tests for parallel resume/portfolio loading, colliding numeric IDs, type-routed detail/upload/delete, relevant-list refresh, and surfaced errors.
- [ ] Run the store test file and verify failures are caused by the current mock/unified implementation.
- [ ] Rewrite the Pinia store around `resumeApi` and `portfolioApi`, with separate arrays and a merged computed list.
- [ ] Remove localStorage, seeded mock, `withMock`, Blob URL, and inferred-type behavior from the store.
- [ ] Run store tests and verify they pass.

## Task 3: Build the explicit two-step registration flow

**Files:**
- Create: `frontend-vue-main/tests/views/MyPageDocumentsView.test.js`
- Modify: `frontend-vue-main/src/views/mypage/MyPageDocumentsView.vue`
- Modify: the existing mypage stylesheet that owns `.doc-*` styles (locate before editing)

- [ ] Add failing view tests for registration opening, type selection, title/PDF validation, exact upload payload, retry-safe failure state, list error retry, and file-size omission.
- [ ] Run the new view test file and confirm the current hidden-file-input flow fails it.
- [ ] Implement a modal with type selection followed by title and PDF selection, back/cancel controls, inline validation, and busy-state protection.
- [ ] Keep the modal open and selected file intact after API failure; close it only after successful upload.
- [ ] Add a visible retry action for initial list failures and update cards to render only type, title, and server date.
- [ ] Run the view tests and verify they pass.

## Task 4: Render API-backed document details

**Files:**
- Create: `frontend-vue-main/tests/views/MyPageDocumentDetailView.test.js`
- Modify: `frontend-vue-main/src/views/mypage/MyPageDocumentDetailView.vue`
- Modify: the existing mypage stylesheet if required

- [ ] Add failing detail tests for type-routed loading, resume `content`, portfolio `summary`, absent preview/download controls, empty state, and delete navigation.
- [ ] Run the new detail test file and confirm failures match the current iframe/download implementation.
- [ ] Replace preview/download rendering with a type-aware extracted-content panel and robust loading/error/empty states.
- [ ] Preserve composite IDs through delete and return to the list after success.
- [ ] Run the detail tests and verify they pass.

## Task 5: Verify the user flow and integration boundary

**Files:**
- Review: all changed frontend files

- [ ] Run the complete frontend test suite.
- [ ] Run the production build.
- [ ] Inspect the final diff and confirm no backend, FastAPI, database, or unrelated trend-page files changed.
- [ ] Open `/mypage/documents` in the local app and verify desktop and narrow viewport rendering, registration interactions, validation, filtering, detail navigation, delete confirmation, and error states.
- [ ] Check the browser console for new errors and record any API verification blocked by authentication or backend availability.
