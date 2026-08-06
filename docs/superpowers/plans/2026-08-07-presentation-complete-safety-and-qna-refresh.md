# Presentation Complete Safety and Q&A Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep presentation recording data protected until `/presentations/{presentationId}/status` confirms server acceptance, then allow background analysis exits, while discarding unrecoverable Q&A sessions after a forced refresh.

**Architecture:** `PresentationAnalyzingView` owns the upload-safety state machine and polls the existing presentation status endpoint through the Pinia store. The recording refresh marker remains alive from recording start until the server reports `PENDING` or a later accepted state; analyzing and Q&A screens consume that marker on reload and reset the unrecoverable client-only flow. One stable notice card changes copy in place when the safety boundary changes.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vue Router, Vitest, Vue Test Utils, Vite

## Global Constraints

- Poll `GET /api/v1/presentations/{presentationId}/status`; do not poll `/report-job/status` from the analyzing view.
- Accepted statuses are exactly `PENDING`, `STT_ANALYZING`, `LLM_ANALYZING`, and `COMPLETED`; `FAILED` is terminal failure.
- Before acceptance, route exits and `beforeunload` stay guarded.
- After acceptance, the same notice card changes copy and exits are unguarded.
- Never render internal recovery-state labels to users.
- A forced reload during question generation or Q&A resets the presentation and recording stores and redirects home with the existing one-time reset notice.
- Do not add dependencies or change backend code.
- Do not perform browser-based UI testing. Validate rendering with Vue component tests and run the production build.
- Preserve the existing unstaged interview transcript changes in `src/views/interview/InterviewReportDetailView.vue` and `tests/views/InterviewReportDetailView.test.js`; never include them in commits for this plan unless the user separately requests it.

---

## File Structure

- `src/api/presentationApi.js`: retains the existing `getStatus(presentationId)` endpoint contract; the obsolete report-job method is not used by the updated view.
- `src/stores/presentationStore.js`: exposes a single `loadProcessingStatus(presentationId)` method that unwraps `presentationApi.getStatus` for analyzing-screen polling.
- `src/views/presentation/PresentationAnalyzingView.vue`: owns server-acceptance state, stable notice-card copy, exit protection, pending-navigation release, and reload recovery during question generation/upload.
- `src/views/presentation/PresentationRecordView.vue`: keeps the presentation refresh marker after successful recording completion instead of clearing it before upload.
- `src/views/presentation/PresentationQnaView.vue`: warns before hard reload and discards the flow when mounted from a reload with the marker still present.
- `tests/stores/springPresentationFlow.test.js`: verifies the store status boundary calls the required endpoint and unwraps the response.
- `tests/views/PresentationAnalyzingView.test.js`: verifies the complete/status state machine, same-card copy transition, route/unload guards, and automatic pending navigation.
- `tests/views/PresentationRecordLifecycle.test.js`: verifies recording completion retains the refresh marker.
- `tests/views/PresentationQnaView.test.js`: verifies forced reload cleanup and normal Q&A navigation preservation.

### Task 1: Poll the canonical presentation status endpoint

**Files:**
- Modify: `src/stores/presentationStore.js:680-710`
- Test: `tests/stores/springPresentationFlow.test.js`

**Interfaces:**
- Consumes: `presentationApi.getStatus(presentationId): Promise<unknown>`, `parseServerId(value): number | null`, `unwrapApiResponse(response): unknown`
- Produces: `presentation.loadProcessingStatus(presentationId = sessionId): Promise<{ processingStatus?: string, status?: string, errorMessage?: string }>`

- [ ] **Step 1: Write the failing store test**

Add a test that calls `store.loadProcessingStatus(7)`, stubs `presentationApi.getStatus(7)` with an API envelope, and asserts the unwrapped `processingStatus` is returned.

```js
test('loads report processing state from the canonical presentation status endpoint', async () => {
  const store = usePresentationStore()
  const getStatus = vi.spyOn(presentationApi, 'getStatus').mockResolvedValue({
    data: { processingStatus: 'PENDING' },
  })

  await expect(store.loadProcessingStatus(7)).resolves.toEqual({
    processingStatus: 'PENDING',
  })
  expect(getStatus).toHaveBeenCalledWith(7)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/stores/springPresentationFlow.test.js -t "loads report processing state"
```

Expected: FAIL because `loadProcessingStatus` does not exist.

- [ ] **Step 3: Implement the store boundary**

Add the method near `loadReportJobStatus` and expose it from the store return object.

```js
const loadProcessingStatus = async (presentationId = sessionId.value) => {
  const targetId = parseServerId(presentationId)
  if (targetId === null) {
    throw new Error('발표 처리 상태를 조회할 presentationId가 없습니다.')
  }
  return unwrapApiResponse(await presentationApi.getStatus(targetId))
}
```

