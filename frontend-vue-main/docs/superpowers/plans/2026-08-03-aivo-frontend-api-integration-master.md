# AIVO Frontend API Integration Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the proven interview implementation while completing the real Spring API flow from folder selection through presentation/interview practice, completion, archive reopening, detailed reports, growth trends, support documents, and profile editing.

**Architecture:** Interview and presentation each own their API client, Pinia state, response normalizer, views, graphs, and media controller. No shared report component or shared report view model is introduced. Absolute presentation time is retained at the API boundary and converted to slide-local coordinates only inside the presentation report projection layer.

**Tech Stack:** Vue 3, Pinia, Vue Router, Fetch/FormData, Web Speech API, MediaRecorder, Web Audio PCM/WAV capture, MediaPipe, Vitest, Vue Test Utils, Vite, Spring REST APIs.

## Global Constraints

- Spring contract inspection uses `backend-spring-develop` commit `388c0405c02faeb1e3556cef679c7752c2e091da` unless a newer deployed contract is explicitly supplied.
- Interview behavior is protected against frontend commit `520e2326f3de3ab742e9141fa0cbcac97afe1820`.
- Presentation complete follows `1a9ae107821d957b6a734485d38098bbda798cf0` plus the confirmed `durationMs/text/nonverbal` request.
- Do not introduce shared interview/presentation report components, stores, normalizers, or media controllers.
- Do not add API/MOCK badges, mock fallbacks, fake practice records, fake scores, or derived server identifiers.
- Existing interview detail fixtures remain available to the protected interview screen; archive lists display only real server records.
- Slide revisits and `visitId` are not modeled by the frontend report. The backend supplies one resolved `startTimeSec/endTimeSec` and aggregate feedback per slide.
- API time is presentation-start-relative absolute time: `*Ms` is milliseconds; `*Sec` and `atSec` are seconds.
- Slide-local time is rendering-only: `localSec = absoluteSec - slide.startTimeSec`.
- When a 10-second speech Window crosses a slide boundary, its filler, silence, stutter, and feedback aggregates belong only to the slide containing the Window start. WPM may be clipped for drawing, but counts are never duplicated.
- Q&A has no video recording or answer-time seek.
- Spring/FastAPI changes require separate authorization. Frontend code must expose backend contract gaps instead of guessing.
- Every behavior change follows red-green TDD, then focused regression, full tests, build, and browser verification.

## Confirmed API Boundary

| Capability | Contract |
|---|---|
| Folder list | `GET /api/v1/practice-folders?type={presentation|interview}` |
| Folder create | `POST /api/v1/practice-folders` |
| Folder detail | `GET /api/v1/practice-folders/{folderId}/detail` |
| Folder practices | `GET /api/v1/practice-folders/{folderId}/practices` |
| Presentation create | `POST /api/v1/presentations` multipart |
| Presentation start | `POST /api/v1/presentations/{presentationId}/start` |
| 10-second audio | `POST /api/v1/practices/{practiceId}/audio-analysis` multipart |
| Presentation complete | `POST /api/v1/presentations/{presentationId}/complete` multipart |
| Generate Q&A | `POST /api/v1/presentations/{presentationId}/presentation-questions/generate` |
| List Q&A | `GET /api/v1/presentations/{presentationId}/presentation-questions` |
| Save Q&A answer | `POST /api/v1/presentation-questions/{questionId}/answers` |
| Presentation report | `GET /api/v1/presentations/{presentationId}/presentation-report` |
| Interview report | `GET /api/v1/interviews/{interviewId}/interview-report` |
| Growth trends | `GET /api/v1/practices/trends` |
| Support documents | `/api/v1/resumes`, `/api/v1/portfolios` |
| Profile | `GET/PATCH /api/v1/users/me` |

## Blocking Backend Contract

At commit `388c040...`, the generic folder-practice DTO contains `practiceId` and `type` but not `interviewId` or `presentationId`. These are separate primary keys; `practiceId` must never be substituted into a report URL.

The recommended list item is:

```json
{
  "practiceId": 35,
  "interviewId": 21,
  "presentationId": null,
  "title": "테스트 면접",
  "type": "interview",
  "durationSec": 95,
  "overallScore": 84,
  "createdAt": "2026-08-03T14:00:00"
}
```

Until the backend exposes the domain ID, the row may be displayed but its report link must remain disabled with “상세 보고서 식별자가 없습니다.”

---

### Task 1: Protect the interview baseline

**Files:**
- Inspect: `src/api/interviewApi.js`
- Inspect: `src/stores/interviewStore.js`
- Inspect: `src/views/interview/*.vue`
- Inspect: `src/composables/useFaceAnalysis.js`
- Inspect: `src/composables/useVoicePaceGraph.js`
- Inspect: `src/composables/useGestureGraph.js`
- Test: `tests/architecture/presentationReportIsolation.test.js`

