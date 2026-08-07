# Shared Interview and Presentation Report Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the real presentation report API and render interview and presentation reports with the same summary and analysis UI while preserving their different video layouts.

**Architecture:** Keep `interviewApi` and `presentationApi` separate, normalize both responses into one `PracticeReportViewModel`, and feed shared summary/analysis components. Share video timing through one composable, but render question-oriented and slide-oriented video panels separately.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue Router, native HTML video, SVG graphs, Vitest, Vue Test Utils

## Global Constraints

- Frontend changes only; do not change Spring, FastAPI, or database code.
- Presentation detail uses `GET /api/v1/presentations/{presentationId}/presentation-report` with the existing Bearer-token client.
- Interview detail keeps `GET /api/v1/interviews/{interviewId}/interview-report`.
- API failure must not be replaced by report Mock data.
- Summary and voice/gesture analysis layouts are shared; interview and presentation video-panel DOM remain separate.
- Presentation Q&A is not part of the recording timeline and must not seek the video.
- `tiltPct` is displayed as tilt percent, matching commit `520e2326f3de3ab742e9141fa0cbcac97afe1820`; do not convert it to posture stability.
- `speechAnalysis.windows[].fillerCount` identifies a 10-second window only. Do not invent exact filler timestamps or filler words.
- `silenceDetected` and `silenceDurationMs` identify detection and total duration inside a window only. Do not invent exact silence start/end timestamps.
- Slide revisit order comes from `slides[].visits`; `audioStt.segments[].visitId` is the primary transcript-to-visit mapping.
- Slide feedback renders only `slides[].feedback.content`; do not underline or highlight transcript text.
- Preserve the interview question navigation, graph edge navigation, and video synchronization behavior from commit `520e2326f3de3ab742e9141fa0cbcac97afe1820`.

---

## Confirmed API Feasibility

| Screen requirement | Response source | Result |
| --- | --- | --- |
| Title, date, duration, slide count | `practice`, `presentation.slideCount` | Directly renderable |
| Overall and folder comparison | `score.overallScore`, `folderAverageScore`, `folderAverageDelta` | Directly renderable |
| Voice, gesture, content, Q&A score | `deliveryScore`, `nonverbalScore`, `contentRelevanceScore`, `questionAnswerScore` | Directly renderable |
| Video playback | `media.video.playbackUrl` | Directly renderable when URL is valid |
| Slide images and thumbnails | `slides[].imageUrl` | Directly renderable |
| Slide transcript | `audioStt.segments[].slideId`, `visitId`, timestamps | Directly renderable |
| Revisited slide navigation | `slides[].visits[]` | Exactly mappable with a piecewise timeline |
| Voice graph | `speechAnalysis.windows[]` | Renderable as 10-second WPM steps |
| Filler detail | `windows[].fillerCount` | Renderable by window and total only; exact dots/words are impossible |
| Silence detail | `silenceDetected`, `silenceDurationMs` | Renderable by detection window and total only; exact bars are impossible |
| Tilt graph and gaze events | `gestureSeries.buckets[]`, `gazeEvents[]` | Directly renderable |
| Slide AI feedback | `slides[].feedback.content` | Directly renderable without transcript highlighting |
| Q&A feedback | `questionAnswers[].feedback` | Directly renderable without video linkage |

The response is sufficient for the requested page. Exact service-quality behavior additionally depends on the API returning every slide visit and a valid playback URL. A 10-second analysis window crossing a slide boundary retains the server's whole-window value; the frontend clips only its visual span and does not claim a more precise per-slide measurement.

## Planned File Structure

### New files

- `src/api/normalizers/practiceReport.js`: shared view-model primitives and piecewise time mapping.
- `src/api/normalizers/presentationReport.js`: presentation response to `PracticeReportViewModel`.
- `src/api/normalizers/interviewReport.js`: interview response to the same view model.
- `src/composables/useReportVideoController.js`: shared absolute/relative video synchronization.
- `src/components/report/PracticeReportSummary.vue`: shared report metadata and score card.
- `src/components/report/PracticeReportAnalysis.vue`: shared voice/gesture tabs and graphs.
- `src/components/report/InterviewVideoPanel.vue`: question-oriented recording UI.
- `src/components/report/PresentationVideoPanel.vue`: slide thumbnails and slide-oriented recording UI.
- Focused tests under `tests/api`, `tests/composables`, `tests/components/report`, and `tests/views`.

