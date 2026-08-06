# Practice Trends API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/mypage/trend` fixture with `GET /api/v1/practices/trends`, remove the presentation/interview split, keep the six recent-vs-previous summary metrics, and restrict the per-practice score chart to content, body, and voice scores.

**Architecture:** `userApi` owns the endpoint, a focused trend normalizer converts the backend DTO into display-safe metrics and score series, and `MyPageTrendView` owns only loading/error/selection/rendering state. The page uses the real API without mock fallback. The existing six-card summary and speech reference sections remain, while the bottom chart consumes the normalized `practices` array and exposes only three score selectors.

**Tech Stack:** Vue 3 `<script setup>`, Vite, native Fetch API wrapper, Vitest, Vue Test Utils.

## Global Constraints

- Frontend scope only; do not modify `backend-spring-develop` or `backend-fastapi-main`.
- Endpoint is exactly `GET /api/v1/practices/trends` with the shared client adding `/api/v1` and the bearer token.
- Do not use `withMock`; loading, empty, and API error states must be visible.
- Remove the presentation/interview tabs. Presentation and interview scores share the same content/body/voice chart.
- Interpret `earlyTrend` as the previous three completed practices and `lateTrend` as the latest three completed practices.
- Require `practices` to be returned oldest-to-newest. If the backend cannot guarantee order, it must add `practicedAt`; the frontend must not guess chronology from score values.
- Interpret `speech.silenceLate` as the recent-period silence ratio in percent. Rename the backend field if it means a duration or count instead.
- The six summary fields have these units and directions: `content` points/higher, `stability` points/higher, `glance` occurrences per minute/lower, `filler` occurrences per minute/lower, `speed` percent/lower, `totalTime` percent/lower.
- Keep the established gray “이전 기록이 부족해요” treatment when fewer than six practices are available.

---

### Task 1: Lock the HTTP endpoint contract

**Files:**
- Modify: `src/api/userApi.js`
- Create: `tests/api/practiceTrendsApi.test.js`

**Interfaces:**
- Produces: `userApi.getPracticeTrends(): Promise<object>`
- Consumes: shared `get(path)` client, which prefixes `/api/v1` and attaches authentication.

- [ ] **Step 1: Write the failing endpoint test**

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { userApi } from '../../src/api/userApi.js'

describe('practice trends API contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('requests the unified practice trends endpoint', async () => {
    await userApi.getPracticeTrends()
    expect(globalThis.fetch.mock.calls.at(-1)[0]).toBe('/api/v1/practices/trends')
    expect(globalThis.fetch.mock.calls.at(-1)[1]).toMatchObject({ method: 'GET' })
  })
})
```

- [ ] **Step 2: Run the test and verify the missing method failure**

Run: `npm test -- tests/api/practiceTrendsApi.test.js`

Expected: FAIL because `userApi.getPracticeTrends` does not exist.

- [ ] **Step 3: Replace the obsolete stats method with the exact endpoint**

```js
getPracticeTrends() {
  return get('/practices/trends')
},
```

Remove `withQuery` from `userApi.js` if no remaining method uses it, and remove the stale `/users/me/stats` comment.

- [ ] **Step 4: Run the endpoint test**

Run: `npm test -- tests/api/practiceTrendsApi.test.js`

Expected: PASS and the captured URL is `/api/v1/practices/trends`.

- [ ] **Step 5: Commit the endpoint contract**

```bash
git add src/api/userApi.js tests/api/practiceTrendsApi.test.js
git commit -m "feat: connect practice trends endpoint"
```

### Task 2: Normalize the trends response into a stable view model

**Files:**
- Create: `src/api/normalizers/trends.js`
- Create: `tests/api/trendsNormalizer.test.js`

**Interfaces:**
- Consumes: the backend response or its optional `{ data }` transport envelope.
- Produces: `normalizePracticeTrends(response): TrendViewModel`.
- `TrendViewModel.metrics`: six summary cards with `key`, `label`, `value`, `unit`, `previousValue`, `recentValue`, `direction`, `deltaLabel`, and `tone`.
- `TrendViewModel.scoreSeries`: exactly content, body, and voice series built from `practices`.
- `TrendViewModel.speechReference`: formatted average, early, late, late-change, and silence values.

- [ ] **Step 1: Write normalization tests for the supplied DTO**

```js
import { describe, expect, it } from 'vitest'

import { normalizePracticeTrends } from '../../src/api/normalizers/trends.js'

const response = {
  earlyTrend: { content: 82, stability: 71, glance: 2, filler: 1.4, speed: 11.2, totalTime: 5.2 },
  lateTrend: { content: 91, stability: 68, glance: 1.3, filler: 0.8, speed: 14.8, totalTime: 3.4 },
  practices: [
    { contentScore: 90, videoScore: 80, voiceScore: 80 },
    { contentScore: 80, videoScore: 70, voiceScore: 90 },
    { contentScore: 81, videoScore: 71, voiceScore: 91 },
  ],
  speech: { averageSpeechSpeed: 137, earlySpeechSpeed: 122, lateSpeechSpeed: 152, silenceLate: 4.2 },
}

