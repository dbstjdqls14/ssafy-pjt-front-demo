# Separated Presentation Complete and Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the interview implementation exactly at `520e2326f3de3ab742e9141fa0cbcac97afe1820` while implementing the fixed presentation Complete multipart contract and a presentation-only report screen.

**Architecture:** Restore the explicitly protected interview files from the baseline commit and forbid presentation imports from interview or shared report modules. Presentation recording keeps the existing `PcmWavCapture` and Chrome STT flow, transforms measured samples into the fixed `nonverbal` payload, and sends `request`, `audio`, and `video` multipart parts. The report uses a standalone presentation normalizer, presentation-only graph composables, presentation-only components, and the presentation report API.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue Router, Vitest, Vue Test Utils, Fetch API, FormData, MediaRecorder, Web Audio PCM/WAV.

## Global Constraints

- Frontend changes only; do not modify Spring, FastAPI, or database files.
- The 16 protected interview files must have zero diff from `520e2326f3de3ab742e9141fa0cbcac97afe1820`.
- Do not create or use shared interview/presentation report components, models, graph composables, or video controllers.
- Presentation Complete is `POST /api/v1/presentations/{presentationId}/complete` with multipart parts named exactly `request`, `audio`, and `video`.
- The request JSON contains exactly `durationMs`, `text`, and `nonverbal` at the top level.
- Do not implement `visitId`, `slides[].visits`, slide-revisit inference, Q&A video seeking, transcript highlighting, API/MOCK badges, or report Mock fallback.
- Treat `gestureSeries` as optional until Spring includes it in the presentation report response.
- Preserve unrelated dirty worktree changes and stage only files owned by each task.

---

### Task 1: Restore and lock the interview baseline

**Files:**
- Restore: `src/api/interviewApi.js`
- Restore: `src/stores/interviewStore.js`
- Restore: `src/views/interview/InterviewSetupView.vue`
- Restore: `src/views/interview/InterviewCheckView.vue`
- Restore: `src/views/interview/InterviewRecordView.vue`
- Restore: `src/views/interview/InterviewAnalyzingView.vue`
- Restore: `src/views/interview/InterviewReportView.vue`
- Restore: `src/views/interview/InterviewReportDetailView.vue`
- Restore: `src/composables/useFaceAnalysis.js`
- Restore: `src/composables/useVoicePaceGraph.js`
- Restore: `src/composables/useGestureGraph.js`
- Restore: `src/utils/interviewEvidence.js`
- Restore: `src/utils/interviewTimeline.js`
- Restore: `src/utils/interviewReportScores.js`
- Restore: `src/assets/styles/views/interview-flow.css`
- Restore: `src/assets/styles/views/interview-report.css`

**Interfaces:**
- Consumes: Git object `520e2326f3de3ab742e9141fa0cbcac97afe1820:frontend-vue-main/<path>`.
- Produces: exact interview source baseline; no presentation code may modify these files later.

- [ ] **Step 1: Record the protected file list in a PowerShell variable**

```powershell
$protected = @(
  'src/api/interviewApi.js',
  'src/stores/interviewStore.js',
  'src/views/interview/InterviewSetupView.vue',
  'src/views/interview/InterviewCheckView.vue',
  'src/views/interview/InterviewRecordView.vue',
  'src/views/interview/InterviewAnalyzingView.vue',
  'src/views/interview/InterviewReportView.vue',
  'src/views/interview/InterviewReportDetailView.vue',
  'src/composables/useFaceAnalysis.js',
  'src/composables/useVoicePaceGraph.js',
  'src/composables/useGestureGraph.js',
  'src/utils/interviewEvidence.js',
  'src/utils/interviewTimeline.js',
  'src/utils/interviewReportScores.js',
  'src/assets/styles/views/interview-flow.css',
  'src/assets/styles/views/interview-report.css'
)
```

- [ ] **Step 2: Restore only the protected files from the baseline tree**