Keep `loadReportJobStatus` only if another caller still uses it; the analyzing view must not use it after Task 2.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command again.

Expected: PASS with the endpoint spy called once using numeric ID `7`.

- [ ] **Step 5: Commit only Task 1 files**

```powershell
git add -- src/stores/presentationStore.js tests/stores/springPresentationFlow.test.js
git commit -m "refactor: expose presentation processing status"
```

### Task 2: Protect upload until server acceptance and switch one notice card in place

**Files:**
- Modify: `src/views/presentation/PresentationAnalyzingView.vue:1-260`
- Test: `tests/views/PresentationAnalyzingView.test.js`

**Interfaces:**
- Consumes: `presentation.completeSession({ durationMs }): Promise<void>`, `presentation.loadProcessingStatus(presentationId): Promise<object>`, `presentation.loadReport(presentationId): Promise<object>`
- Produces: `serverAccepted: Ref<boolean>`, one `[data-testid="presentation-analysis-notice"]` card, guarded route/unload behavior before acceptance, unrestricted behavior after acceptance

- [ ] **Step 1: Replace the obsolete polling tests with failing canonical-status tests**

Update the view tests to spy on `loadProcessingStatus` instead of `loadReportJobStatus`. Add two deferred-promise tests:

```js
test('keeps upload copy and exit guards until the first accepted status arrives', async () => {
  const store = usePresentationStore()
  store.sessionId = 9
  createArtifacts(store)
  let resolveComplete
  vi.spyOn(store, 'completeSession').mockReturnValue(new Promise((resolve) => {
    resolveComplete = () => {
      store.sessionStatus = 'completed'
      resolve()
    }
  }))
  const loadStatus = vi.spyOn(store, 'loadProcessingStatus').mockReturnValue(new Promise(() => {}))

  const { wrapper, router } = await mountView()
  expect(wrapper.get('[data-testid="presentation-analysis-notice"]').text())
    .toContain('녹화 파일을 업로드하고 있어요')

  await router.push('/presentation/qna')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/presentation/analyzing')
  expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false)

  resolveComplete()
  await flushPromises()
  expect(loadStatus).toHaveBeenCalledOnce()
  expect(wrapper.get('[data-testid="presentation-analysis-notice"]').text())
    .toContain('아직 서버에 안전하게 저장되지 않았어요')
})
```

Add another test where `loadProcessingStatus` returns `PENDING`; assert the same card now contains `분석 결과를 준비하고 있어요`, route navigation succeeds, and `beforeunload` is not cancelled.

- [ ] **Step 2: Add a failing test for an already-open exit modal**

```js
test('continues the pending navigation when PENDING arrives with the exit modal open', async () => {
  const store = usePresentationStore()
  store.sessionId = 9
  createArtifacts(store)
  let resolveStatus
  vi.spyOn(store, 'completeSession').mockImplementation(async () => {
    store.sessionStatus = 'completed'
  })
  vi.spyOn(store, 'loadProcessingStatus').mockReturnValue(new Promise((resolve) => {
    resolveStatus = resolve
  }))

  const { wrapper, router } = await mountView()
  await router.push('/presentation/qna')
  await flushPromises()
  expect(wrapper.find('[data-testid="presentation-analysis-exit-dialog"]').exists()).toBe(true)

  resolveStatus({ processingStatus: 'PENDING' })
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/presentation/qna')
})
```

- [ ] **Step 3: Run the focused view tests and verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/views/PresentationAnalyzingView.test.js
```

Expected: FAIL because the view calls `loadReportJobStatus`, hides the notice before polling, and allows exits before the first status response.

- [ ] **Step 4: Implement the explicit acceptance state**

In `PresentationAnalyzingView.vue`:

```js
const acceptedStatuses = new Set(['PENDING', 'STT_ANALYZING', 'LLM_ANALYZING', 'COMPLETED'])
const serverAccepted = ref(false)
const noticeTitle = computed(() => (
  serverAccepted.value ? '분석 결과를 준비하고 있어요' : '녹화 파일을 업로드하고 있어요'
))
const noticeDescription = computed(() => (
  serverAccepted.value
    ? '페이지를 이동해도 분석은 계속되며, 완료 후 내 기록에서 확인할 수 있습니다.'
    : '아직 서버에 안전하게 저장되지 않았어요. 잠시만 기다려 주세요. 새로고침하거나 페이지를 나가면 정보가 유실될 수 있어요.'
))

const shouldWarnBeforeExit = () => !serverAccepted.value && !allowRouteLeave
```

Render one stable card for every non-failed running state:

```vue
<div
  v-if="status === 'running'"
  class="presentation-background-analysis-notice"
  data-testid="presentation-analysis-notice"
  role="status"