describe('practice trends normalizer', () => {
  it('maps six summary metrics with correct improvement directions', () => {
    const result = normalizePracticeTrends(response)
    expect(result.metrics).toHaveLength(6)
    expect(result.metrics.find(({ key }) => key === 'content')).toMatchObject({ value: 91, tone: 'positive' })
    expect(result.metrics.find(({ key }) => key === 'stability')).toMatchObject({ value: 68, tone: 'negative' })
    expect(result.metrics.find(({ key }) => key === 'glance')).toMatchObject({ value: 1.3, tone: 'positive' })
    expect(result.metrics.find(({ key }) => key === 'speed')).toMatchObject({ value: 14.8, tone: 'negative' })
  })

  it('creates only content, body, and voice score series', () => {
    const result = normalizePracticeTrends(response)
    expect(result.scoreSeries.map(({ key }) => key)).toEqual(['content', 'video', 'voice'])
    expect(result.scoreSeries.find(({ key }) => key === 'voice').values).toEqual([80, 90, 91])
  })

  it('formats speech values and computes late speed change', () => {
    const result = normalizePracticeTrends(response)
    expect(result.speechReference).toMatchObject({
      averageWpm: '137 WPM',
      earlyWpm: '122 WPM',
      lateWpm: '152 WPM',
      silenceRatio: '4.2%',
    })
    expect(result.speechReference.lateChange).toBe('+24.6%')
  })
})
```

- [ ] **Step 2: Run the normalizer tests and verify the missing module failure**

Run: `npm test -- tests/api/trendsNormalizer.test.js`

Expected: FAIL because `src/api/normalizers/trends.js` does not exist.

- [ ] **Step 3: Implement field metadata and safe numeric conversion**

Define the six metrics in fixed display order:

```js
const METRICS = [
  { key: 'content', label: '슬라이드 내용 전달', unit: '점', direction: 'higher' },
  { key: 'stability', label: '자세 안정도', unit: '점', direction: 'higher' },
  { key: 'glance', label: '시선 이탈 밀도', unit: '회/분', direction: 'lower' },
  { key: 'filler', label: '추임새 밀도', unit: '회/분', direction: 'lower' },
  { key: 'speed', label: '발화 속도 변동률', unit: '%', direction: 'lower' },
  { key: 'totalTime', label: '목표 시간 오차', unit: '%', direction: 'lower' },
]
```

Normalize missing/non-numeric values to `null`, never to a fabricated zero. Generate Korean delta labels from `lateTrend - earlyTrend`; reverse the positive/negative tone for lower-is-better fields. Calculate `lateChange` as `(lateSpeechSpeed - earlySpeechSpeed) / earlySpeechSpeed * 100`, returning `'-'` when the early value is missing or zero.

- [ ] **Step 4: Build the three per-practice score series**

Map the practices array without changing order:

```js
const SCORE_SERIES = [
  { key: 'content', field: 'contentScore', label: '내용' },
  { key: 'video', field: 'videoScore', label: '몸짓' },
  { key: 'voice', field: 'voiceScore', label: '음성' },
]
```

Each score series contains numeric values only at its original practice index. Preserve `null` for a missing score so the view can show a gap instead of inventing a score.

- [ ] **Step 5: Add insufficient-history behavior to the normalizer**

Set `hasPreviousData` to `practices.length >= 6 && earlyTrend != null`. The view may render all returned points, but the initial implementation uses the latest six (`practices.slice(-6)`) to preserve readable labels and the previous-three/recent-three layout.

- [ ] **Step 6: Run normalizer tests**

Run: `npm test -- tests/api/trendsNormalizer.test.js`

Expected: PASS for direction, series, missing data, and speech calculations.

- [ ] **Step 7: Commit the normalizer**

```bash
git add src/api/normalizers/trends.js tests/api/trendsNormalizer.test.js
git commit -m "feat: normalize practice trend metrics"
```

### Task 3: Replace the trend fixture with real API state

**Files:**
- Modify: `src/views/mypage/MyPageTrendView.vue`
- Modify: `tests/views/MyPageTrendView.test.js`

**Interfaces:**
- Consumes: `userApi.getPracticeTrends()` and `normalizePracticeTrends()`.
- Produces: loading, loaded, empty, and retryable error states at `/mypage/trend`.

- [ ] **Step 1: Replace fixture-based tests with API-backed view tests**

Mock `userApi.getPracticeTrends` and assert these scenarios:

1. Loading text appears before the promise resolves.
2. Success renders six summary cards and no presentation/interview tabs.
3. Error renders the server message and a retry button.
4. Empty `practices` renders “아직 분석할 연습 기록이 없어요.”
5. Fewer than six practices renders recent values plus the gray “이전 기록이 부족해요” state.
6. Score selector buttons are exactly `내용`, `몸짓`, `음성`.
7. Selecting `몸짓` replaces chart values with `videoScore` values.

- [ ] **Step 2: Run the view tests and verify fixture assumptions fail**

Run: `npm test -- tests/views/MyPageTrendView.test.js`

Expected: FAIL because the view still renders `PRESENTATION_TREND_MOCK` and type tabs.

- [ ] **Step 3: Add API lifecycle state**

Use `onMounted(loadTrends)` with:

```js
const loading = ref(true)
const loadError = ref('')
const trend = ref(null)

