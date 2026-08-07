# Interview Manual Media-Off Start Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent interview start from automatically reopening camera or microphone tracks that the user disabled inside the app.

**Architecture:** Keep the existing interview media lifecycle. Add a pre-start guard before `connectCaptureSources` that separates denied browser permission from intentional in-app OFF state and reuses the presentation warning copy.

**Tech Stack:** Vue 3, Pinia, Vue Test Utils, Vitest

## Global Constraints

- Do not change the existing mid-interview device-loss recovery flow.
- Do not request missing devices when the corresponding in-app control is OFF.
- Keep browser permission-denied handling in the existing permission modal.

---

### Task 1: Add the interview start guard

**Files:**
- Modify: `src/views/interview/InterviewRecordView.vue`
- Test: `tests/views/InterviewRecordMediaControls.test.js`

**Interfaces:**
- Consumes: `camOn`, `micOn`, media permission state, `prepareStartCountdown()`
- Produces: an internal device-OFF warning modal and a guarded start flow

- [x] **Step 1: Write the failing regression test**

Add a test that turns both controls off, clicks `면접 시작`, and asserts that the OFF warning is visible while `requestRequiredDevices` and the recorders are not started.

- [x] **Step 2: Run the focused test and verify RED**

Run: `vitest run tests/views/InterviewRecordMediaControls.test.js`

Expected: FAIL because the current start flow calls `requestRequiredDevices` and does not render an internal-OFF warning.

- [x] **Step 3: Implement the minimal guard**

Expose permission states from `useMediaDevices`, compute the same camera/microphone warning copy used by presentation, and return from `prepareStartCountdown` before `connectCaptureSources` when an in-app control is OFF.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `vitest run tests/views/InterviewRecordMediaControls.test.js`

Expected: all tests in the file pass.

- [x] **Step 5: Verify regression scope**

Run the full Vitest suite and the production Vite build. Confirm `git diff --check` is clean.