### Modified files

- `src/api/presentationApi.js`: add the real report GET method.
- `src/stores/presentationStore.js`: fetch and retain a normalized real report.
- `src/stores/interviewStore.js`: normalize report responses without changing recording/completion behavior.
- `src/api/normalizers/archive.js`: preserve `presentationId` and `interviewId` from list items.
- `src/views/archive/FolderDetailView.vue`: preserve the domain ID in detail navigation.
- `src/views/archive/ArchiveDetailView.vue`: become the presentation report composition root.
- `src/views/interview/InterviewReportDetailView.vue`: use shared summary/analysis and the interview video panel.
- `src/composables/useVoicePaceGraph.js`: support real empty events and window-level detections.
- `src/composables/useGestureGraph.js`: restore null-safe, sorted, one-decimal behavior from the reference commit.
- `src/assets/styles/views/interview-report.css`: keep shared visual classes and add presentation-panel variants without duplicating the stylesheet.

---

### Task 1: Lock the Presentation Report HTTP Contract

**Files:**
- Modify: `frontend-vue-main/src/api/presentationApi.js`
- Modify: `frontend-vue-main/tests/api/springPresentationApi.test.js`

**Interfaces:**
- Produces: `presentationApi.getReport(presentationId): Promise<ApiResponse>`
- Consumes: existing `get(path)` client with `/api/v1` base URL and Bearer token injection

- [ ] **Step 1: Add the failing route assertion**

```js
it('reads a presentation report by presentationId', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'COMPLETED' }))

  await presentationApi.getReport(12)

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/presentations/12/presentation-report'),
    expect.objectContaining({ method: 'GET' }),
  )
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/api/springPresentationApi.test.js`

Expected: FAIL because `presentationApi.getReport` does not exist.

- [ ] **Step 3: Add the API method**

```js
getReport(presentationId) {
  return get(`/presentations/${presentationId}/presentation-report`)
},
```

- [ ] **Step 4: Run the focused API test**

Run: `npm test -- tests/api/springPresentationApi.test.js`

Expected: PASS and request URL contains `/api/v1/presentations/12/presentation-report`.

- [ ] **Step 5: Commit the contract change**

```bash
git add frontend-vue-main/src/api/presentationApi.js frontend-vue-main/tests/api/springPresentationApi.test.js
git commit -m "feat: 발표 리포트 조회 API 추가"
```

---

### Task 2: Build the Common Report Model and Piecewise Timeline

**Files:**
- Create: `frontend-vue-main/src/api/normalizers/practiceReport.js`
- Create: `frontend-vue-main/src/api/normalizers/presentationReport.js`
- Create: `frontend-vue-main/src/api/normalizers/interviewReport.js`
- Create: `frontend-vue-main/tests/api/practiceReportTimeline.test.js`
- Create: `frontend-vue-main/tests/api/presentationReportNormalizer.test.js`
- Create: `frontend-vue-main/tests/api/interviewReportNormalizer.test.js`

**Interfaces:**
- Produces: `normalizePresentationReport(raw): PracticeReportViewModel`
- Produces: `normalizeInterviewReport(raw): PracticeReportViewModel`
- Produces: `buildSectionRanges(visits): SectionRange[]`
- Produces: `sectionLocalToAbsolute(section, localSec): number`
- Produces: `sectionAbsoluteToLocal(section, absoluteSec): number | null`
- `SectionRange`: `{ visitId, absoluteStartSec, absoluteEndSec, localStartSec, localEndSec }`

- [ ] **Step 1: Write failing piecewise-time tests**

```js
it('concatenates revisits into one slide-local timeline', () => {
  const ranges = buildSectionRanges([
    { visitId: 1, startTimeMs: 0, endTimeMs: 12000 },
    { visitId: 4, startTimeMs: 30000, endTimeMs: 40000 },
  ])

  expect(ranges).toEqual([
    { visitId: 1, absoluteStartSec: 0, absoluteEndSec: 12, localStartSec: 0, localEndSec: 12 },
    { visitId: 4, absoluteStartSec: 30, absoluteEndSec: 40, localStartSec: 12, localEndSec: 22 },
  ])
  expect(sectionLocalToAbsolute({ ranges }, 15)).toBe(33)
  expect(sectionAbsoluteToLocal({ ranges }, 33)).toBe(15)
  expect(sectionAbsoluteToLocal({ ranges }, 20)).toBeNull()
})
```