```powershell
git restore --source 520e2326f3de3ab742e9141fa0cbcac97afe1820 -- $protected
```

- [ ] **Step 3: Verify the protected files are byte-for-byte equivalent**

Run:

```powershell
git diff --exit-code 520e2326f3de3ab742e9141fa0cbcac97afe1820 -- $protected
```

Expected: exit code 0 and no diff output.

- [ ] **Step 4: Run the interview-focused tests available at the baseline**

Run:

```powershell
npm test -- tests/views/InterviewReportDetailView.test.js tests/utils/interviewReportScores.test.js
```

Expected: all selected tests pass. If a current test asserts post-baseline shared-report behavior, remove that post-baseline test instead of editing protected interview production files.

- [ ] **Step 5: Commit only the protected baseline restoration**

```powershell
git add -- $protected
git commit -m "fix: restore protected interview baseline"
```

### Task 2: Implement the fixed presentation Complete multipart API

**Files:**
- Modify: `tests/api/springPresentationApi.test.js`
- Modify: `src/api/presentationApi.js`

**Interfaces:**
- Consumes: `{ request, audio, video }`, where `request` is the JSON DTO and `audio`/`video` are Blob or File objects.
- Produces: `presentationApi.complete(presentationId, payload): Promise<unknown>` sending a `FormData` body.

- [ ] **Step 1: Replace the JSON Complete assertion with a failing multipart contract test**

```js
it('completes a presentation with request, WAV, and WebM multipart parts', async () => {
  const request = {
    durationMs: 22_000,
    text: [{ page: 1, timestamp: 0, content: '발표를 시작합니다.' }],
    nonverbal: {
      gazeDeviationCount: 1,
      postureTiltPercent: 25,
      sampleCount: 4,
      gazeEvents: [{ atSec: 3.2 }],
      tiltBuckets: [{ startSec: 0, endSec: 10, tiltPct: 25 }],
    },
  }
  const audio = new Blob(['wav'], { type: 'audio/wav' })
  const video = new Blob(['webm'], { type: 'video/webm' })

  await presentationApi.complete(7, { request, audio, video })

  const { url, options } = latestRequest()
  expect(url).toBe('/api/v1/presentations/7/complete')
  expect(options.method).toBe('POST')
  expect(options.body).toBeInstanceOf(FormData)
  await expect(options.body.get('request').text()).resolves.toBe(JSON.stringify(request))
  expect(options.body.get('audio')).toMatchObject({ name: 'presentation-7.wav', type: 'audio/wav' })
  expect(options.body.get('video')).toMatchObject({ name: 'presentation-7.webm', type: 'video/webm' })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/api/springPresentationApi.test.js`

Expected: FAIL because the current implementation serializes `{ durationMs }` as JSON.

- [ ] **Step 3: Implement the minimal multipart builder**

```js
const createCompleteFormData = (presentationId, { request, audio, video }) => {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  formData.append('audio', audio, `presentation-${presentationId}.wav`)
  formData.append('video', video, `presentation-${presentationId}.webm`)
  return formData
}

complete(presentationId, payload) {
  return post(`/presentations/${presentationId}/complete`, createCompleteFormData(presentationId, payload))
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- tests/api/springPresentationApi.test.js`

Expected: all tests in the file pass.

- [ ] **Step 5: Commit the API contract**

```powershell
git add src/api/presentationApi.js tests/api/springPresentationApi.test.js
git commit -m "feat: send presentation complete multipart payload"
```

### Task 3: Build measured presentation text and nonverbal artifacts

**Files:**
- Modify: `tests/utils/presentationArtifacts.test.js`
- Modify: `src/utils/presentationArtifacts.js`
- Modify: `tests/stores/springPresentationFlow.test.js`
- Modify: `src/stores/presentationStore.js`
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Modify: `src/views/presentation/PresentationArtifactsView.vue`