**Produces:** a zero-coupling boundary between interview and presentation report code.

- [ ] Record `git status --short` and `git diff --name-only`; do not reset the dirty worktree.
- [ ] Compare protected interview files with `520e2326...` and classify every difference.
- [ ] Write or update isolation assertions prohibiting interview imports from `components/presentation-report`, presentation stores, and presentation normalizers.
- [ ] Run `npm test -- tests/architecture/presentationReportIsolation.test.js` and verify the intended failure before any correction.
- [ ] Remove only accidental presentation coupling; preserve intentional existing interview logic and fixtures.
- [ ] Re-run the isolation and interview detail tests.
- [ ] Commit as `test: protect interview implementation boundary` only if source changes were required.

### Task 2: Stabilize folder type selection

**Files:**
- Modify: `src/api/practiceApi.js`
- Modify: `src/stores/practiceStore.js`
- Modify: `src/views/practice/FolderSelectView.vue`
- Test: `tests/views/FolderSelectView.test.js`
- Test: `tests/stores/stores.test.js`

**Produces:** `loadFolders(type)` and `createFolder({ title, type })` that cannot lose newly created folders to stale requests.

- [ ] Write failing tests proving presentation sends `type=presentation` and interview sends `type=interview`.
- [ ] Write a failing race test where an older list response resolves after create-and-refresh and must not remove the new folder.
- [ ] Implement request-generation cancellation and keep the newly created folder selected.
- [ ] Persist only a browser-local `folderId -> type` mapping where Spring does not persist type; never persist fake records or scores.
- [ ] Render only folders matching the active type and show real API errors.
- [ ] Run focused tests and commit as `fix: preserve practice folder types`.

### Task 3: Align presentation recording with interview behavior

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Modify: `src/stores/presentationStore.js`
- Modify: `src/api/presentationApi.js`
- Modify: `src/api/practiceApi.js`
- Reuse without changing unless a verified bug exists: `src/utils/pcmWavCapture.js`
- Test: `tests/views/PresentationRecordView.test.js`
- Test: `tests/api/springPresentationApi.test.js`
- Test: `tests/utils/pcmWavCapture.test.js`

**Produces:** presentation-owned STT, MediaPipe collection, 10-second WAV requests, full WAV, full WebM, and absolute timestamps.

- [ ] Write failing tests proving STT accumulation and MediaPipe sampling do not begin before presentation start succeeds.
- [ ] Write failing STT parity tests for `ko-KR`, continuous/interim mode, multi-result concatenation, final accumulation, interim subtitles, and recording-only restart.
- [ ] Write failing PCM tests for 16 kHz mono 16-bit WAV, `sequence=0,1,2...`, final partial flush, one retry, and pending-request drain.
- [ ] Implement the behavior inside presentation files without importing interview views/stores.
- [ ] Render the latest real `audio-analysis` response in the presentation screen; a failed chunk remains visible but does not destroy full recording.
- [ ] Keep slide changes, STT events, gaze events, and tilt buckets in absolute presentation time.
- [ ] Run focused tests and commit as `fix: align presentation recording analysis`.

### Task 4: Complete presentation and Q&A

**Files:**
- Modify: `src/api/presentationApi.js`
- Modify: `src/api/payloads/presentation.js`
- Modify: `src/stores/presentationStore.js`
- Modify: `src/views/presentation/PresentationArtifactsView.vue`
- Modify: `src/views/presentation/PresentationQnaView.vue`
- Test: `tests/api/springPresentationApi.test.js`
- Test: `tests/views/PresentationSlideFlow.test.js`
- Test: `tests/views/PresentationQnaView.test.js`

**Produces:** retryable multipart complete and sequential Q&A answer submission.

- [ ] Write a failing test for exact multipart parts: `request` JSON Blob, full `audio` WAV, and full `video` WebM.
- [ ] Assert request JSON contains `durationMs`, slide-visit `text[]`, and `nonverbal` with `gazeDeviationCount`, `postureTiltPercent`, `sampleCount`, `gazeEvents`, and `tiltBuckets`.
- [ ] Implement shutdown order: stop STT → stop MediaRecorder → flush PCM → await chunk requests → finalize payload → complete.
- [ ] Preserve the same Blob objects and JSON after failure so the user can retry.
- [ ] Write failing Q&A tests for generation only after complete, exact `{ "answer": "full STT transcript" }`, duplicate-submit prevention, answer preservation on failure, and advance only on success.
- [ ] Route directly to report when Q&A is off; generate/list questions and finish all answers before report when Q&A is on.
- [ ] Run focused tests and commit as `feat: complete presentation and qna flow`.

