# Report, Archive Auth, and Practice Title Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant presentation-analysis exit prompts, repair the presentation feedback surface, protect archive routes and stale state after logout, and reject emoji in presentation/interview practice names.

**Architecture:** Keep each correction at its owning boundary: presentation analysis navigation in its view, feedback styling in the presentation stylesheet, archive authorization in route metadata plus defensive store cleanup, and title rules in a shared validator consumed by both setup views and creation stores. Do not modify interview report answer/caption rendering.

**Tech Stack:** Vue 3 Composition API, Vue Router, Pinia, Vitest, Vue Test Utils, Vite

## Global Constraints

- Frontend-only changes; do not modify Spring or FastAPI code.
- Preserve all unrelated dirty-worktree changes and do not create a commit unless explicitly requested.
- Keep the upload-stage exit warning; only background report polling may be left without a modal or `beforeunload` prompt.
- Archive list, folder detail, and report detail must all require authentication.
- Reject emoji from both presentation and interview practice names, including paste input; keep Korean, Latin text, digits, whitespace, and ordinary punctuation unchanged.
- Do not change interview report answer or caption behavior.

---

### Task 1: Background analysis navigation

**Files:**
- Modify: `src/views/presentation/PresentationAnalyzingView.vue`
- Test: `tests/views/PresentationAnalyzingView.test.js`

**Interfaces:**
- Consumes: existing `showBackgroundNotice` computed state.
- Produces: `shouldWarnBeforeExit()` returns false once the Spring report job is polling in the background.

- [ ] **Step 1: Write the failing test**

Add a view test that mounts `?phase=report` with `sessionStatus = 'completed'` and `loadReportJobStatus()` returning `STT_ANALYZING`, navigates away, and expects the route change to succeed with no exit dialog.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node node_modules/vitest/vitest.mjs run tests/views/PresentationAnalyzingView.test.js`

Expected: the route remains on `/presentation/analyzing` because the current guard opens the modal.

- [ ] **Step 3: Implement the minimal navigation rule**

Change the warning predicate to protect only a running analysis that is not already represented by `showBackgroundNotice`:

```js
const shouldWarnBeforeExit = () => (
  status.value === 'running'
  && !showBackgroundNotice.value
  && !allowRouteLeave
)
```

- [ ] **Step 4: Run the focused test**

Expected: both the existing upload-stage warning test and the new background-polling navigation test pass.

---

### Task 2: Presentation AI feedback surface

**Files:**
- Modify: `src/assets/styles/views/presentation-report.css`
- Test: `tests/architecture/presentationReportStyles.test.js`

**Interfaces:**
- Consumes: `.pr-feedback-block` and `.pr-qna-feedback`.
- Produces: Q&A feedback text uses the parent red feedback surface without a nested gray fill.

- [ ] **Step 1: Write the failing CSS contract test**

Assert that the `.pr-feedback-block .pr-qna-feedback` rule explicitly has `padding: 0` and `background: transparent`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node node_modules/vitest/vitest.mjs run tests/architecture/presentationReportStyles.test.js`

Expected: the scoped override is absent.

- [ ] **Step 3: Add the scoped override**

```css
.pr-feedback-block .pr-qna-feedback {
  padding: 0;
  background: transparent;
}
```

- [ ] **Step 4: Run the focused test**

Expected: the stylesheet contract passes without changing other report cards.

---

### Task 3: Archive authorization and stale-state cleanup

**Files:**
- Modify: `src/router/modules/archiveRoutes.js`
- Modify: `src/stores/archiveStore.js`
- Test: `tests/routes.test.js`
- Test: `tests/stores/stores.test.js`

**Interfaces:**
- Consumes: global router guard behavior for `meta.requiresAuth`.
- Produces: all `/archive` leaves declare `requiresAuth: true`; failed list loads clear folders, selection data, and pagination before exposing the error.

- [ ] **Step 1: Write failing route and store tests**

Add a route contract test covering every path that starts with `/archive`. Add an archive-store test that seeds prior folders and selected/practice data, rejects `archiveApi.listFolders`, and expects the stale server-backed state to be empty.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node node_modules/vitest/vitest.mjs run tests/routes.test.js tests/stores/stores.test.js`

Expected: archive routes lack auth metadata and rejected loads retain the old folders.

- [ ] **Step 3: Add route protection and a focused reset helper**

Set `requiresAuth: true` on all three archive route records. Add an internal `clearServerState()` helper in `archiveStore` that resets `folders`, pagination, `selectedFolder`, and `practices`, and invoke it for the current failed folder-list request.

- [ ] **Step 4: Run the focused tests**

Expected: unauthenticated archive navigation is covered by the existing global guard contract and stale rows cannot remain after authorization failure.

---

### Task 4: Shared emoji-free practice titles

**Files:**
- Modify: `src/utils/validators.js`
- Modify: `src/views/presentation/PresentationSetupView.vue`
- Modify: `src/views/interview/InterviewSetupView.vue`
- Modify: `src/stores/presentationStore.js`
- Modify: `src/stores/interviewStore.js`
- Test: `tests/utils/validators.test.js`
- Test: `tests/views/PresentationSetupView.test.js`
- Test: `tests/views/InterviewSetupView.test.js`
- Test: `tests/stores/stores.test.js`

**Interfaces:**
- Produces: `stripEmoji(value): string` and `practiceTitleValidationMessage(value): string`.
- Consumes: `INPUT_LIMITS.PRACTICE_TITLE`.

- [ ] **Step 1: Write failing validator and view tests**

Verify `stripEmoji('A사 면접 😁') === 'A사 면접 '`, flags/modifiers/joiners are removed, and ordinary punctuation remains. In both setup views, paste an emoji-containing title and assert the input/store candidate contains no emoji. Verify a programmatic emoji-only store title is rejected before an API request.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node node_modules/vitest/vitest.mjs run tests/utils/validators.test.js tests/views/PresentationSetupView.test.js tests/views/InterviewSetupView.test.js tests/stores/stores.test.js`

Expected: shared helpers do not exist and setup inputs preserve emoji.

- [ ] **Step 3: Implement shared normalization and validation**

Use Unicode property escapes to remove pictographs, regional indicators, emoji modifiers, variation selectors, zero-width joiners, and keycap marks. Apply `stripEmoji()` in each title input handler and use `practiceTitleValidationMessage()` in both `goNext` paths and both creation-store defenses.

- [ ] **Step 4: Run the focused tests**

Expected: both flows remove emoji consistently and store-level API calls remain protected.

---

### Task 5: Regression and rendered-page verification

**Files:**
- Review only: all modified files and the final diff.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: verified frontend build and user-visible behavior.

- [ ] **Step 1: Run all tests**

Run: `node node_modules/vitest/vitest.mjs run`

Expected: all test files pass.

- [ ] **Step 2: Build production assets**

Run: `node node_modules/vite/bin/vite.js build`

Expected: Vite exits successfully.

- [ ] **Step 3: Inspect the final diff**

Confirm no interview report answer/caption file changed and no unrelated user modification was overwritten.

- [ ] **Step 4: Verify the running app**

Check the local app for background-analysis back navigation, presentation feedback appearance, logged-out archive redirect, and emoji paste behavior in both setup flows. Record any scenario that cannot be exercised without authenticated server data.