- [ ] **Step 2: Run timeline tests and verify failure**

Run: `npm test -- tests/api/practiceReportTimeline.test.js`

Expected: FAIL because the timeline helpers do not exist.

- [ ] **Step 3: Implement deterministic range conversion**

```js
export const buildSectionRanges = (visits = []) => {
  let localCursor = 0
  return [...visits]
    .sort((a, b) => Number(a.startTimeMs) - Number(b.startTimeMs))
    .map((visit) => {
      const absoluteStartSec = Number(visit.startTimeMs) / 1000
      const absoluteEndSec = Number(visit.endTimeMs) / 1000
      const durationSec = Math.max(0, absoluteEndSec - absoluteStartSec)
      const range = {
        visitId: visit.visitId,
        absoluteStartSec,
        absoluteEndSec,
        localStartSec: localCursor,
        localEndSec: localCursor + durationSec,
      }
      localCursor += durationSec
      return range
    })
}
```

Implement local/absolute conversion by locating the containing range and applying the offset. Clamp local seek values to `[0, section.durationSec]`; return `null` when an absolute time belongs to another section.

- [ ] **Step 4: Write the failing presentation-normalizer test using the agreed response shape**

```js
it('normalizes scores, visits, transcripts, speech windows, and gesture buckets', () => {
  const report = normalizePresentationReport(presentationReportFixture)

  expect(report.type).toBe('presentation')
  expect(report.scores).toMatchObject({ overall: 91, voice: 93, video: 87, content: 91, questionAnswer: 84 })
  expect(report.media.videoPlaybackUrl).toContain('/presentations/12/video')
  expect(report.sections[0].ranges).toHaveLength(2)
  expect(report.sections[0].durationSec).toBe(22)
  expect(report.sections[0].transcriptSegments.map((segment) => segment.visitId)).toEqual([1, 1, 4])
  expect(report.sections[0].feedback.content).toContain('발표')
  expect(report.questionAnswers[0].feedback.score).toBe(84)
})
```

- [ ] **Step 5: Implement presentation normalization**

Normalize fields with these exact mappings:

```js
scores: {
  overall: score.overallScore ?? null,
  folderAverage: score.folderAverageScore ?? practice.folder?.averageScore ?? null,
  folderDelta: score.folderAverageDelta ?? null,
  voice: score.deliveryScore ?? null,
  video: score.nonverbalScore ?? null,
  content: score.contentRelevanceScore ?? null,
  questionAnswer: score.questionAnswerScore ?? null,
}
```

For each slide:

1. Build `ranges` from `slide.visits`.
2. Group transcript segments by `slideId` and `visitId`.
3. Intersect each speech window and gesture bucket with every visit range.
4. Convert the clipped visual interval to the concatenated slide-local interval.
5. Keep `averageWpm`, `fillerCount`, `silenceDetected`, `silenceDurationMs`, `tiltPercent`, and gaze timestamps unchanged in meaning.

Use this overlap rule:

```js
const overlapStart = Math.max(sourceStartSec, range.absoluteStartSec)
const overlapEnd = Math.min(sourceEndSec, range.absoluteEndSec)
const overlaps = overlapEnd > overlapStart
```

Set `fillerEvents: []`; construct `fillerWindows` from windows whose `fillerCount > 0`. Construct `silenceWindows` from windows whose `silenceDetected === true`. Never call a filler-event generator for this API response.

- [ ] **Step 6: Write and implement the interview adapter tests**

Assert that one question becomes one section with one range, `question.voicePace` becomes `section.voiceSeries`, `question.gestureSeries` becomes `section.gestureSeries`, and `tiltPct` becomes `tiltPercent`. Use the exact-commit response conventions rather than presentation field names.

Run: `npm test -- tests/api/interviewReportNormalizer.test.js`

Expected: PASS.

