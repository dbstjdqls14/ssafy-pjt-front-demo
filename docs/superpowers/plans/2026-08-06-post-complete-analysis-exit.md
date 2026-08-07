# Post-Complete Analysis Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow immediate navigation and browser exit after `complete` succeeds while preserving the existing guard during upload and `complete` submission.

**Architecture:** Keep the existing analysis exit modal and route guard, but narrow `shouldWarnBeforeExit()` to the pre-complete stages. Interview uses the already-defined `showBackgroundNotice` signal after `reportJob` is confirmed; presentation uses the explicit `stage === 'report'` boundary immediately after `completeSession()` resolves.

**Tech Stack:** Vue 3, Vue Router, Pinia, Vitest, Vue Test Utils.

## Global Constraints

- Do not modify backend APIs, analysis polling, or report navigation.
- Preserve exit protection while file upload or `complete` submission is still running.
- Do not modify recording, upload setup, or media-permission guards.
- Do not remove the existing modal markup because it remains required before `complete` succeeds.

---

### Task 1: Lock the post-complete exit behavior with regression tests

**Files:**

- Modify: `frontend-vue-main/tests/views/InterviewAnalyzingExitGuard.test.js`
- Modify: `frontend-vue-main/tests/views/PresentationAnalyzingView.test.js`

**Interfaces:**

- Consumes: `InterviewAnalyzingView` and `PresentationAnalyzingView` through their router-visible behavior.
- Produces: regression coverage for immediate route exit and a non-cancelled `beforeunload` event after `complete` succeeds.

- [ ] **Step 1: Add the failing interview test**

Add a test where `beginAnalysis()` marks processing and `pollAnalysis()` sets `interview.reportJob.status` to `STT_ANALYZING`. Assert that navigating to `/practice` succeeds without rendering `interview-analysis-exit-dialog`, and that `window.dispatchEvent(new Event('beforeunload', { cancelable: true }))` returns `true`.

```js
test('complete 응답 후 백그라운드 분석 중에는 경고 없이 이탈한다', async () => {
  // reportJob.status = STT_ANALYZING
  // router.push('/practice') must complete immediately
  expect(router.currentRoute.value.path).toBe('/practice')
  expect(wrapper.find('[data-testid="interview-analysis-exit-dialog"]').exists()).toBe(false)
  expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true)
})
```

- [ ] **Step 2: Add the failing presentation test**

Set `store.sessionStatus = 'completed'`, enter with `phase=report`, and keep `loadReportJobStatus()` pending. Assert that navigation succeeds before the first polling response and that `beforeunload` is not cancelled.

```js
test('complete 이후 report 단계는 첫 폴링 응답 전에도 경고 없이 이탈한다', async () => {
  store.sessionStatus = 'completed'
  vi.spyOn(store, 'loadReportJobStatus').mockReturnValue(new Promise(() => {}))
  const { wrapper, router } = await mountView({ phase: 'report' })
  await router.push('/presentation/qna')
  expect(router.currentRoute.value.path).toBe('/presentation/qna')
  expect(wrapper.find('[data-testid="presentation-analysis-exit-dialog"]').exists()).toBe(false)
  expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true)
})
```

- [ ] **Step 3: Run the tests and verify RED**

```powershell
node node_modules/vitest/vitest.mjs run tests/views/InterviewAnalyzingExitGuard.test.js tests/views/PresentationAnalyzingView.test.js
```

Expected: both new tests fail because the current route guards still block before the background notice or first polling response is available.

### Task 2: Narrow the guards to pre-complete stages

**Files:**

- Modify: `frontend-vue-main/src/views/interview/InterviewAnalyzingView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationAnalyzingView.vue`
- Test: `frontend-vue-main/tests/views/InterviewAnalyzingExitGuard.test.js`
- Test: `frontend-vue-main/tests/views/PresentationAnalyzingView.test.js`

**Interfaces:**

- Consumes: interview `showBackgroundNotice` and presentation `stage`.
- Produces: `shouldWarnBeforeExit(): boolean` that is true only before `complete` succeeds.

- [ ] **Step 1: Update the interview guard**

```js
const shouldWarnBeforeExit = () => (
  !stopped
  && !failed.value
  && !allowRouteLeave
  && !showBackgroundNotice.value
)
```

- [ ] **Step 2: Update the presentation guard**

```js
const shouldWarnBeforeExit = () => (
  status.value === 'running'
  && stage.value !== 'report'
  && !allowRouteLeave
)
```

- [ ] **Step 3: Run focused tests and verify GREEN**

```powershell
node node_modules/vitest/vitest.mjs run tests/views/InterviewAnalyzingExitGuard.test.js tests/views/PresentationAnalyzingView.test.js
```

Expected: all focused tests pass, including the existing tests that keep the guard during a pending `complete` request.

- [ ] **Step 4: Run full verification**

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add frontend-vue-main/src/views/interview/InterviewAnalyzingView.vue frontend-vue-main/src/views/presentation/PresentationAnalyzingView.vue frontend-vue-main/tests/views/InterviewAnalyzingExitGuard.test.js frontend-vue-main/tests/views/PresentationAnalyzingView.test.js frontend-vue-main/docs/superpowers/plans/2026-08-06-post-complete-analysis-exit.md
git commit -m "fix: complete 이후 분석 이탈 경고 제거"
```