>
  <p class="presentation-background-analysis-notice-title">{{ noticeTitle }}</p>
  <p class="presentation-background-analysis-notice-description">{{ noticeDescription }}</p>
</div>
```

- [ ] **Step 5: Switch polling and release a pending navigation at the safety boundary**

Normalize the status with `processingStatus` first, then `status`:

```js
const job = await presentation.loadProcessingStatus(presentation.sessionId)
const jobStatus = String(job?.processingStatus ?? job?.status ?? '').toUpperCase()
reportJobStatus.value = jobStatus

if (acceptedStatuses.has(jobStatus)) {
  serverAccepted.value = true
  if (pendingExitLocation) {
    const exitLocation = pendingExitLocation
    pendingExitLocation = null
    allowRouteLeave = true
    showExit.value = false
    stopped = true
    window.clearTimeout(pollTimer)
    await router.push(exitLocation)
    return
  }
}
```

Continue polling for `PENDING`, `STT_ANALYZING`, and `LLM_ANALYZING`; load the report and replace the route only for `COMPLETED`; call `fail` for `FAILED` or an unknown status.

- [ ] **Step 6: Update modal copy for the unsafe upload state**

Use one unsafe-state message because the modal is never shown after acceptance:

```text
아직 파일 업로드가 끝나지 않았어요
녹화 파일이 아직 서버에 안전하게 저장되지 않았어요. 잠시만 기다려 주세요. 지금 나가면 정보가 유실될 수 있어요.
```

Keep the actions as “계속 기다리기” and “그래도 나가기”. The force-exit action must set `allowRouteLeave`, stop timers, and navigate only after Task 3 supplies the shared cleanup calls.

- [ ] **Step 7: Run the view tests and verify GREEN**

Run the Step 3 command again.

Expected: all `PresentationAnalyzingView` tests pass, including the new pre-status guard and pending-navigation cases.

- [ ] **Step 8: Commit only Task 2 files**

```powershell
git add -- src/views/presentation/PresentationAnalyzingView.vue tests/views/PresentationAnalyzingView.test.js
git commit -m "fix: guard presentation upload until server acceptance"
```

### Task 3: Preserve the refresh marker through Q&A and discard a reloaded client-only session

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue:520-550`
- Modify: `src/views/presentation/PresentationAnalyzingView.vue:1-195`
- Modify: `src/views/presentation/PresentationQnaView.vue:1-190`
- Test: `tests/views/PresentationRecordLifecycle.test.js`
- Test: `tests/views/PresentationAnalyzingView.test.js`
- Test: `tests/views/PresentationQnaView.test.js`

**Interfaces:**
- Consumes: `markActiveRecording('presentation')`, `shouldResetRecordingAfterReload('presentation')`, `clearActiveRecording('presentation')`, `queueRecordingResetNotice('presentation')`, `presentation.reset()`, `recording.reset()`
- Produces: a marker spanning recording start through server acceptance; `recoverReloadedPresentation(): Promise<boolean>` behavior in analyzing and Q&A mounts

- [ ] **Step 1: Write the failing recording-lifecycle test**

Extend the existing successful recording-end test so the mocked reload detector still sees an active presentation marker after routing to `/presentation/analyzing`.

```js
expect(shouldResetRecordingAfterReload(
  'presentation',
  { getEntriesByType: () => [{ type: 'reload' }] },
)).toBe(true)
```

Expected mutation caught: restoring `clearActiveRecording('presentation')` inside successful `performEndRecording` makes the test fail.

- [ ] **Step 2: Write failing reload tests for analyzing and Q&A**

For each component, mark the presentation before mounting and stub the navigation entry as reload. Assert:

```js
markActiveRecording('presentation')
vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'reload' }])

expect(presentation.sessionId).toBeNull()
expect(recording.isRecording).toBe(false)
expect(recording.isPaused).toBe(false)
expect(recording.elapsedSeconds).toBe(0)
expect(recording.transcriptSegments).toEqual([])
expect(recording.mediaBlob).toBeNull()
expect(router.currentRoute.value.path).toBe('/')
expect(consumeRecordingResetNotice()).toEqual({ kind: 'presentation' })
```

Use the real Pinia stores. Do not mock `reset()` because the test must verify user-visible recovery state rather than mock calls.

- [ ] **Step 3: Write the failing Q&A `beforeunload` test**

Mount a normal Q&A session, dispatch a cancelable `beforeunload`, and assert the event is cancelled while the component is mounted. Unmount, dispatch again, and assert it is no longer cancelled.

```js
const unload = new Event('beforeunload', { cancelable: true })
expect(window.dispatchEvent(unload)).toBe(false)
wrapper.unmount()
expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true)
```