**Interfaces:**
- Consumes: per-sample `{ timestamp, postureScore, gazeScore, poseDetected, faceDetected }`, `durationMs`, slide timeline, and Chrome STT transcript events.
- Produces: `PresentationDetectionAccumulator.finishNonverbal(durationMs)` returning the exact `nonverbal` DTO and `recordingArtifacts` containing `{ webm, wav, text, nonverbal, durationMs }`.

- [ ] **Step 1: Add a failing nonverbal aggregation test**

```js
it('builds the complete nonverbal DTO from measured samples', () => {
  const accumulator = new PresentationDetectionAccumulator()
  accumulator.add({ timestamp: 0, postureScore: 100, gazeScore: 100, faceDetected: true })
  accumulator.add({ timestamp: 2_000, postureScore: 0, gazeScore: 0, faceDetected: true })
  accumulator.add({ timestamp: 4_000, postureScore: 0, gazeScore: 0, faceDetected: true })
  accumulator.add({ timestamp: 12_000, postureScore: 100, gazeScore: 100, faceDetected: true })

  expect(accumulator.finishNonverbal(20_000)).toEqual({
    gazeDeviationCount: 1,
    postureTiltPercent: 50,
    sampleCount: 4,
    gazeEvents: [{ atSec: 2 }],
    tiltBuckets: [
      { startSec: 0, endSec: 10, tiltPct: 66.7 },
      { startSec: 10, endSec: 20, tiltPct: 0 },
    ],
  })
})
```

- [ ] **Step 2: Run the utility test and verify RED**

Run: `npm test -- tests/utils/presentationArtifacts.test.js`

Expected: FAIL because `finishNonverbal` does not exist.

- [ ] **Step 3: Add measured counters without changing interview code**

```js
// Per accumulator:
this.sampleCount = 0
this.tiltedSampleCount = 0
this.gazeEvents = []

// Per 10-second window:
window.postureSampleCount += 1
if (postureScore < this.postureThreshold) window.tiltedSampleCount += 1

// On a new side-glance transition:
this.gazeEvents.push({ atSec: roundOne(at / 1000) })

finishNonverbal(durationMs) {
  const windows = this.finish(durationMs)
  return {
    gazeDeviationCount: this.gazeEvents.length,
    postureTiltPercent: this.sampleCount
      ? roundOne((this.tiltedSampleCount / this.sampleCount) * 100)
      : 0,
    sampleCount: this.sampleCount,
    gazeEvents: [...this.gazeEvents],
    tiltBuckets: windows.map((window) => ({
      startSec: window.timestamp / 1000,
      endSec: Math.min(durationMs, window.timestamp + this.windowDurationMs) / 1000,
      tiltPct: window.postureSampleCount
        ? roundOne((window.tiltedSampleCount / window.postureSampleCount) * 100)
        : 0,
    })),
  }
}
```

Expose the internal per-window sample counts only to `finishNonverbal`; keep the existing `finish()` shape stable for existing artifact tests.

- [ ] **Step 4: Run the utility test and verify GREEN**

Run: `npm test -- tests/utils/presentationArtifacts.test.js`

Expected: all tests pass.

- [ ] **Step 5: Add a failing store test for the full Complete payload**

```js
expect(completeSpy).toHaveBeenCalledWith(12, {
  request: {
    durationMs: 20_000,
    text: [{ page: 1, timestamp: 0, content: '발표 내용' }],
    nonverbal,
  },
  audio: wavBlob,
  video: webmBlob,
})
```

The test must also assert that a blank transcript item is removed so Spring's `@NotBlank content` validation cannot reject the request.

- [ ] **Step 6: Run the store test and verify RED**

Run: `npm test -- tests/stores/springPresentationFlow.test.js`

Expected: FAIL because `completeSession` currently sends only a duration.

- [ ] **Step 7: Store and send `nonverbal` instead of `detects`**

