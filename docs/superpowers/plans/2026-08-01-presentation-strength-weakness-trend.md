# Presentation Strength and Weakness Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the presentation trend mock with a recent-three versus previous-three dashboard that exposes numeric metrics, strengths, weaknesses, neutral speech references, and a gray insufficient-history state.

**Architecture:** Keep the existing `MyPageTrendView.vue` route and surrounding MyPage layout. Give the view a `trendData` prop with a production-shaped mock default so the same rendering boundary can consume a future API response, and derive card/chart state with Vue computed values. Preserve the presentation/interview tab shell, while the approved redesign applies to the presentation tab.

**Tech Stack:** Vue 3 Composition API, scoped CSS, Vitest, Vue Test Utils, Vite

## Global Constraints

- Compare the latest three completed presentation practices with the preceding three.
- Do not classify presentation types or judge whether average WPM is good or bad.
- Normalize duration-sensitive events as density or ratio values.
- Show exactly six core metric cards: content delivery, body stability, side-glance density, filler density, pace variation, and target-duration error.
- Show at most three strengths and three weaknesses without force-filling empty slots.
- When previous history is unavailable, keep recent values visible and render comparison slots and the previous chart range in gray with `이전 기록이 부족해요`.
- Do not show API/MOCK badges or internal evidence counts.

---

### Task 1: Lock the user-visible trend contract with component tests

**Files:**
- Modify: `frontend-vue-main/tests/views/MyPageTrendView.test.js`
- Test: `frontend-vue-main/tests/views/MyPageTrendView.test.js`

**Interfaces:**
- Consumes: `MyPageTrendView` with optional `trendData` object prop.
- Produces: assertions for the six metrics, strength/weakness summaries, neutral WPM, and insufficient previous history state.

- [ ] **Step 1: Replace old five-practice and repeated-pattern assertions with the approved screen contract**

```js
test('shows six recent-three presentation metrics and strength/weakness summaries', () => {
  const wrapper = mount(MyPageTrendView)
  expect(wrapper.findAll('[data-testid="core-metric-card"]')).toHaveLength(6)
  expect(wrapper.text()).toContain('최근 3회')
  expect(wrapper.text()).toContain('나의 강점')
  expect(wrapper.text()).toContain('개선이 필요한 부분')
  expect(wrapper.text()).not.toContain('반복 감지 패턴')
})

test('keeps average WPM neutral', () => {
  const wrapper = mount(MyPageTrendView)
  const card = wrapper.get('[data-testid="average-wpm"]')
  expect(card.text()).toContain('평균 발화 속도')
  expect(card.text()).toContain('참고 지표')
  expect(card.classes()).not.toContain('is-good')
  expect(card.classes()).not.toContain('is-weak')
})
```

- [ ] **Step 2: Add a literal three-record fixture and assert the gray previous-history state**

```js
const insufficientTrend = {
  recentPractices: [{ id: 3 }, { id: 2 }, { id: 1 }],
  previousPractices: [],
  metrics: [],
  strengths: [],
  weaknesses: [],
  speechReference: {},
  goal: null,
}

test('renders gray insufficient-history comparison slots without hiding recent data', () => {
  const wrapper = mount(MyPageTrendView, { props: { trendData: insufficientTrend } })
  expect(wrapper.findAll('[data-testid="previous-data-empty"]').length).toBeGreaterThan(0)
  expect(wrapper.text()).toContain('이전 기록이 부족해요')
  expect(wrapper.get('[data-testid="previous-data-empty"]').classes()).toContain('is-disabled')
})
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run: `npm test -- tests/views/MyPageTrendView.test.js`
Expected: FAIL because the new metric cards, injectable `trendData`, and insufficient-history state do not exist.

### Task 2: Implement the approved presentation trend mock

**Files:**
- Modify: `frontend-vue-main/src/views/mypage/MyPageTrendView.vue`
- Test: `frontend-vue-main/tests/views/MyPageTrendView.test.js`

**Interfaces:**
- Consumes: optional `trendData` with `recentPractices`, `previousPractices`, `metrics`, `strengths`, `weaknesses`, `speechReference`, and `goal`.
- Produces: rendered recent-three dashboard; `hasPreviousData` is true only when `previousPractices.length >= 3`.

- [ ] **Step 1: Add the production-shaped default mock and computed comparison state**

```js
const props = defineProps({
  trendData: { type: Object, default: () => PRESENTATION_TREND_MOCK },
})
const current = computed(() => props.trendData)
const hasPreviousData = computed(() => current.value.previousPractices.length >= 3)
```

Each of the six metric objects contains `key`, `label`, `value`, `unit`, `direction`, `recentValues`, and `previousAverage`. The default mock contains six practices so comparison deltas and the full trend are visible.

- [ ] **Step 2: Replace the five-practice score, repeated-pattern, and table sections**

Render the following sections in order:

1. recent-three/previous-three explanation and tabs,
2. six core metric cards,
3. strengths and weaknesses,
4. neutral speech reference values,
5. selectable six-practice trend,
6. next-practice goal.

For every comparison slot use this branch:

```vue
<span v-if="hasPreviousData" class="metric-delta">{{ metric.deltaLabel }}</span>
<span v-else data-testid="previous-data-empty" class="metric-delta is-disabled">
  이전 기록이 부족해요
</span>
```

- [ ] **Step 3: Implement responsive and disabled-state styling**

Use the existing page tokens and add a gray state with `#f3f4f7` background, `#c7ccd8` text, and dashed `#d9dde6` border. Collapse six metric cards from three columns to two below 900px and one below 520px; stack strengths/weaknesses on mobile.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- tests/views/MyPageTrendView.test.js`
Expected: all `MyPageTrendView` tests pass.

### Task 3: Regression and rendered QA

**Files:**
- Verify: `frontend-vue-main/src/views/mypage/MyPageTrendView.vue`
- Verify: `frontend-vue-main/tests/views/MyPageTrendView.test.js`

**Interfaces:**
- Consumes: built frontend and local `/mypage/trend` route.
- Produces: test, build, desktop, mobile, console, and interaction evidence.

- [ ] **Step 1: Run the full frontend test suite**

Run: `npm test`
Expected: all tests pass with no new warnings.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Vite exits with code 0.

- [ ] **Step 3: Validate the rendered route in the Browser plugin**

Open `http://127.0.0.1:5180/mypage/trend`, verify the page title and meaningful DOM, ensure there is no framework overlay or relevant console error, capture desktop and mobile screenshots, click a core metric selector, and confirm the chart title/values update.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check` and `git diff -- frontend-vue-main/src/views/mypage/MyPageTrendView.vue frontend-vue-main/tests/views/MyPageTrendView.test.js`
Expected: no whitespace errors and no backend file changes.
