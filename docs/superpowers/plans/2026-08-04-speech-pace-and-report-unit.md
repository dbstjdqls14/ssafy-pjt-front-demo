# Speech Pace and Report Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실시간 말하기 속도 판정 기준을 2.5/4.0으로 조정하고 발표 리포트의 속도 표기를 초당 어절로 통일한다.

**Architecture:** 실시간 판정은 기존 공통 `speechPace` 유틸의 경계값만 조정한다. 발표 리포트는 서버 WPM 데이터를 변형하지 않고 표시 함수에서만 60으로 나누며, 그래프 계산과 탐색 동작은 그대로 유지한다.

**Tech Stack:** Vue 3, JavaScript, Vitest, Vue Test Utils

## Global Constraints

- 프런트엔드만 변경하고 백엔드 계약은 유지한다.
- 발표와 면접의 실시간 판정은 같은 공통 경계값을 사용한다.
- 발표 리포트의 사용자 노출 속도 단위는 `초당 N.NN어절`로 통일한다.
- 브라우저 테스트는 실행하지 않고 사용자가 직접 확인한다.

---

### Task 1: 실시간 속도 판정 경계 변경

**Files:**
- Modify: `frontend-vue-main/src/utils/speechPace.js`
- Test: `frontend-vue-main/tests/utils/speechPace.test.js`

**Interfaces:**
- Consumes: `speechPaceLevel(value, 'syllablesPerSecond')`
- Produces: `SPEECH_PACE_BANDS.syllablesPerSecond = { slow: 2.5, fast: 4.0 }`

- [ ] **Step 1: 경계값 회귀 테스트를 먼저 수정한다**

```js
expect(speechPaceLevel(2.4, 'syllablesPerSecond')).toBe('slow')
expect(speechPaceLevel(2.5, 'syllablesPerSecond')).toBe('normal')
expect(speechPaceLevel(4.0, 'syllablesPerSecond')).toBe('normal')
expect(speechPaceLevel(4.1, 'syllablesPerSecond')).toBe('fast')
```

- [ ] **Step 2: 테스트가 기존 3.0/5.5 경계 때문에 실패하는지 확인한다**

Run: `npm test -- tests/utils/speechPace.test.js`

- [ ] **Step 3: 공통 경계값을 변경한다**

```js
syllablesPerSecond: { slow: 2.5, fast: 4.0 }
```

- [ ] **Step 4: 속도 판정 테스트를 다시 실행한다**

Run: `npm test -- tests/utils/speechPace.test.js`

### Task 2: 발표 리포트의 WPM 노출을 초당 어절로 변환

**Files:**
- Modify: `frontend-vue-main/src/utils/displayFormatters.js`
- Modify: `frontend-vue-main/src/components/presentation-report/PresentationReportSummary.vue`
- Modify: `frontend-vue-main/src/components/presentation-report/PresentationReportAnalysis.vue`
- Test: `frontend-vue-main/tests/utils/displayFormatters.test.js`
- Test: `frontend-vue-main/tests/components/presentation-report/PresentationReportSummary.test.js`
- Test: `frontend-vue-main/tests/components/presentation-report/PresentationReportAnalysis.test.js`

**Interfaces:**
- Consumes: 서버 WPM 숫자와 `useVoicePaceGraph`의 `formatPace` 옵션
- Produces: `formatWordsPerSecond(value)`가 반환하는 `초당 N.NN어절` 표시 문자열

- [ ] **Step 1: 남아 있는 WPM 노출에 대한 실패 테스트를 추가한다**

```js
expect(wrapper.text()).toContain('평균 속도 · 초당 2.15어절')
expect(wrapper.text()).toContain('초당 1.97어절')
expect(wrapper.text()).toContain('초당 2.33어절')
expect(wrapper.text()).not.toContain('WPM')
```

- [ ] **Step 2: 테스트가 현재 WPM 출력 때문에 실패하는지 확인한다**

Run: `npm test -- tests/components/presentation-report/PresentationReportAnalysis.test.js`

- [ ] **Step 3: 표시 함수와 그래프 문구를 변경한다**

```js
export const formatWordsPerSecond = (value, fallback = '-') => {
  const wordsPerSecond = Number(value) / 60
  if (!Number.isFinite(wordsPerSecond) || wordsPerSecond < 0) return fallback
  return `초당 ${wordsPerSecond.toFixed(2)}어절`
}
```

`displayFormatters.js`에 위 함수를 추가하고 기존 발표 요약 컴포넌트의 로컬 변환 함수를 교체한다. 그래프 `formatPace`, 평균 문구, 측정 범위, 최저/최고 구간 칩에도 같은 함수를 사용하고 SVG 접근성 문구는 `10초 구간별 초당 어절 수`로 변경한다.

- [ ] **Step 4: 발표 리포트 컴포넌트 테스트를 다시 실행한다**

Run: `npm test -- tests/components/presentation-report/PresentationReportAnalysis.test.js`

### Task 3: 회귀 검증

**Files:**
- Verify only: `frontend-vue-main`

**Interfaces:**
- Consumes: Task 1과 Task 2의 변경
- Produces: 관련 테스트 및 프로덕션 빌드 성공 결과

- [ ] **Step 1: 두 변경의 관련 테스트를 함께 실행한다**

Run: `npm test -- tests/utils/speechPace.test.js tests/components/presentation-report/PresentationReportAnalysis.test.js tests/components/presentation-report/PresentationReportSummary.test.js`

- [ ] **Step 2: 프런트엔드 빌드를 실행한다**

Run: `npm run build`

- [ ] **Step 3: diff에서 백엔드 변경이 없는지 확인한다**

Run: `git diff --name-only -- backend-spring-develop backend-fastapi-main`