```js
recordingArtifacts.value = {
  webm: webmBlob,
  wav: wavBlob,
  text: resolvedText.filter((item) => String(item.content ?? '').trim()),
  nonverbal,
  durationMs: safeDurationMs,
}

await presentationApi.complete(sessionId.value, {
  request: {
    durationMs: safeDuration,
    text: recordingArtifacts.value.text,
    nonverbal: recordingArtifacts.value.nonverbal,
  },
  audio: recordingArtifacts.value.wav,
  video: recordingArtifacts.value.webm,
})
```

In `PresentationRecordView.vue`, call `detectionAccumulator.finishNonverbal(durationMs)` after the WAV and WebM promises resolve. In `PresentationArtifactsView.vue`, label the JSON preview `NONVERBAL` and display the stored object rather than `detects`.

- [ ] **Step 8: Run utility, store, and artifact view tests**

Run:

```powershell
npm test -- tests/utils/presentationArtifacts.test.js tests/stores/springPresentationFlow.test.js tests/views/PresentationArtifactsView.test.js
```

Expected: all selected tests pass.

- [ ] **Step 9: Commit the recording payload integration**

```powershell
git add src/utils/presentationArtifacts.js src/stores/presentationStore.js src/views/presentation/PresentationRecordView.vue src/views/presentation/PresentationArtifactsView.vue tests/utils/presentationArtifacts.test.js tests/stores/springPresentationFlow.test.js tests/views/PresentationArtifactsView.test.js
git commit -m "feat: build presentation complete artifacts"
```

### Task 4: Replace the common/revisit report model with a presentation-only normalizer

**Files:**
- Modify: `tests/api/presentationReportNormalizer.test.js`
- Modify: `src/api/normalizers/presentationReport.js`

**Interfaces:**
- Consumes: the fixed presentation report response with `practice`, `presentation`, `score`, `media`, `audioStt`, `speechAnalysis`, `slides`, `questionAnswers`, and optional `gestureSeries`.
- Produces: a standalone report object preserving those domain keys and normalized `slides[]`; it does not import `practiceReport.js` and never creates `ranges`, `visits`, or `visitId`.

- [ ] **Step 1: Rewrite the normalizer fixture to use one contiguous range per slide**

```js
slides: [
  { slideId: 101, slideNumber: 1, startTimeSec: 0, endTimeSec: 12, feedback: { content: '목적을 명확하게 설명했습니다.' } },
  { slideId: 102, slideNumber: 2, startTimeSec: 12, endTimeSec: 22, feedback: { content: '기능을 명확하게 설명했습니다.' } },
]
```

Assert:

```js
expect(report.slides[0]).toMatchObject({ startTimeSec: 0, endTimeSec: 12, durationSec: 12 })
expect(report.slides[0]).not.toHaveProperty('visits')
expect(report.slides[0]).not.toHaveProperty('ranges')
expect(JSON.stringify(report)).not.toContain('visitId')
```

- [ ] **Step 2: Add failing projection assertions**

```js
expect(report.slides[0].speech.buckets).toEqual([
  expect.objectContaining({ startSec: 0, endSec: 10, averageWpm: 118 }),
  expect.objectContaining({ startSec: 10, endSec: 12, averageWpm: 139 }),
])
expect(report.slides[1].speech.buckets[0]).toMatchObject({ startSec: 0, endSec: 8, averageWpm: 139 })
expect(report.slides[0].transcriptSegments[0]).toMatchObject({ text: '첫 슬라이드', startSec: 0.8, endSec: 4.2 })
expect(report.slides[0].gesture).toBeNull()
```

- [ ] **Step 3: Run the normalizer test and verify RED**

Run: `npm test -- tests/api/presentationReportNormalizer.test.js`

Expected: FAIL because the current normalizer creates shared `sections` and revisit ranges.

- [ ] **Step 4: Implement standalone interval clipping**

