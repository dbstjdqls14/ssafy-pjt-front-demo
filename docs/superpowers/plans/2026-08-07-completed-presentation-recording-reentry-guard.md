# Completed Presentation Recording Reentry Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect a completed presentation session away from the recording screen, show `종료된 세션입니다.` once on Home, and preserve the completed report state.

**Architecture:** Extend the existing session-storage-backed recording notice with an optional reason while preserving the current refresh notice contract. `PresentationRecordView` owns the completed-session entry guard and performs it before slide or media initialization, replacing the stale recording history entry with Home.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vue Router 4, Vitest, Vue Test Utils, sessionStorage.

## Global Constraints

- Preserve all existing uncommitted Q&A and camera-permission changes.
- Do not reset `presentationStore` when guarding a completed session.
- Display exactly `종료된 세션입니다.` for the completed-session notice.
- Preserve the existing refresh recovery notice and normal unfinished recording entry flow.
- Do not add a global router guard or manipulate the full browser history.

---

### Task 1: One-time completed-session notice

**Files:**
- Modify: `src/utils/recordingRefreshRecovery.js`
- Modify: `src/views/HomeView.vue`
- Test: `tests/utils/recordingRefreshRecovery.test.js`
- Test: `tests/views/HomePreview.test.js`

**Interfaces:**
- Produces: `queueRecordingResetNotice(kind, reason = null): boolean`
- Produces: `consumeRecordingResetNotice(): { kind: 'presentation' | 'interview', reason?: 'completed-session' } | null`
- Consumes: existing `SESSION_STORAGE_KEYS.recordingResetNotice` storage key.

- [ ] **Step 1: Write the failing storage-contract test**

```js
test('preserves a completed-session reason in a one-time notice', () => {
  queueRecordingResetNotice('presentation', 'completed-session')

  expect(consumeRecordingResetNotice()).toEqual({
    kind: 'presentation',
    reason: 'completed-session',
  })
  expect(consumeRecordingResetNotice()).toBeNull()
})
```

- [ ] **Step 2: Write the failing Home behavior test**

```js
test('shows a completed session notice once after stale recording reentry', async () => {
  queueRecordingResetNotice('presentation', 'completed-session')

  const wrapper = await mountHome()
  expect(wrapper.get('[data-testid="recording-reset-notice"]').text())
    .toContain('종료된 세션입니다.')
  wrapper.unmount()

  const nextWrapper = await mountHome()
  expect(nextWrapper.find('[data-testid="recording-reset-notice"]').exists()).toBe(false)
  nextWrapper.unmount()
})
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/utils/recordingRefreshRecovery.test.js tests/views/HomePreview.test.js
```

Expected: FAIL because the notice reason is discarded and Home always renders the refresh-specific copy.

- [ ] **Step 4: Implement the minimal notice contract and Home copy**

```js
export const queueRecordingResetNotice = (kind, reason = null) => {
  if (!isRecordingKind(kind)) return false
  const notice = reason ? { kind, reason } : { kind }
  writeJsonStorage(sessionStorage, NOTICE_KEY, notice)
  return true
}

export const consumeRecordingResetNotice = () => {
  const notice = readJsonStorage(sessionStorage, NOTICE_KEY, null)
  sessionStorage.removeItem(NOTICE_KEY)
  if (!isRecordingKind(notice?.kind)) return null
  return notice?.reason === 'completed-session'
    ? { kind: notice.kind, reason: 'completed-session' }
    : { kind: notice.kind }
}
```

```js
const recordingResetNoticeMessage = computed(() => (
  recordingResetNotice.value?.reason === 'completed-session'
    ? '종료된 세션입니다.'
    : '새로고침으로 진행 중인 연습이 종료되었습니다. 새로운 연습을 시작해주세요.'
))
```

```vue
<span>{{ recordingResetNoticeMessage }}</span>
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: both files pass.

---

### Task 2: Completed presentation recording entry guard

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Test: `tests/views/PresentationRecordLifecycle.test.js`

**Interfaces:**
- Consumes: `presentation.sessionStatus`, `queueRecordingResetNotice('presentation', 'completed-session')`.
- Produces: completed session entry replaces `/presentation/record` with `/` before slide and media initialization.

- [ ] **Step 1: Write the failing reentry regression test**

Mount the real routed component with `presentation.sessionStatus = 'completed'`, a retained `presentation.report`, and non-empty recording state. Assert observable behavior:

```js
expect(router.currentRoute.value.path).toBe('/')
expect(presentation.report).toEqual(completedReport)
expect(recording.isRecording).toBe(false)
expect(consumeRecordingResetNotice()).toEqual({
  kind: 'presentation',
  reason: 'completed-session',
})
```

The test must also assert the completed route never renders `.record-shell`, proving that media initialization is bypassed from the user's perspective.

- [ ] **Step 2: Run the lifecycle test and verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/views/PresentationRecordLifecycle.test.js
```

Expected: FAIL because the current view remains on `/presentation/record` and renders the recording shell.

- [ ] **Step 3: Add a completed-session guard before reload recovery and device initialization**

```js
const redirectCompletedSession = async () => {
  if (presentation.sessionStatus !== 'completed') return false
  allowRouteLeave = true
  clearActiveRecording('presentation')
  recording.reset()
  queueRecordingResetNotice('presentation', 'completed-session')
  await router.replace('/')
  return true
}

onMounted(async () => {
  if (await redirectCompletedSession()) return
  if (shouldResetRecordingAfterReload('presentation')) {
    // existing recovery branch
  }
  // existing initialization
})
```

- [ ] **Step 4: Run the lifecycle and notice tests and verify GREEN**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/views/PresentationRecordLifecycle.test.js tests/utils/recordingRefreshRecovery.test.js tests/views/HomePreview.test.js
```

Expected: all focused tests pass.

---

### Task 3: Regression and browser verification

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: the completed-session guard and one-time Home notice from Tasks 1-2.
- Produces: evidence that the requested flow and existing application still work.

- [ ] **Step 1: Run all unit tests**

```powershell
node node_modules/vitest/vitest.mjs run
```

Expected: all test files and tests pass.

- [ ] **Step 2: Run the production build**

```powershell
node node_modules/vite/bin/vite.js build
```

Expected: Vite exits with code 0.

- [ ] **Step 3: Check the diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only the requested files plus pre-existing user changes are modified.

- [ ] **Step 4: Verify the rendered browser flow**

Using the local Vite server, reach a completed presentation summary, press browser Back, and confirm:

1. the recording screen is not displayed;
2. the URL becomes `/` through replacement;
3. Home shows `종료된 세션입니다.` once;
4. returning Home again does not repeat the notice;
5. no new console error appears.