- [ ] **Step 4: Run the three focused test files and verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationAnalyzingView.test.js tests/views/PresentationQnaView.test.js
```

Expected: FAIL because successful recording currently clears the marker and Q&A has no reload recovery or `beforeunload` handler.

- [ ] **Step 5: Keep the marker after successful recording completion**

Remove only this line from the successful `performEndRecording` path:

```js
clearActiveRecording('presentation')
```

Keep marker cleanup in deliberate recording exit, reload recovery, and explicit session-reset paths.

- [ ] **Step 6: Add reload recovery to the analyzing screen**

Import `useRecordingStore` and the three recovery utilities. Before registering normal listeners or calling `runAnalysis`, execute:

```js
const recoverReloadedPresentation = async () => {
  if (!shouldResetRecordingAfterReload('presentation')) return false
  allowRouteLeave = true
  clearActiveRecording('presentation')
  presentation.reset()
  recording.reset()
  queueRecordingResetNotice('presentation')
  await router.replace('/')
  return true
}
```

If it returns `true`, return from `onMounted` without calling `runAnalysis`.

When Task 2 detects an accepted status, call `clearActiveRecording('presentation')` before releasing guards. In forced pre-acceptance modal exit, clear the marker and reset both stores before navigation.

- [ ] **Step 7: Add Q&A hard-refresh protection and recovery**

Import the same stores and recovery utilities. Use this handler only while Q&A owns unrecoverable client-only recording data:

```js
const onBeforeUnload = (event) => {
  event.preventDefault()
  event.returnValue = true
}
```

In `onMounted`, recover first; otherwise register `beforeunload` and then load questions. In `onBeforeUnmount`, stop capture and remove the listener. Normal `finish()` navigation must not clear the marker because `/complete` has not yet reached an accepted server status.

- [ ] **Step 8: Run the focused tests and verify GREEN**

Run the Step 4 command again.

Expected: all three files pass; reload routes home and normal Q&A completion still routes to `/presentation/analyzing?phase=report`.

- [ ] **Step 9: Commit only Task 3 files**

```powershell
git add -- src/views/presentation/PresentationRecordView.vue src/views/presentation/PresentationAnalyzingView.vue src/views/presentation/PresentationQnaView.vue tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationAnalyzingView.test.js tests/views/PresentationQnaView.test.js
git commit -m "fix: discard presentation Q&A session after refresh"
```

### Task 4: Run non-browser verification and review the final diff

**Files:**
- Verify: all files changed in Tasks 1-3
- Preserve: `src/views/interview/InterviewReportDetailView.vue`
- Preserve: `tests/views/InterviewReportDetailView.test.js`

**Interfaces:**
- Consumes: completed Task 1-3 behavior
- Produces: fresh automated-test, build, and diff evidence without browser testing

- [ ] **Step 1: Run the affected tests together**

```powershell
node node_modules/vitest/vitest.mjs run tests/stores/springPresentationFlow.test.js tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationAnalyzingView.test.js tests/views/PresentationQnaView.test.js tests/utils/recordingRefreshRecovery.test.js tests/views/HomePreview.test.js
```

Expected: all listed test files pass with zero failures.

- [ ] **Step 2: Run the full unit/component suite**

```powershell
node node_modules/vitest/vitest.mjs run
```

Expected: all Vitest files pass with zero failures.

- [ ] **Step 3: Run the production build**

```powershell
node node_modules/vite/bin/vite.js build
```

Expected: Vite exits with code `0` and writes the production bundle to `dist/`.

- [ ] **Step 4: Review the final diff and working tree separation**

```powershell
git diff --check
git status --short
git diff -- src/api/presentationApi.js src/stores/presentationStore.js src/views/presentation/PresentationRecordView.vue src/views/presentation/PresentationAnalyzingView.vue src/views/presentation/PresentationQnaView.vue tests/stores/springPresentationFlow.test.js tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationAnalyzingView.test.js tests/views/PresentationQnaView.test.js
```

Expected: no whitespace errors; presentation changes match the approved spec; the separate interview transcript files remain identifiable and are not accidentally staged in presentation commits.

- [ ] **Step 5: Do not run browser tests**

Do not open or automate the in-app browser, Chrome, Playwright, or another browser surface. Report this as intentionally unverified per the approved constraint.

- [ ] **Step 6: Commit any test-only corrections if required**

Only when Step 1-4 required a test-only correction, stage the affected presentation test files and commit:

```powershell
git add -- tests/stores/springPresentationFlow.test.js tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationAnalyzingView.test.js tests/views/PresentationQnaView.test.js tests/utils/recordingRefreshRecovery.test.js tests/views/HomePreview.test.js
git commit -m "test: cover presentation upload safety flow"
```

If no correction was required, do not create an empty commit.