```js
const clipInterval = (absoluteStartSec, absoluteEndSec, slideStartSec, slideEndSec) => {
  const start = Math.max(absoluteStartSec, slideStartSec)
  const end = Math.min(absoluteEndSec, slideEndSec)
  return end > start
    ? { startSec: start - slideStartSec, endSec: end - slideStartSec }
    : null
}
```

Map WPM windows, transcript segments by `slideId`, and optional gesture buckets/events into each slide's local time. Keep `averageWpm`, `fillerCount`, `silenceDetected`, and `silenceDurationMs` as received. Do not fabricate precise filler or silence events.

- [ ] **Step 5: Run the normalizer test and verify GREEN**

Run: `npm test -- tests/api/presentationReportNormalizer.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit the standalone normalizer**

```powershell
git add src/api/normalizers/presentationReport.js tests/api/presentationReportNormalizer.test.js
git commit -m "refactor: isolate presentation report normalizer"
```

### Task 5: Add presentation-only voice and gesture graph engines

**Files:**
- Create: `src/composables/usePresentationVoicePaceGraph.js`
- Create: `src/composables/usePresentationGestureGraph.js`
- Create: `tests/composables/usePresentationVoicePaceGraph.test.js`
- Create: `tests/composables/usePresentationGestureGraph.test.js`

**Interfaces:**
- Consumes: local slide speech buckets in WPM and optional local slide gesture buckets/events.
- Produces: SVG paths, marker positions, bounds, average labels, and local-second projection helpers used only by presentation report components.

- [ ] **Step 1: Write failing graph tests**

```js
expect(graph.sortedBuckets.value.map((item) => item.startSec)).toEqual([0, 10])
expect(graph.paceMarkers.value[0].pace).toBe('118 WPM')
expect(graph.fillerWindows.value[0]).toMatchObject({ startSec: 0, endSec: 10, count: 2 })
expect(graph.silenceWindows.value[0]).toMatchObject({ durationMs: 2300 })
```

```js
expect(graph.sortedBuckets.value.map((item) => item.tiltPercent)).toEqual([10, 20])
expect(graph.gazeDotPositions.value[0].xPct).toBe(25)
expect(graph.avgTiltPct.value).toBe(15)
```

- [ ] **Step 2: Run the graph tests and verify RED**

Run:

```powershell
npm test -- tests/composables/usePresentationVoicePaceGraph.test.js tests/composables/usePresentationGestureGraph.test.js
```

Expected: FAIL because the presentation-only composables do not exist.

- [ ] **Step 3: Copy the baseline graph mechanics into presentation-only modules**

Use the coordinate, sorting, step-path, drag, and marker formulas from the baseline interview graph composables, but expose presentation names and WPM labels. The minimum exported shape is:

```js
export function usePresentationVoicePaceGraph(seriesRef, durationSecRef) {
  const sortedBuckets = computed(() => [...(seriesRef.value?.buckets ?? [])]
    .sort((left, right) => left.startSec - right.startSec))
  const fillerWindows = computed(() => sortedBuckets.value
    .filter((bucket) => bucket.fillerCount > 0)
    .map((bucket) => ({
      startSec: bucket.startSec,
      endSec: bucket.endSec,
      count: bucket.fillerCount,
    })))
  const silenceWindows = computed(() => sortedBuckets.value
    .filter((bucket) => bucket.silenceDetected)
    .map((bucket) => ({
      startSec: bucket.startSec,
      endSec: bucket.endSec,
      durationMs: bucket.silenceDurationMs,
    })))
  return { sortedBuckets, fillerWindows, silenceWindows, paceMarkers, paceChartPath, paceYFor, pcOfSec }
}

