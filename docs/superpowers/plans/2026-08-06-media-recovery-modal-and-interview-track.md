# Media Recovery Modal and Interview Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent the interview preview from turning black after the five-second countdown and give presentation/interview recordings one consistent, recoverable camera-and-microphone permission flow.

**Architecture:** `useMediaDevices` remains the owner of browser camera/microphone source tracks, while `useCaptureBridge` consumes those tracks without stopping them and keeps stable output tracks for recorders. A shared permission modal owns only the fixed guidance UI; each recording view owns recovery state and resumes automatically only when recording was active before device loss.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest, Vue Test Utils, MediaStream/Web Audio browser APIs.

## Global Constraints

- Do not modify backend contracts or interview answer/TTS behavior.
- Preserve user and pre-existing worktree changes.
- Permission recovery must require both live camera and microphone tracks.
- A failed retry keeps the modal open with one enabled `확인` button and no raw browser error.
- Automatic recovery resumes only a recording that was running before loss; it must not start a pre-recording countdown flow or resume a manually paused recording.

---

### Task 1: Make capture source connections idempotent and non-owning

**Files:**

- Modify: `frontend-vue-main/tests/composables/useCaptureBridge.test.js`
- Modify: `frontend-vue-main/src/composables/useCaptureBridge.js`

- [ ] Add source-track fakes whose `stop()` changes `readyState` to `ended`.
- [ ] Add a regression test that connects the same live video/audio tracks twice and verifies they stay live and are never stopped.
- [ ] Add a replacement/disposal test that verifies bridge-owned output tracks are stopped but source tracks are not.
- [ ] Run the focused test and confirm the new regression fails before production changes:

```powershell
npx vitest run tests/composables/useCaptureBridge.test.js
```

- [ ] Make same-live-track connection a no-op and reject already-ended tracks.
- [ ] Detach previous sources without stopping them; keep output stream and output track identities stable.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Lock the five-second interview countdown regression

**Files:**

- Modify: `frontend-vue-main/tests/views/InterviewRecordMediaControls.test.js`
- Verify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`

- [ ] Assert that the pre-countdown and post-countdown bridge calls receive the same live source tracks and recording starts from the bridge output.
- [ ] Confirm no extra browser media request occurs at countdown completion.
- [ ] Run:

```powershell
npx vitest run tests/views/InterviewRecordMediaControls.test.js
```

### Task 3: Adopt and verify the shared permission modal

**Files:**

- Add: `frontend-vue-main/src/components/common/RequiredMediaPermissionModal.vue`
- Add: `frontend-vue-main/tests/components/RequiredMediaPermissionModal.test.js`

- [ ] Preserve the approved fixed title and body copy.
- [ ] Render exactly one confirm button, with `확인 중…` and disabled state while checking.
- [ ] Verify accessible dialog labelling and confirm emission.
- [ ] Run:

```powershell
npx vitest run tests/components/RequiredMediaPermissionModal.test.js
```

### Task 4: Integrate recovery into the interview recording view

**Files:**

- Modify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`
- Modify: `frontend-vue-main/tests/views/InterviewRecordMediaControls.test.js`

- [ ] Replace the interview-specific permission dialog with `RequiredMediaPermissionModal`.
- [ ] Remove device- and phase-specific permission copy and the interview exit action from this dialog.
- [ ] Keep the modal open without raw errors after a failed retry.
- [ ] On successful recovery, reconnect both live tracks and resume only when the interview was running before loss.
- [ ] Verify start-stage recovery returns to the start screen without starting recording.
- [ ] Run the focused view test.

### Task 5: Integrate recovery into the presentation recording view

**Files:**

- Modify: `frontend-vue-main/src/views/presentation/PresentationRecordView.vue`
- Modify: `frontend-vue-main/tests/views/PresentationDeviceGuard.test.js`

- [ ] Replace the presentation-specific permission dialog with `RequiredMediaPermissionModal`.
- [ ] Remove the presentation exit action and permission-specific raw error rendering.
- [ ] Capture whether presentation recording was active before loss.
- [ ] Automatically resume only an active recording after both devices recover; preserve manual pause and start-stage behavior.
- [ ] Run:

```powershell
npx vitest run tests/views/PresentationDeviceGuard.test.js
```

### Task 6: Verify behavior and review the final diff

**Files:**

- Review all files above.

- [ ] Run all related tests together:

```powershell
npx vitest run tests/composables/useCaptureBridge.test.js tests/components/RequiredMediaPermissionModal.test.js tests/views/InterviewRecordMediaControls.test.js tests/views/PresentationDeviceGuard.test.js
```

- [ ] Run the full suite and production build:

```powershell
npm test
npm run build
```

- [ ] Inspect `git diff --check`, `git diff --stat`, and the complete diff for unrelated changes.
- [ ] Verify the rendered permission modal in the local app without claiming camera hardware recovery unless it is manually exercised.
- [ ] Commit the scoped frontend changes; do not push without a separate user request.
