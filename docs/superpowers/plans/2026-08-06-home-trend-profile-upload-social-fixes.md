# Home, Trend, Profile, Upload, and Social Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Fix the learning trend chart and copy, activate the home Script carousel controls, synchronize profile changes globally, make upload limits/statuses clear, and add production social metadata.

**Architecture:** Keep the existing Vue 3, Pinia, and Vite structure. Put reusable file validation in `src/utils`, keep authenticated profile state owned by `authStore`, and make UI components consume reactive store state. Use static Open Graph metadata in `index.html` because this deployment is an SPA without SSR.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest, Vue Test Utils, Vite.

**Constraints:** Do not change backend code or interview answer/caption behavior. Use a strict 50 MiB limit (`50 * 1024 * 1024`) for presentation and support-document files. Use `https://aivo.ai.kr/` as the canonical URL and the existing `/home-presenter.png` asset for sharing metadata. Preserve unrelated dirty-worktree changes and do not create commits automatically.

---

### Task 1: Correct learning-trend copy and use a fixed 0–100 chart scale

**Files:**
- Modify: `src/views/mypage/MyPageTrendView.vue`
- Modify: `tests/views/MyPageTrendView.test.js`

**Steps:**
1. Add tests asserting the recommendation copy uses `지표를` and never composes `전달를`.
2. Add chart assertions for five left-axis labels (`100, 75, 50, 25, 0`) and fixed coordinates for 0, 50, and 100 scores.
3. Run the focused test and confirm it fails for the current dynamic-scale implementation.
4. Replace min/max normalization with fixed 0–100 constants, add guide labels, reserve left padding, and increase the chart height slightly.
5. Run the focused test again and inspect the component diff.

### Task 2: Activate the home Script carousel arrows

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `tests/views/HomePreview.test.js`

**Steps:**
1. Add interaction tests for next, previous, and wrap-around behavior.
2. Run the focused test and confirm the inactive buttons fail it.
3. Add one cyclic slide-step function, wire both buttons, and expose correct accessible labels without disabled semantics.
4. Run the focused test again.

### Task 3: Synchronize profile data after login, startup, and edits

**Files:**
- Modify: `src/stores/authStore.js`
- Modify: `src/main.js`
- Modify: `tests/stores/authStore.test.js`
- Modify: `tests/architecture/mainBootstrap.test.js` if bootstrap coverage is not already present

**Steps:**
1. Add tests proving login refreshes `/users/me`, profile edits update nickname/image state immediately, and a failed follow-up refresh does not discard a successful edit.
2. Add a bootstrap assertion that an authenticated persisted session requests the current profile once.
3. Run focused tests and confirm failure.
4. Keep provisional login state for resilience, then refresh it from `/users/me`; merge successful profile-update input/response into Pinia immediately and perform a best-effort refresh.
5. Trigger one best-effort profile refresh during app bootstrap before revealing the application.
6. Run the focused store/bootstrap tests.

### Task 4: Clarify presentation upload state and enforce 50 MiB

**Files:**
- Modify: `src/utils/presentationFiles.js`
- Modify: `src/views/presentation/PresentationSetupView.vue`
- Modify: `tests/utils/presentationAnalysis.test.js`
- Modify: `tests/views/PresentationSetupView.test.js`

**Steps:**
1. Update tests to require a 50 MiB boundary, reject a one-byte-over file, display `최대 50MB`, and omit `업로드 대기` before submission.
2. Run focused tests and confirm the old 100 MiB behavior fails.
3. Change the shared constant/error copy, update the setup hint, and return an empty pending-status label while preserving processing/ready/error states.
4. Run focused tests again.

### Task 5: Add a reusable 50 MiB support-document limit

**Files:**
- Create: `src/utils/supportDocumentFiles.js`
- Create: `tests/utils/supportDocumentFiles.test.js`
- Modify: `src/views/mypage/MyPageDocumentsView.vue`
- Modify: `src/stores/documentsStore.js`
- Modify: `tests/views/MyPageDocumentsView.test.js`
- Modify: `tests/stores/stores.test.js`

**Steps:**
1. Add utility boundary tests and UI/store tests proving oversized PDFs are blocked before API submission.
2. Run focused tests and confirm failure.
3. Implement one shared PDF/type/size validator, use it in both the form and store boundary, and display `PDF · 최대 50MB`.
4. Run focused tests again.

### Task 6: Add canonical, Open Graph, and Twitter metadata

**Files:**
- Modify: `index.html`
- Create: `tests/architecture/socialMeta.test.js`

**Steps:**
1. Add an architecture test checking title, description, canonical URL, Open Graph fields, Twitter card fields, and absolute sharing-image URL.
2. Run it and confirm failure.
3. Add metadata using `https://aivo.ai.kr/` and `https://aivo.ai.kr/home-presenter.png`.
4. Run the metadata test again.

### Task 7: Verify behavior and rendered UI

**Steps:**
1. Run all affected test files together.
2. Run the complete Vitest suite and production build.
3. Review `git diff --check`, `git status --short`, and the scoped diff for unexpected changes.
4. With the local Vite server, verify the home Script arrows through the browser, inspect console errors, and confirm metadata in the rendered document.
5. If an authenticated browser session is available, inspect the trend/profile screens; otherwise report that those screens were covered by component/store tests but not authenticated visual QA.
