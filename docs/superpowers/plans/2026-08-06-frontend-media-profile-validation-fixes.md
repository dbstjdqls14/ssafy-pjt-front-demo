# Frontend Media, Profile, and Validation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the six confirmed frontend defects without changing the backend contract.

**Architecture:** Keep fixes local to presentation capture, report media ownership, profile URL refresh, shared validation, and interview answer-capture lifecycle. Use stable domain IDs and request generations instead of global remounts or random cache-busting URLs.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue Router, Vitest, Vue Test Utils, MediaStream APIs

## Global Constraints

- Preserve all pre-existing uncommitted user changes.
- Do not key the global RouterView by `fullPath`.
- Do not append random timestamps to presigned URLs.
- Keep backend request and response field names unchanged.
- Run tests with the bundled workspace Node runtime when system Node is unavailable.
- Do not create a Git commit in the existing dirty worktree.

---

### Task 1: Camera framing and slide zoom

**Files:**
- Modify: `src/composables/useMediaDevices.js`
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Modify: `src/composables/useCaptureBridge.js`
- Modify: `src/assets/styles/views/presentation-check.css`
- Modify: `src/assets/styles/views/presentation-record.css`
- Modify: `src/components/presentation/PresentationSlideZoomControl.vue`
- Test: `tests/views/PresentationDeviceGuard.test.js`
- Test: `tests/composables/useCaptureBridge.test.js`
- Test: `tests/components/PresentationSlideZoomControl.test.js`

**Interfaces:**
- Consumes: `INTERVIEW_MEDIA_CONSTRAINTS`, `requestVideo`, `requestRequiredDevices`.
- Produces: identical camera constraints and aspect-preserving canvas placement; zoom values from 0.6 through 2.4.

- [ ] Write a failing test asserting presentation recording requests the shared 1280×720 constraints.
- [ ] Run the focused test and confirm it fails because recording currently passes `true`.
- [ ] Change initial acquisition and recovery to use the shared constraint object.
- [ ] Write a failing capture-bridge test asserting a 4:3 source is letterboxed in a 16:9 canvas.
- [ ] Implement centered contain-fit `drawImage` coordinates.
- [ ] Write and run a zoom-control test for 60% lower bound and 100% reset.
- [ ] Consolidate final camera CSS rules and run the focused tests.

### Task 2: Presentation report media ownership

**Files:**
- Modify: `src/stores/presentationStore.js`
- Modify: `src/views/presentation/PresentationReportDetailView.vue`
- Modify: `src/components/presentation-report/PresentationReportVideoPanel.vue`
- Modify: `src/composables/usePresentationReportVideo.js`
- Test: `tests/views/PresentationReportDetailView.test.js`
- Test: `tests/components/presentation-report/PresentationReportVideoPanel.test.js`

**Interfaces:**
- Consumes: route presentation ID and backend `media.video.videoId/playbackUrl`.
- Produces: `loadReport(id)` that ignores stale requests and a stable media key used to reset video state.

- [ ] Write a failing route-switch test that resolves request B before request A and expects report B to remain visible.
- [ ] Add request generation and requested report ownership to the store.
- [ ] Replace mount-only loading with an immediate route-ID watcher that clears the view before loading.
- [ ] Write a failing video-panel test that changes media key and expects time, playback, and selected segment to reset.
- [ ] Key the video element and reset the controller on media-key change.
- [ ] Run all presentation report tests.

### Task 3: Interview report Blob and route lifecycle

**Files:**
- Modify: `src/stores/interviewStore.js`
- Modify: `src/views/interview/InterviewReportDetailView.vue`
- Test: `tests/views/InterviewReportDetailView.test.js`
- Test: `tests/stores/interviewStore.test.js`

**Interfaces:**
- Consumes: completed interview ID, local video Blob, report `video.url/videoUrl/recordingUrl`.
- Produces: `sessionVideoOwnerId` and route-scoped playback URL selection.

- [ ] Write a failing store test showing a Blob recorded for interview A must not be selected for report B.
- [ ] Store the Blob owner ID when recording finishes and clear it on reset.
- [ ] Write a failing route-switch test asserting the old Object URL is revoked and the new server URL is selected.
- [ ] Replace split mount/watch behavior with one immediate watcher that resets selection, playback URL, feedback, and request ownership.
- [ ] Add request generation to `loadReport` and ignore stale responses.
- [ ] Key the interview video by report/media identity and run focused tests.

### Task 4: Profile refresh and shared nickname validation

**Files:**
- Modify: `src/stores/authStore.js`
- Modify: `src/components/common/AppHeader.vue`
- Modify: `src/views/mypage/MyPageView.vue`
- Test: `tests/components/AppHeaderProfileRefresh.test.js`
- Test: `tests/views/MyPageView.test.js`

**Interfaces:**
- Consumes: `/users/me` fresh presigned URL and `usernameValidationMessage(value)`.
- Produces: current profile image identity and signup-equivalent edit validation.

- [ ] Write a failing MyPage test that mounts with a stored URL and expects `loadMe()` to refresh it.
- [ ] Refresh the profile on MyPage entry without discarding an in-progress edit.
- [ ] Write a failing profile-error test that allows a renewed image identity to render after an earlier failure.
- [ ] Scope header failure state to the current image identity and preserve single-flight refresh.
- [ ] Write a failing nickname test for special characters and short values.
- [ ] Replace local length-only validation with `usernameValidationMessage()` and run focused tests.

### Task 5: TTS-gated face analysis and complete nonverbal summary

**Files:**
- Modify: `src/composables/useFaceAnalysis.js`
- Modify: `src/views/interview/InterviewRecordView.vue`
- Test: `tests/composables/useFaceAnalysis.test.js`
- Test: `tests/views/InterviewRecordMediaControls.test.js`
- Test: `tests/views/InterviewRecordInterlock.test.js`
- Test: `tests/views/PresentationDeviceGuard.test.js`

**Interfaces:**
- Consumes: `pause()`, `resume(video)`, answer-capture gates, active face samples.
- Produces: pause-safe analysis timing and `{ gazeDeviationCount, postureTiltPercent, sampleCount, gazeEvents, tiltBuckets }`.

- [ ] Update all existing composable mocks with `pause` and `resume` so the baseline suite runs.
- [ ] Write a failing composable test asserting paused time is excluded and summary includes sample count and posture percentage.
- [ ] Implement active sample totals and the complete backend-supported summary.
- [ ] Write a failing record-view test asserting TTS pauses face analysis before speech and resumes only after completion.
- [ ] Ensure first-question analysis starts through the same TTS-gated resume path.
- [ ] Run all interview recording and device-loss tests.

### Task 6: Full verification

**Files:**
- Inspect: all modified source, tests, and the two planning documents.

**Interfaces:**
- Consumes: completed tasks 1–5.
- Produces: evidence-backed handoff with verified and unverified items separated.

- [ ] Run the focused regression suite for all six defects.
- [ ] Run the complete Vitest suite.
- [ ] Run ESLint.
- [ ] Run the production build.
- [ ] Inspect `git diff --check`, `git diff --stat`, and the final scoped diff.
- [ ] Report browser/camera scenarios that still require physical-device verification.
