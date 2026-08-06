# Recording Permission Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Prevent interview recording from entering a started state when camera or microphone permission is blocked, cover permission loss during the five-second countdown, sanitize permission errors in interview and presentation, and remove the trailing period from presentation practice dates.

**Architecture:** Keep device acquisition in `useMediaDevices` and view-specific recording orchestration in the record views. Treat live media tracks—not permission query results—as the final start invariant. Reuse the existing device-blocking modals and runtime loss callbacks.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest, Vue Test Utils, MediaDevices API.

**Constraints:** Browser-denied permissions cannot be programmatically changed. Preserve the existing mid-recording pause/recovery behavior and all unrelated dirty-worktree changes. Do not change backend code.

---

### Task 1: Add failing interview start-boundary tests

**Files:**
- Modify: `tests/views/InterviewRecordMediaControls.test.js`

**Steps:**
1. Add a test where the initial required-device request rejects with `NotAllowedError`; assert no recording start, no recorder start, a Korean permission modal, and no raw English error.
2. Add a test where a device-loss callback fires during the five-second countdown; assert countdown cancellation and no recording start.
3. Run the focused test and confirm both cases fail with the current ordering.

### Task 2: Guard the interview start and countdown

**Files:**
- Modify: `src/views/interview/InterviewRecordView.vue`

**Steps:**
1. Add a start-phase marker and user-friendly permission-error mapping.
2. Request and validate required devices before beginning the countdown.
3. Handle device loss while starting by cancelling the countdown and showing the start-phase modal.
4. Revalidate and connect live tracks when the countdown completes, before starting Store/recorders.
5. Reuse the recovery button and allow a successful retry to return to the ready-to-start state without auto-starting.
6. Run the focused tests.

### Task 3: Sanitize presentation permission recovery errors

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Modify: `tests/views/PresentationDeviceGuard.test.js`

**Steps:**
1. Add a retry-failure test proving browser error text is not rendered and site-settings guidance remains visible.
2. Run it and confirm failure.
3. Replace raw permission messages with a Korean recovery message while retaining non-permission errors.
4. Run the focused test.

### Task 4: Remove the report-date trailing period

**Files:**
- Modify: `src/components/presentation-report/PresentationReportSummary.vue`
- Modify: `tests/components/presentation-report/PresentationReportSummary.test.js`

**Steps:**
1. Add an assertion for `2026.08.03` and rejection of `2026.08.03.`.
2. Run it and confirm failure.
3. Strip only the final period from the formatted date.
4. Run the focused test.

### Task 5: Verify regression safety

**Steps:**
1. Run all affected tests together.
2. Run the full Vitest suite and production build.
3. Review `git diff --check`, status, and scoped diffs.
4. Start the local Vite server and verify the accessible permission/date UI paths in the browser; report any flow that cannot be exercised without changing browser permissions manually.