export function usePresentationGestureGraph(seriesRef, durationSecRef) {
  const sortedBuckets = computed(() => [...(seriesRef.value?.buckets ?? [])]
    .sort((left, right) => left.startSec - right.startSec))
  const avgTiltPct = computed(() => sortedBuckets.value.length
    ? Math.round(sortedBuckets.value.reduce((sum, bucket) => sum + bucket.tiltPercent, 0) / sortedBuckets.value.length)
    : 0)
  return { sortedBuckets, avgTiltPct, gazeDotPositions, tiltLinePath, tiltYFor, pcOfSec }
}
```

`paceMarkers`, `paceChartPath`, `paceYFor`, `pcOfSec`, `gazeDotPositions`, `tiltLinePath`, and `tiltYFor` use the complete formulas from the baseline files; rename every exported symbol to the presentation namespace so the presentation report cannot import the protected baseline modules.

Remove mock-series builders from the presentation modules. A missing series must remain missing. Voice markers must show `${averageWpm} WPM`, not syllables per second.

- [ ] **Step 4: Run the graph tests and verify GREEN**

Run:

```powershell
npm test -- tests/composables/usePresentationVoicePaceGraph.test.js tests/composables/usePresentationGestureGraph.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit the presentation graph engines**

```powershell
git add src/composables/usePresentationVoicePaceGraph.js src/composables/usePresentationGestureGraph.js tests/composables/usePresentationVoicePaceGraph.test.js tests/composables/usePresentationGestureGraph.test.js
git commit -m "feat: add presentation report graph engines"
```

### Task 6: Build the presentation-only report UI and video controller

**Files:**
- Create: `src/composables/usePresentationReportVideo.js`
- Create: `src/components/presentation-report/PresentationReportSummary.vue`
- Create: `src/components/presentation-report/PresentationReportAnalysis.vue`
- Create: `src/components/presentation-report/PresentationReportVideoPanel.vue`
- Create: `src/views/presentation/PresentationReportDetailView.vue`
- Create: `src/assets/styles/views/presentation-report.css`
- Modify: `src/router/modules/archiveRoutes.js`
- Modify: `tests/views/PresentationReportView.test.js`
- Create: `tests/components/presentation-report/PresentationReportAnalysis.test.js`
- Create: `tests/components/presentation-report/PresentationReportVideoPanel.test.js`

**Interfaces:**
- Consumes: `presentation.report` from `presentationStore.loadReport(presentationId)`, with `slides[]` from Task 4.
- Produces: the report route `/archive/detail/:id?`, slide-local graph/video synchronization, slide selection, feedback text, and non-seeking Q&A feedback.

- [ ] **Step 1: Write a failing report view test**

Mount `PresentationReportDetailView` with a Pinia store report fixture and assert:

```js
expect(wrapper.text()).toContain('서비스 소개 발표')
expect(wrapper.text()).toContain('93점')
expect(wrapper.text()).toContain('슬라이드 1')
expect(wrapper.text()).toContain('발표 목적을 명확하게 소개했습니다.')
expect(wrapper.text()).toContain('질의응답 피드백')
expect(wrapper.find('[data-slide-feedback]').text()).not.toContain('하이라이트')
expect(wrapper.find('[data-qna-feedback] [data-seek]').exists()).toBe(false)
```

- [ ] **Step 2: Write failing component interaction tests**

For analysis, click a speech bucket and assert `seek-local` emits its local second. For the video panel, select slide 2 and assert the controller seeks to `slide.startTimeSec`; update video time and assert the active slide follows the contiguous `[startTimeSec, endTimeSec)` range.

- [ ] **Step 3: Run the view/component tests and verify RED**

Run:

```powershell
npm test -- tests/views/PresentationReportView.test.js tests/components/presentation-report/PresentationReportAnalysis.test.js tests/components/presentation-report/PresentationReportVideoPanel.test.js
```

Expected: FAIL because the presentation-only view and components do not exist.

- [ ] **Step 4: Implement the presentation-only video controller**

```js
export function usePresentationReportVideo({ slides, selectedIndex }) {
  const videoEl = ref(null)
  const absoluteSec = ref(0)
  const seekLocal = (localSec) => {
    const slide = slides.value[selectedIndex.value]
    const target = Math.min(slide.endTimeSec, slide.startTimeSec + Math.max(0, localSec))
    absoluteSec.value = target
    if (videoEl.value) videoEl.value.currentTime = target
  }
  // Return selectSlide, onTimeUpdate, togglePlay, scrub handlers, localSec, and cleanup.
}
```