const loadTrends = async () => {
  loading.value = true
  loadError.value = ''
  try {
    trend.value = normalizePracticeTrends(await userApi.getPracticeTrends())
  } catch (error) {
    loadError.value = error?.message || '학습 추이를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}
```

Do not catch an API failure and replace it with fixture data.

- [ ] **Step 4: Remove the type tabs and presentation-only branch**

Delete `selectedType`, the `발표/면접` tab markup, and the interview placeholder. Keep the page heading “내 학습 추이” and update its copy to describe unified completed practices rather than presentation-only records.

- [ ] **Step 5: Bind the six cards to normalized early/late trends**

Use `metric.value` for the recent average and `metric.deltaLabel` for comparison. If `hasPreviousData` is false, render the existing gray insufficient-history copy instead of a delta.

- [ ] **Step 6: Keep deterministic strength/weakness copy without fabricating AI feedback**

Derive strength candidates from metrics whose `tone === 'positive'` and weakness candidates from `tone === 'negative'`. Use fixed copy templates keyed by the six metric keys, display at most three strengths and three weaknesses, and choose the first weakness in metric display order for the next-goal template. Do not claim a causal explanation that is absent from the response.

- [ ] **Step 7: Bind the speech reference cards**

Render `averageSpeechSpeed`, early-to-late speed, the frontend-calculated change percentage, and `silenceLate` as a neutral reference. Preserve the current rule that WPM is not labeled good or bad.

- [ ] **Step 8: Replace the six-metric chart selector with three score selectors**

Initialize the selected score series to `content`. Use content/body/voice values from the latest six practices. Compute SVG x coordinates from point count rather than fixed six indexes, leave a gap for `null` scores, and keep numeric labels above points.

- [ ] **Step 9: Add loading, empty, and retryable error markup**

The retry button calls `loadTrends`. Loading and errors occupy the panel body without changing the fixed MyPage navigation. An empty history must not render zero-valued cards.

- [ ] **Step 10: Run the view tests**

Run: `npm test -- tests/views/MyPageTrendView.test.js`

Expected: PASS for API states, unified page, six summaries, three score selectors, and chart switching.

- [ ] **Step 11: Commit the view integration**

```bash
git add src/views/mypage/MyPageTrendView.vue tests/views/MyPageTrendView.test.js
git commit -m "feat: render unified practice growth trends"
```

### Task 4: Update integration documentation and run regression checks

**Files:**
- Modify: `docs/api-specification.md`
- Modify: `docs/frontend-specification.md`

**Interfaces:**
- Documents: exact endpoint, response grouping semantics, ordering requirement, and UI behavior.

- [ ] **Step 1: Replace the obsolete trend endpoint documentation**

Document:

```text
GET /api/v1/practices/trends
earlyTrend = previous three completed practices average
lateTrend = latest three completed practices average
practices = oldest-to-newest score history
```

List all response units and clarify that `speech.silenceLate` is a percentage.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- tests/api/practiceTrendsApi.test.js tests/api/trendsNormalizer.test.js tests/views/MyPageTrendView.test.js
```

Expected: all focused tests pass.

- [ ] **Step 3: Run the complete frontend regression suite**

Run: `npm test`

Expected: all Vitest suites pass with no fixture assumptions left for `/mypage/trend`.

- [ ] **Step 4: Build the production bundle**

Run: `npm run build`

Expected: Vite exits successfully and emits the production bundle without unresolved imports.

- [ ] **Step 5: Validate the rendered page**

Run the existing Vite server and validate this flow in the Browser plugin:

```text
/mypage/trend loads -> real API data renders -> content/body/voice selector changes the graph -> no framework overlay or relevant console error
```

Check desktop and one narrow viewport. Also verify loading, fewer-than-six, empty, and API-error states with controlled API responses.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Confirm that only frontend source, tests, and documentation changed; backend folders remain untouched.

- [ ] **Step 7: Commit documentation and verification updates**

```bash
git add docs/api-specification.md docs/frontend-specification.md
git commit -m "docs: document unified practice trends"
```

## Self-Review Results

- Spec coverage: endpoint, DTO normalization, six summaries, unified content/body/voice chart, speech cards, insufficient history, API errors, tests, build, and browser QA are each assigned to a task.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: `userApi.getPracticeTrends` feeds `normalizePracticeTrends`, whose `metrics`, `scoreSeries`, `speechReference`, and `hasPreviousData` fields are the only model consumed by the view.
- Remaining contract prerequisite: backend ordering and the exact meaning of `earlyTrend`, `lateTrend`, and `silenceLate` must match the Global Constraints. If not, rename or extend the response before implementation rather than adding frontend guesses.