- [ ] **Step 7: Run all normalizer tests**

Run: `npm test -- tests/api/practiceReportTimeline.test.js tests/api/presentationReportNormalizer.test.js tests/api/interviewReportNormalizer.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the common model**

```bash
git add frontend-vue-main/src/api/normalizers/practiceReport.js frontend-vue-main/src/api/normalizers/presentationReport.js frontend-vue-main/src/api/normalizers/interviewReport.js frontend-vue-main/tests/api
git commit -m "feat: 면접 발표 리포트 공통 모델 추가"
```

---

### Task 3: Make the Shared Graph Engines Honest and Null-Safe

**Files:**
- Modify: `frontend-vue-main/src/composables/useVoicePaceGraph.js`
- Modify: `frontend-vue-main/src/composables/useGestureGraph.js`
- Create: `frontend-vue-main/tests/composables/useVoicePaceGraph.test.js`
- Restore/Modify: `frontend-vue-main/tests/composables/useGestureGraph.test.js`

**Interfaces:**
- Consumes: normalized `voiceSeries` and `gestureSeries`
- Produces: graph paths, event/window positions, formatted values, and empty-state flags

- [ ] **Step 1: Add failing tests for non-invented filler and silence data**

```js
it('does not synthesize exact filler events when the API explicitly provides none', () => {
  const series = ref({
    buckets: [{ startSec: 0, endSec: 10, pace: 118 }],
    avgPace: 118,
    fillerEvents: [],
    fillerWindows: [{ startSec: 0, endSec: 10, count: 2 }],
    silenceWindows: [{ startSec: 0, endSec: 10, durationMs: 2300 }],
  })
  const graph = useVoicePaceGraph(series, ref(10))

  expect(graph.fillerEvents.value).toEqual([])
  expect(graph.fillerWindows.value[0].count).toBe(2)
  expect(graph.silenceWindows.value[0].durationMs).toBe(2300)
})
```

- [ ] **Step 2: Make explicit empty arrays authoritative**

Change filler selection to:

```js
const fillerEvents = computed(() => {
  const events = voicePaceRef.value?.fillerEvents
  if (Array.isArray(events)) return events
  return buildFillerEvents(voicePaceRef.value?.fillerBreakdown ?? [], durationSecRef.value)
})
```

Expose `fillerWindows` and `silenceWindows` as window bands. Their labels must use the form `0~10초 구간 · 추임새 2회` and `0~10초 구간 · 침묵 감지 · 총 2.3초`.

- [ ] **Step 3: Restore the reference gesture behavior**

Port the null-safe behavior from commit `520e2326f3de3ab742e9141fa0cbcac97afe1820`:

- sort buckets by `startSec`;
- read normalized `tiltPercent`;
- format hover values with one decimal;
- place gaze events on the same interpolated tilt line;
- return an empty graph state when buckets are absent.

- [ ] **Step 4: Run graph tests**

Run: `npm test -- tests/composables/useVoicePaceGraph.test.js tests/composables/useGestureGraph.test.js`

Expected: PASS.

- [ ] **Step 5: Commit graph behavior**

```bash
git add frontend-vue-main/src/composables/useVoicePaceGraph.js frontend-vue-main/src/composables/useGestureGraph.js frontend-vue-main/tests/composables
git commit -m "fix: 리포트 그래프를 실제 분석 구간에 맞춤"
```

---

### Task 4: Extract the Shared Summary and Analysis UI

**Files:**
- Create: `frontend-vue-main/src/components/report/PracticeReportSummary.vue`
- Create: `frontend-vue-main/src/components/report/PracticeReportAnalysis.vue`
- Create: `frontend-vue-main/tests/components/report/PracticeReportSummary.test.js`
- Create: `frontend-vue-main/tests/components/report/PracticeReportAnalysis.test.js`
- Modify: `frontend-vue-main/src/assets/styles/views/interview-report.css`

**Interfaces:**
- `PracticeReportSummary` props: `{ practice, scores, sectionLabel, sectionCount }`
- `PracticeReportAnalysis` props: `{ section, activeMetric, activeLocalSec }`
- `PracticeReportAnalysis` emits: `update:activeMetric`, `seek-local`

- [ ] **Step 1: Write failing summary tests**

Assert that the component renders `overall`, `voice`, `video`, `content`, folder delta, duration, and section count from props. Assert that `null` score renders `-` and is not averaged from other scores.

- [ ] **Step 2: Implement the summary component**

Render the existing `archive-report-summary` and `archive-report-metrics` structure so the visual output remains aligned with the reference report. Use `sectionLabel="슬라이드"` for presentation and `sectionLabel="질문"` for interview.

- [ ] **Step 3: Write failing analysis tests**

Assert that:

- voice and gesture tabs emit the selected metric;
- the voice graph uses WPM values;
- filler and silence appear as 10-second windows, not fabricated points;
- the gesture graph shows `tiltPercent` and gaze events;
- missing series render `분석 데이터가 없습니다.`.

- [ ] **Step 4: Implement the analysis component**

Move the shared SVG and metric chips out of the two large views. Keep existing `.metric-report-shell` and `.iv-*` class hooks to avoid a broad CSS rewrite. Emit the graph-local second from click/drag interactions; do not access a video element directly.

- [ ] **Step 5: Run component tests**

Run: `npm test -- tests/components/report/PracticeReportSummary.test.js tests/components/report/PracticeReportAnalysis.test.js`

Expected: PASS.

- [ ] **Step 6: Commit shared report UI**

```bash
git add frontend-vue-main/src/components/report frontend-vue-main/tests/components/report frontend-vue-main/src/assets/styles/views/interview-report.css
git commit -m "refactor: 리포트 요약과 분석 화면 공통화"
```

---

### Task 5: Share Video Timing but Keep Domain Video Panels Separate

**Files:**
- Create: `frontend-vue-main/src/composables/useReportVideoController.js`
- Create: `frontend-vue-main/src/components/report/InterviewVideoPanel.vue`
- Create: `frontend-vue-main/src/components/report/PresentationVideoPanel.vue`
- Create: `frontend-vue-main/tests/composables/useReportVideoController.test.js`
- Create: `frontend-vue-main/tests/components/report/InterviewVideoPanel.test.js`
- Create: `frontend-vue-main/tests/components/report/PresentationVideoPanel.test.js`

**Interfaces:**
- `useReportVideoController({ sections, selectedIndex, videoRef })`
- Produces: `absoluteSec`, `localSec`, `seekAbsolute`, `seekLocal`, `onTimeUpdate`, `selectSection`
- Both panels consume the controller state through props and emit `seek-absolute`, `select-section`, and playback events.

- [ ] **Step 1: Write failing piecewise seek tests**

```js
it('seeks from a revisited slide-local second to the correct absolute second', () => {
  const sections = ref([{ ranges: [
    { absoluteStartSec: 0, absoluteEndSec: 12, localStartSec: 0, localEndSec: 12 },
    { absoluteStartSec: 30, absoluteEndSec: 40, localStartSec: 12, localEndSec: 22 },
  ] }])
  const selectedIndex = ref(0)
  const videoRef = ref({ currentTime: 0, paused: true })
  const controller = useReportVideoController({ sections, selectedIndex, videoRef })

  controller.seekLocal(15)

  expect(videoRef.value.currentTime).toBe(33)
})
```

- [ ] **Step 2: Implement the video controller**

Use `sectionLocalToAbsolute` and `sectionAbsoluteToLocal` from Task 2. During `timeupdate`, select the section containing the absolute second. When a slide has multiple ranges, keep the same slide selected across all its visits and compute local time using the matching range.

Do not auto-play after a seek if the video was paused. This preserves the reference commit's interaction behavior.

- [ ] **Step 3: Implement and test `InterviewVideoPanel`**

Render the full video, current question, answer captions, and question previous/next controls. A question selection emits its first range's `absoluteStartSec`. Preserve graph-edge navigation behavior from the reference commit.

- [ ] **Step 4: Implement and test `PresentationVideoPanel`**

Render:

- the full video on the left;
- slide thumbnails below the video;
- current slide title and transcript on the right;
- previous/next slide buttons.

Thumbnail selection emits the slide's first visit start. Video `timeupdate` can select a later revisit of the same slide without creating a duplicate thumbnail. Q&A data is not accepted as a panel prop and cannot emit video seek.

- [ ] **Step 5: Run video tests**

Run: `npm test -- tests/composables/useReportVideoController.test.js tests/components/report/InterviewVideoPanel.test.js tests/components/report/PresentationVideoPanel.test.js`

Expected: PASS.

- [ ] **Step 6: Commit video separation**

```bash
git add frontend-vue-main/src/composables/useReportVideoController.js frontend-vue-main/src/components/report/InterviewVideoPanel.vue frontend-vue-main/src/components/report/PresentationVideoPanel.vue frontend-vue-main/tests/composables/useReportVideoController.test.js frontend-vue-main/tests/components/report
git commit -m "refactor: 리포트 영상 제어와 도메인 패널 분리"
```

---

### Task 6: Wire Real Report Loading and Stable Identifiers

**Files:**
- Modify: `frontend-vue-main/src/api/normalizers/archive.js`
- Modify: `frontend-vue-main/src/views/archive/FolderDetailView.vue`
- Modify: `frontend-vue-main/src/stores/presentationStore.js`
- Modify: `frontend-vue-main/src/stores/interviewStore.js`
- Modify: `frontend-vue-main/tests/stores/stores.test.js`
- Modify: `frontend-vue-main/tests/views/FolderDetailView.test.js`

**Interfaces:**
- Produces: `presentationStore.loadReport(presentationId)` returning normalized report
- Produces: `interviewStore.loadReport(interviewId)` returning normalized report
- Archive records preserve `reportId`, `presentationId`, and `interviewId` separately

- [ ] **Step 1: Add failing identifier tests**

Assert that a record containing `{ reportId: 90, presentationId: 12 }` normalizes to `{ id: '90', presentationId: 12 }` and its presentation detail link includes `id=90&presentationId=12`.

- [ ] **Step 2: Preserve domain identifiers in archive navigation**

Build the link with a route object rather than string concatenation:

```js
const detailTarget = (row) => ({
  path: detailBase.value,
  query: {
    id: row.id,
    ...(row.presentationId ? { presentationId: row.presentationId } : {}),
    ...(row.interviewId ? { interviewId: row.interviewId } : {}),
  },
})
```

Do not pass `reportId` as `presentationId` or `interviewId`.

- [ ] **Step 3: Add failing store tests**

Mock `presentationApi.getReport(12)` with the agreed response and assert `store.report.type === 'presentation'` and `store.report.sections.length === 3`. Mock `interviewApi.getReport(21)` and assert the same common model contract with `type === 'interview'`.

- [ ] **Step 4: Implement store loading**

```js
const loadReport = async (targetPresentationId = sessionId.value) => {
  const id = parseServerId(targetPresentationId)
  if (id === null) throw new Error('발표 리포트를 조회할 발표 ID가 없습니다.')
  report.value = null
  report.value = normalizePresentationReport(
    unwrapApiResponse(await presentationApi.getReport(id)),
  )
  return report.value
}
```

Apply the interview adapter only at interview report loading. Do not change interview creation, 10-second audio analysis, complete payload, or recording state.

- [ ] **Step 5: Remove report Mock fallback from these loading paths**

An HTTP failure must set the existing error state or throw to the view. It must not call `buildPresentationReportMock`, `buildInterviewReportMock`, `withMock`, or merge cached demo sessions into an API-success response.

- [ ] **Step 6: Run store and route tests**

Run: `npm test -- tests/stores/stores.test.js tests/views/FolderDetailView.test.js`

Expected: PASS.

- [ ] **Step 7: Commit loading changes**

```bash
git add frontend-vue-main/src/api/normalizers/archive.js frontend-vue-main/src/views/archive/FolderDetailView.vue frontend-vue-main/src/stores/presentationStore.js frontend-vue-main/src/stores/interviewStore.js frontend-vue-main/tests/stores/stores.test.js frontend-vue-main/tests/views/FolderDetailView.test.js
git commit -m "feat: 실제 면접 발표 리포트 로딩 연결"
```

---

### Task 7: Compose the Interview and Presentation Detail Views

**Files:**
- Modify: `frontend-vue-main/src/views/interview/InterviewReportDetailView.vue`
- Modify: `frontend-vue-main/src/views/archive/ArchiveDetailView.vue`
- Restore/Modify: `frontend-vue-main/tests/views/InterviewReportDetailView.test.js`
- Create: `frontend-vue-main/tests/views/PresentationReportDetailView.test.js`
- Modify: `frontend-vue-main/tests/views/PresentationSlideFlow.test.js`

**Interfaces:**
- Consumes: common normalized report, summary component, analysis component, video controller
- Presentation route query consumes `presentationId`; interview route query consumes `interviewId`

- [ ] **Step 1: Add failing presentation page tests**

Mount `/archive/detail?id=90&presentationId=12`, mock the presentation report API, and assert:

- title, date, duration, slide count, and four scores render from the API;
- slide thumbnails use `slides[].imageUrl`;
- slide 1 collects transcripts for visits 1 and 4;
- selecting slide 2 seeks to 12 seconds;
- the selected slide's graph uses only ranges intersecting its visits;
- feedback renders `slides[].feedback.content` without mark/highlight elements;
- Q&A renders question, answer, score, and feedback without a seek control;
- API failure renders retry UI and no seeded report text.

- [ ] **Step 2: Compose `ArchiveDetailView` from shared pieces**

The view owns only:

- route/domain ID resolution;
- loading/error/retry state;
- selected slide index and active metric;
- composition of `PracticeReportSummary`, `PracticeReportAnalysis`, `PresentationVideoPanel`, slide feedback, and Q&A.

Delete equal slide-duration calculation, `FALLBACK_SLIDES`, `FALLBACK_TRANSCRIPTS`, `buildVoicePaceMock`, and `buildGestureSeriesMock` usage from the report path.

- [ ] **Step 3: Restore the reference interview tests before refactoring**

Bring `tests/views/InterviewReportDetailView.test.js` from commit `520e2326f3de3ab742e9141fa0cbcac97afe1820` into the current branch and add assertions for question navigation and video synchronization.

- [ ] **Step 4: Refactor `InterviewReportDetailView` onto shared pieces**

Keep interview-only evidence highlighting and question feedback in the interview view. Replace only the summary, metric graph, and video timing code with the shared components/controller. Use `InterviewVideoPanel`; never render presentation thumbnails in this route.

- [ ] **Step 5: Run both report view suites**

Run: `npm test -- tests/views/InterviewReportDetailView.test.js tests/views/PresentationReportDetailView.test.js tests/views/PresentationSlideFlow.test.js`

Expected: PASS.

- [ ] **Step 6: Commit view composition**

```bash
git add frontend-vue-main/src/views/interview/InterviewReportDetailView.vue frontend-vue-main/src/views/archive/ArchiveDetailView.vue frontend-vue-main/tests/views
git commit -m "feat: 면접 발표 공통 리포트 화면 적용"
```

---

### Task 8: Full Regression and Render Verification

**Files:**
- Verify only; modify a file only when a failure demonstrates a product defect within this feature.

**Interfaces:**
- Validates all preceding tasks as one user flow.

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite build exits with code 0 and produces no unresolved imports.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check HEAD~7..HEAD`

Expected: no whitespace errors. Confirm no files under `backend-spring-develop` or `backend-fastapi-main` changed.

- [ ] **Step 4: Verify interview rendering locally**

Open an interview detail report and verify:

- current question follows video time;
- question previous/next navigation seeks correctly;
- voice and gesture graph interactions still work;
- no presentation thumbnail UI appears;
- interview recording/completion behavior is unchanged.

- [ ] **Step 5: Verify presentation rendering locally**

Open `/archive/detail?id=<reportId>&presentationId=<presentationId>` with a real authenticated record and verify:

- the report endpoint returns 200;
- video, thumbnails, transcript, graphs, slide feedback, and Q&A render;
- slide 1's later revisit selects slide 1 again at the correct video time;
- graph-local seek across the revisit maps to the correct absolute time;
- filler and silence are shown as window-level facts only;
- no Mock badge, fallback score, seeded transcript, or highlighted slide-feedback transcript appears.

- [ ] **Step 6: Commit any verification-only correction**

If Step 1-5 required an in-scope correction, stage only those corrected frontend files and commit:

```bash
git commit -m "fix: 공통 리포트 통합 검증 보완"
```

If no correction was required, do not create an empty commit.