All code remains in `usePresentationReportVideo.js`; do not import `useReportVideoController.js`.

- [ ] **Step 5: Implement the three presentation-owned components**

`PresentationReportSummary.vue` renders title/date/slide count/duration and overall, voice, video, content, and optional Q&A scores.

`PresentationReportAnalysis.vue` uses `usePresentationVoicePaceGraph` and `usePresentationGestureGraph`, renders only real API buckets, and displays a gray data-empty state when optional `gesture` is null.

`PresentationReportVideoPanel.vue` renders the full presentation WebM player, slide thumbnails, current slide image/title, current slide STT segments, and previous/next slide controls.

- [ ] **Step 6: Implement the standalone page**

```vue
<script setup>
import PresentationReportSummary from '../../components/presentation-report/PresentationReportSummary.vue'
import PresentationReportAnalysis from '../../components/presentation-report/PresentationReportAnalysis.vue'
import PresentationReportVideoPanel from '../../components/presentation-report/PresentationReportVideoPanel.vue'
import { usePresentationReportVideo } from '../../composables/usePresentationReportVideo.js'
import { usePresentationStore } from '../../stores/presentationStore.js'
</script>
```

The page loads only `GET /presentations/{presentationId}/presentation-report`, renders `slides[].feedback.content` without transcript highlighting, and renders Q&A feedback without any seek control.

- [ ] **Step 7: Route archive detail directly to the presentation page**

```js
component: () => import('../../views/presentation/PresentationReportDetailView.vue')
```

Keep the existing archive URL stable. Resolve the ID in this order: `route.query.presentationId`, numeric `route.params.id`, then `presentation.sessionId`. Do not use a display seed such as `svc-intro-3` as an API ID.

- [ ] **Step 8: Run the view/component tests and verify GREEN**

Run:

```powershell
npm test -- tests/views/PresentationReportView.test.js tests/components/presentation-report/PresentationReportAnalysis.test.js tests/components/presentation-report/PresentationReportVideoPanel.test.js
```

Expected: all tests pass.

- [ ] **Step 9: Commit the presentation-only report UI**

```powershell
git add src/composables/usePresentationReportVideo.js src/components/presentation-report src/views/presentation/PresentationReportDetailView.vue src/assets/styles/views/presentation-report.css src/router/modules/archiveRoutes.js tests/views/PresentationReportView.test.js tests/components/presentation-report
git commit -m "feat: add isolated presentation report screen"
```

### Task 7: Enforce report isolation and remove the presentation path from shared report code

**Files:**
- Create: `tests/architecture/presentationReportIsolation.test.js`
- Delete if unreferenced: `src/views/archive/ArchiveDetailView.vue`
- Delete if unreferenced: `src/components/report/PresentationVideoPanel.vue`
- Keep unchanged for unrelated callers unless proven unused: `src/components/report/PracticeReportSummary.vue`
- Keep unchanged for unrelated callers unless proven unused: `src/components/report/PracticeReportAnalysis.vue`
- Keep unchanged for unrelated callers unless proven unused: `src/composables/useReportVideoController.js`

**Interfaces:**
- Consumes: source files and import graph.
- Produces: a test-enforced boundary preventing presentation report files from importing interview or shared report implementation.

- [ ] **Step 1: Write the failing architecture test**

```js
const forbidden = [
  '/components/report/',
  '/views/interview/',
  '/stores/interviewStore',
  '/api/interviewApi',
  'useReportVideoController',
  'useVoicePaceGraph',
  'useGestureGraph',
]

for (const source of presentationReportSources) {
  for (const token of forbidden) expect(source.content).not.toContain(token)
}
```

