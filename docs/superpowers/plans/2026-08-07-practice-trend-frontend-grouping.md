# Practice Trend Frontend Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 응답 변경 없이 내 학습 추이의 2·4·6개 기록을 각각 1:1, 2:2, 3:3으로 비교한다.

**Architecture:** API normalizer가 백엔드와 동일한 절반 분할을 단일 계산 지점으로 소유한다. Vue 화면은 normalizer가 제공한 `previousCount`, `recentCount`, 라벨만 소비하여 분석 잠금, 그래프, 설명의 비교 집단을 일치시킨다.

**Tech Stack:** Vue 3, Vitest, JavaScript

## Global Constraints

- 백엔드 API와 DTO는 변경하지 않는다.
- 반환된 최신 최대 6개 기록만 사용한다.
- 유효한 두 trend와 양쪽 구간이 모두 있을 때만 비교 분석을 활성화한다.
- 관련 없는 마이페이지 동작이나 스타일은 변경하지 않는다.

---

### Task 1: 그룹 계약 회귀 테스트

**Files:**
- Modify: `tests/api/trendsNormalizer.test.js`
- Modify: `tests/views/MyPageTrendView.test.js`

**Interfaces:**
- Consumes: `normalizePracticeTrends(response)`와 `MyPageTrendView`
- Produces: 2개 1:1, 4개 2:2 동작을 고정하는 회귀 테스트

- [ ] **Step 1: 정규화 실패 테스트 작성**

  기존 4개를 1:3으로 기대하는 테스트를 2:2로 변경하고, 두 기록과 두 trend가 있을 때 `hasPreviousData: true`, `previousCount: 1`, `recentCount: 1`을 기대한다.

- [ ] **Step 2: 화면 실패 테스트 작성**

  두 기록과 `earlyTrend`, `lateTrend`를 반환하도록 API를 준비하고 잠금이 해제되며 `최근 1회와 이전 1회` 문구가 렌더링되는지 검증한다.

- [ ] **Step 3: 실패 확인**

  Run: `vitest run tests/api/trendsNormalizer.test.js tests/views/MyPageTrendView.test.js`

  Expected: 기존 `recentCount = Math.min(3, length)` 로직 때문에 2개·4개 기대값이 실패한다.

### Task 2: 프런트 그룹 계산 통일

**Files:**
- Modify: `src/api/normalizers/trends.js`
- Modify: `src/views/mypage/MyPageTrendView.vue`

**Interfaces:**
- Consumes: `earlyTrend`, `lateTrend`, `practices`
- Produces: 백엔드 절반 분할과 일치하는 `previousCount`, `recentCount`, `previousLabel`, `recentLabel`, `hasPreviousData`

- [ ] **Step 1: 최소 정규화 구현**

  `previousCount = Math.floor(practices.length / 2)`, `recentCount = practices.length - previousCount`로 계산하고 두 동적 라벨을 반환한다.

- [ ] **Step 2: 화면 문구 통일**

  비교 문구와 하단 그래프 그룹 라벨이 `previousLabel`, `recentLabel`을 사용하게 한다. 그래프 좌표와 구간 판정은 기존 count 소비 구조를 유지한다.

- [ ] **Step 3: 관련 테스트 통과 확인**

  Run: `vitest run tests/api/trendsNormalizer.test.js tests/views/MyPageTrendView.test.js`

  Expected: PASS.

### Task 3: 회귀 검증

**Files:**
- Verify: `src/api/normalizers/trends.js`
- Verify: `src/views/mypage/MyPageTrendView.vue`

**Interfaces:**
- Consumes: 수정된 프런트 코드
- Produces: 테스트 및 빌드 검증 결과

- [ ] **Step 1: 관련 API·스토어 테스트 실행**

  Run: `vitest run tests/api/practiceTrendsApi.test.js tests/api/trendsNormalizer.test.js tests/views/MyPageTrendView.test.js tests/stores/stores.test.js`

  Expected: PASS.

- [ ] **Step 2: 프로덕션 빌드 실행**

  Run: `vite build`

  Expected: exit code 0.

- [ ] **Step 3: diff 검토**

  `git diff -- src/api/normalizers/trends.js src/views/mypage/MyPageTrendView.vue tests/api/trendsNormalizer.test.js tests/views/MyPageTrendView.test.js`에서 그룹 계산 외 변경이 없는지 확인한다.