### Task 5: Finish the isolated presentation report

**Files:**
- Modify: `src/api/normalizers/presentationReport.js`
- Modify: `src/views/presentation/PresentationReportDetailView.vue`
- Modify: `src/components/presentation-report/*.vue`
- Modify: `src/composables/usePresentationReportVideo.js`
- Modify only as required: `src/composables/usePresentationVoicePaceGraph.js`
- Modify only as required: `src/composables/usePresentationGestureGraph.js`
- Modify: `src/assets/styles/views/presentation-report.css`
- Test: `tests/api/presentationReportNormalizer.test.js`
- Test: `tests/views/PresentationReportDetailView.test.js`
- Test: `tests/views/PresentationSlideFlow.test.js`
- Test: `tests/components/presentation-report/*.test.js`

**Consumes:** `practice`, `presentation`, `score`, `media`, `audioStt`, `speechAnalysis`, `nonverbalAnalysis.gestureSeries`, `slides`, and `questionAnswers`.

- [ ] Preserve the confirmed nested lookup: `value.nonverbalAnalysis?.gestureSeries ?? value.gestureSeries ?? null`.
- [ ] Preserve `absoluteStartSec/absoluteEndSec` in normalized segments/windows; create local seconds only during slide projection.
- [ ] Keep WPM drawing clipped by overlap, but assign filler/silence/stutter/feedback only to the slide containing the Window start.
- [ ] Bind summary, video URL, slide images, STT by `slideId`, AI feedback text, and Q&A without answer-time seeking.
- [ ] Synchronize video time → current slide, slide click → `startTimeSec`, graph click → `startTimeSec + localSec`.
- [ ] Missing media or analysis empties only its own section; no report-wide mock fallback.
- [ ] Run focused report tests, then manually test video scrub, slide switching, graph seek, feedback, and Q&A.
- [ ] Commit as `feat: connect presentation report contract`.

### Task 6: Load real archive practice lists

**Files:**
- Modify: `src/api/archiveApi.js`
- Modify: `src/api/normalizers/practice.js`
- Modify: `src/stores/archiveStore.js`
- Modify: `src/views/archive/ArchiveView.vue`
- Modify: `src/views/archive/FolderDetailView.vue`
- Modify: `src/assets/styles/views/folder-detail.css`
- Test: `tests/api/archivePracticeApi.test.js`
- Test: `tests/views/ArchiveView.test.js`
- Test: `tests/views/FolderDetailView.test.js`
- Test: `tests/stores/stores.test.js`

**Produces:** real presentation/interview rows and type-correct report links.

- [ ] Delete the frontend branch that forces interview practices to `[]` and remove the false “interview list API does not exist” test/copy.
- [ ] Write failing tests for `GET /practice-folders/{folderId}/practices?page=0&sort=latest`, attempt count, nullable scores, and no fabricated history.
- [ ] Require `interviewId` for interview rows and `presentationId` for presentation rows; never substitute `practiceId`.
- [ ] Route interview rows to `/interview/report/detail?id={interviewId}` and presentation rows to `/archive/detail?presentationId={presentationId}`.
- [ ] Disable only rows missing a domain ID and display an explicit identifier error.
- [ ] Render server count, duration, and score only; missing score remains unavailable.
- [ ] Run focused tests and commit as `feat: reopen real practice reports from archive`.

### Task 7: Reopen interview reports without changing their screen

**Files:**
- Verify: `src/api/interviewApi.js`
- Verify: `src/stores/interviewStore.js`
- Verify: `src/views/interview/InterviewReportDetailView.vue`
- Modify only the caller: `src/views/archive/FolderDetailView.vue`
- Test: `tests/views/InterviewReportDetailView.test.js`
- Test: `tests/views/FolderDetailView.test.js`

**Produces:** real archive navigation to the existing `GET /interviews/{interviewId}/interview-report` flow.

- [ ] Write a failing navigation test proving the exact `interviewId`, not `practiceId`, reaches the route.
- [ ] Mount the existing detail route with a complete API DTO and assert the same major UI sections as the protected fixture path.
- [ ] Make only the archive-link change; do not refactor interview report production code.
- [ ] Run interview detail, archive, and isolation tests.
- [ ] Commit as `fix: reopen interview reports from archive`.

### Task 8: Connect unified growth trends