Also assert that the protected interview files do not import `/components/presentation-report/` or `usePresentation` report modules.

- [ ] **Step 2: Run the architecture test and verify RED**

Run: `npm test -- tests/architecture/presentationReportIsolation.test.js`

Expected: FAIL while the old `ArchiveDetailView.vue` remains the routed presentation page or references shared report modules.

- [ ] **Step 3: Remove only presentation-specific obsolete shared files**

Use `rg` to prove a file has no remaining import before deletion:

```powershell
rg -n "ArchiveDetailView|PresentationVideoPanel" src tests
```

Delete only the obsolete routed archive detail and presentation shared video panel. Do not delete generic shared modules if another non-presentation view or test still imports them.

- [ ] **Step 4: Run the architecture test and verify GREEN**

Run: `npm test -- tests/architecture/presentationReportIsolation.test.js`

Expected: pass.

- [ ] **Step 5: Re-run the exact interview baseline comparison**

Run the Task 1 `git diff --exit-code 520e2326f3de3ab742e9141fa0cbcac97afe1820 -- $protected` command.

Expected: exit code 0 and no output.

- [ ] **Step 6: Commit the isolation guard**

```powershell
git add tests/architecture/presentationReportIsolation.test.js src/views/archive/ArchiveDetailView.vue src/components/report/PresentationVideoPanel.vue
git commit -m "test: enforce interview presentation report isolation"
```

### Task 8: Verify Complete, report rendering, and regression boundaries

**Files:**
- Verify only; no production changes unless a failing test is reproduced first.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: evidence for contract, build, browser rendering, and interview isolation.

- [ ] **Step 1: Run focused contract and report tests**

```powershell
npm test -- tests/api/springPresentationApi.test.js tests/utils/presentationArtifacts.test.js tests/stores/springPresentationFlow.test.js tests/api/presentationReportNormalizer.test.js tests/composables/usePresentationVoicePaceGraph.test.js tests/composables/usePresentationGestureGraph.test.js tests/views/PresentationReportView.test.js tests/components/presentation-report tests/architecture/presentationReportIsolation.test.js
```

Expected: all pass.

- [ ] **Step 2: Run the full unit test suite**

Run: `npm test`

Expected: all tests pass. If an existing unrelated dirty-worktree test fails, report it separately and do not overwrite the user's changes.

- [ ] **Step 3: Build production assets**

Run: `npm run build`

Expected: Vite build exits 0 without unresolved imports.

- [ ] **Step 4: Verify forbidden imports and protected interview diff**

```powershell
rg -n "components/report|useReportVideoController|stores/interviewStore|api/interviewApi" src/views/presentation/PresentationReportDetailView.vue src/components/presentation-report src/composables/usePresentationReportVideo.js
git diff --exit-code 520e2326f3de3ab742e9141fa0cbcac97afe1820 -- $protected
```

Expected: `rg` finds nothing and Git reports no interview diff.

- [ ] **Step 5: Start the local frontend and verify rendered interactions**

Run: `npm run dev -- --port 5180`

In the browser verify:

- `/archive/detail?presentationId=<real id>` loads the presentation report API.
- Voice graph buckets and labels use WPM.
- Gesture tab shows real data or a gray unavailable state; it never generates mock points.
- Clicking/dragging a graph seeks the full presentation video within the selected slide interval.
- Slide thumbnail selection seeks to `startTimeSec`; video time selects the matching slide.
- Slide feedback is AI text only; Q&A has no video seek control.
- Presentation Complete sends `request`, `audio`, and `video`, and a failed Complete does not navigate to success.

- [ ] **Step 6: Inspect the final diff**

```powershell
git status --short
git diff --stat 090edc4..HEAD
git diff --name-only 090edc4..HEAD
```

Expected: only the protected interview restoration, presentation Complete/report implementation, focused tests, and this plan are included. Existing mypage/trends dirty files remain unstaged and unchanged by this work.
