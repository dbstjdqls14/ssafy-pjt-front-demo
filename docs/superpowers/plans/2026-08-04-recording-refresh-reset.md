# Recording Refresh Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표·면접 녹화 중 확정된 새로고침은 복구 불가능한 세션을 폐기하고 메인으로 이동시키며, 다음 연습에서는 새 서버 세션을 발급받게 한다.

**Architecture:** UI 공통 컴포넌트는 만들지 않는다. `sessionStorage` 기반의 작은 녹화 생명주기 유틸리티만 공유하고 발표·면접 녹화 화면이 각각 표식을 설정·해제·복구한다. 분석 화면은 표식을 정상 완료 전에 제거하므로 기존 ID와 폴링 복구를 그대로 유지한다.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest, Vue Test Utils

## Global Constraints

- 백엔드는 수정하지 않는다.
- 발표와 면접 화면 UI 및 도메인 로직은 공통 컴포넌트로 합치지 않는다.
- 녹화 시작 전 새로고침과 분석 대기 화면 새로고침은 기존 동작을 유지한다.
- 브라우저 수동 테스트는 사용자가 수행하므로 자동 테스트와 빌드만 실행한다.

---

### Task 1: 활성 녹화 표식과 1회 안내 저장소

**Files:**
- Modify: `frontend-vue-main/src/constants/storageKeys.js`
- Create: `frontend-vue-main/src/utils/recordingRefreshRecovery.js`
- Create: `frontend-vue-main/tests/utils/recordingRefreshRecovery.test.js`

**Interfaces:**
- Produces: `markActiveRecording(kind)`, `clearActiveRecording(kind)`, `shouldResetRecordingAfterReload(kind, performanceLike)`, `queueRecordingResetNotice(kind)`, `consumeRecordingResetNotice()`.

- [ ] **Step 1: Write the failing utility tests**

```js
test('reload with a matching active marker requests reset', () => {
  markActiveRecording('presentation')
  expect(shouldResetRecordingAfterReload('presentation', reloadPerformance)).toBe(true)
})

test('ordinary navigation and a mismatched marker do not request reset', () => {
  markActiveRecording('interview')
  expect(shouldResetRecordingAfterReload('presentation', navigatePerformance)).toBe(false)
  expect(shouldResetRecordingAfterReload('presentation', reloadPerformance)).toBe(false)
})

test('queued reset notice is consumed once', () => {
  queueRecordingResetNotice('interview')
  expect(consumeRecordingResetNotice()?.kind).toBe('interview')
  expect(consumeRecordingResetNotice()).toBeNull()
})
```

- [ ] **Step 2: Run the utility test and confirm RED**

Run: `npm test -- --run tests/utils/recordingRefreshRecovery.test.js`
Expected: FAIL because `recordingRefreshRecovery.js` does not exist.

- [ ] **Step 3: Implement the minimal storage utility**

```js
export const markActiveRecording = (kind) => sessionStorage.setItem(ACTIVE_KEY, kind)
export const clearActiveRecording = (kind) => {
  if (!kind || sessionStorage.getItem(ACTIVE_KEY) === kind) sessionStorage.removeItem(ACTIVE_KEY)
}
export const shouldResetRecordingAfterReload = (kind, performanceLike = globalThis.performance) => {
  const navigation = performanceLike?.getEntriesByType?.('navigation')?.[0]
  return navigation?.type === 'reload' && sessionStorage.getItem(ACTIVE_KEY) === kind
}
```

Store a JSON notice with the practice kind, and remove it inside `consumeRecordingResetNotice`.

- [ ] **Step 4: Run the utility test and confirm GREEN**

Run: `npm test -- --run tests/utils/recordingRefreshRecovery.test.js`
Expected: PASS.

### Task 2: 발표·면접 녹화 생명주기에 표식 적용

**Files:**
- Modify: `frontend-vue-main/src/views/presentation/PresentationRecordView.vue`
- Modify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`
- Modify: `frontend-vue-main/src/stores/presentationStore.js`
- Modify: `frontend-vue-main/src/stores/interviewStore.js`
- Modify: `frontend-vue-main/tests/views/PresentationRecordLifecycle.test.js`
- Modify: `frontend-vue-main/tests/views/InterviewRecordInterlock.test.js`

**Interfaces:**
- Consumes: Task 1 recovery utility.
- Produces: actual recording start marks the kind; normal finish/confirmed exit/reset clears it; reload entry resets recording/domain stores and executes `router.replace('/')`.

- [ ] **Step 1: Add failing view lifecycle tests**

Assert that successful presentation/interview start stores the matching marker. Mount each record view with a reload navigation and an existing marker, then assert its domain store and recording store reset methods are called and the router replaces `/`.

- [ ] **Step 2: Run focused lifecycle tests and confirm RED**

Run: `npm test -- --run tests/views/PresentationRecordLifecycle.test.js tests/views/InterviewRecordInterlock.test.js`
Expected: FAIL because the views neither mark nor recover active recordings.

- [ ] **Step 3: Apply minimal lifecycle integration**

At the beginning of each recording view `onMounted`, run reload recovery before device/model preparation. On recovery: clear marker, reset its domain store and recording store, queue the one-time notice, set route-leave bypass, `await router.replace('/')`, then return. Mark only after recorder/capture startup succeeds. Clear before normal transition to analyzing and after confirmed exit. Domain store `reset()` also clears its own marker as a final guard.

- [ ] **Step 4: Run focused lifecycle tests and confirm GREEN**

Run: `npm test -- --run tests/views/PresentationRecordLifecycle.test.js tests/views/InterviewRecordInterlock.test.js`
Expected: PASS.

### Task 3: 메인 화면에 새로고침 종료 안내 1회 표시

**Files:**
- Modify: `frontend-vue-main/src/views/HomeView.vue`
- Modify: `frontend-vue-main/tests/views/HomePreview.test.js`
- Modify: `frontend-vue-main/src/assets/styles/views/home.css`

**Interfaces:**
- Consumes: `consumeRecordingResetNotice()` from Task 1.
- Produces: a dismissible `role="status"` notice rendered only once after reload recovery.

- [ ] **Step 1: Write the failing home notice test**

Queue a presentation notice, mount `HomeView`, assert the notice contains `새로고침으로 진행 중인 연습이 종료되었습니다.`; unmount and mount again, then assert it is absent.

- [ ] **Step 2: Run the home test and confirm RED**

Run: `npm test -- --run tests/views/HomePreview.test.js`
Expected: FAIL because `HomeView` does not consume or render the notice.

- [ ] **Step 3: Implement the one-time notice**

Consume the notice during setup, render it near the top of the home content without changing existing navigation or motion code, and provide a dismiss button. Use the copy `새로고침으로 진행 중인 연습이 종료되었습니다. 새로운 연습을 시작해주세요.`

- [ ] **Step 4: Run the home test and confirm GREEN**

Run: `npm test -- --run tests/views/HomePreview.test.js`
Expected: PASS.

### Task 4: Regression verification

**Files:**
- Verify only.

- [ ] **Step 1: Run the focused tests**

Run: `npm test -- --run tests/utils/recordingRefreshRecovery.test.js tests/views/PresentationRecordLifecycle.test.js tests/views/InterviewRecordInterlock.test.js tests/views/HomePreview.test.js`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build exits with code 0.

- [ ] **Step 4: Review the diff**

Confirm no backend files changed, analyzing views retain their polling/recovery behavior, and only the intended frontend lifecycle/storage/home-notice files plus tests and docs changed.