**Files:**
- Modify: `src/api/userApi.js`
- Create/modify: `src/api/normalizers/trends.js`
- Modify: `src/views/mypage/MyPageTrendView.vue`
- Modify: `src/assets/styles/views/mypage-refresh.css`
- Test: `tests/api/practiceTrendsApi.test.js`
- Test: `tests/api/trendsNormalizer.test.js`
- Test: `tests/views/MyPageTrendView.test.js`

**Produces:** unified content/body/voice history, six metrics, strength/weakness summaries, and honest insufficient-history states.

- [ ] Lock `GET /api/v1/practices/trends` and preserve missing values as `null`, never zero.
- [ ] Normalize higher-is-better for content/stability and lower-is-better for glance/filler/speed variation/time error.
- [ ] Render only `contentScore`, `videoScore`, and `voiceScore` history; remove presentation/interview tabs.
- [ ] Implement 0 records as empty; 1–3 as current values plus gray dashed “비교할 이전 기록이 부족해요”; 4–5 as actual previous 1–2 versus latest 3; 6+ as previous 3 versus latest 3.
- [ ] Derive relative strengths and priorities without inventing AI causes.
- [ ] Render average/early/late WPM and silence as neutral references.
- [ ] Run focused tests and commit as `feat: connect unified practice growth trends`.

### Task 9: Finish documents and profile

**Files:**
- Modify: `src/stores/documentsStore.js`
- Modify: `src/views/mypage/MyPageDocumentsView.vue`
- Modify: `src/views/mypage/MyPageDocumentDetailView.vue`
- Modify: `src/api/userApi.js`
- Modify: `src/stores/authStore.js`
- Modify: `src/views/mypage/MyPageView.vue`
- Modify: `src/assets/styles/views/mypage-refresh.css`
- Test: `tests/api/supportDocumentsApi.test.js`
- Test: `tests/api/userProfileApi.test.js`
- Test: `tests/views/MyPageView.test.js`
- Test: `tests/stores/stores.test.js`

**Produces:** real resume/portfolio management and profile editing without Google mock UI.

- [ ] Test resume and portfolio list/detail/upload/edit/delete paths and multipart fields independently.
- [ ] Preserve a successful category if the other category fails; fail the entire page only when both fail.
- [ ] Keep new-document choices to resume and portfolio. Presentation upload remains in the presentation setup flow.
- [ ] Test profile multipart with JSON `request` plus optional `profileImage`.
- [ ] Validate JPEG/PNG/WebP up to 5 MiB, preview selection, revoke object URLs, restore on cancel, remove image, and update auth state only after success.
- [ ] Remove Google account mock cards and fake linked-account state.
- [ ] Run focused tests and commit as `feat: connect documents and profile APIs`.

### Task 10: Full-system verification and deployment readiness

**Files:**
- Modify contract documentation only when verified behavior differs: `docs/api-specification.md`, `docs/frontend-specification.md`
- Do not modify backend production files.

- [ ] Run the full `npm test` suite and require zero failures.
- [ ] Run `npm run build` and require Vite exit code 0.
- [ ] Verify the selected environment points to the intended deployed Spring server, adds the Bearer token, and handles 401 by clearing the session.
- [ ] Browser-test: login → presentation folder → upload → slides → device check → start → STT/MediaPipe → 10-second WAV → complete → optional Q&A → report → reopen from archive.
- [ ] Browser-test: login → interview folder → interview flow → report → reopen the same report from archive; verify the protected UI is unchanged.
- [ ] Browser-test growth trends for 0, 1–3, 4–5, and 6+ records.
- [ ] Browser-test document partial failures and profile image add/remove.
- [ ] Run `git diff --check` and `git status --short`; ensure backend folders, `dist`, logs, runtimes, and dependency directories are not staged.
- [ ] Report implemented, automated-verified, browser-verified, backend-blocked, and unverified-deployment items separately.

## Execution Order and Gates

1. Protect the interview boundary before all other work.
2. Complete folder selection and presentation recording/complete before real report/archive end-to-end tests.
3. The presentation report can use controlled fixtures, but archive reopening requires real domain IDs.
4. Archive/interview reopening must stop at the documented backend domain-ID gate; no frontend ID guessing is permitted.
5. Growth trends and documents/profile are independent after interview protection and may proceed alongside presentation work only if edits do not overlap.
6. Full-system verification begins after every focused suite passes.

## Self-Review Results

- Coverage: folder types, presentation STT/MediaPipe, WAV chunks, complete, Q&A, both report types, archive reopening, trends, documents, profile, and deployment checks are assigned.
- Contract consistency: `practiceId`, `presentationId`, and `interviewId` remain distinct.
- Time consistency: API values remain absolute; local time exists only in presentation report rendering.
- Isolation: no task creates shared interview/presentation report code.
- Data honesty: no task fabricates records, scores, timestamps, or identifiers.
