# Frontend Input And Display Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 입력과 API 응답의 긴 문자열·긴 소수·비정상 숫자가 프런트 레이아웃이나 사용자 안내를 깨뜨리지 않게 한다.

**Architecture:** 입력 제한은 `constants/inputLimits.js`에서 공유하고 각 폼은 같은 상수로 `maxlength`, 카운터, 제출 검증을 수행한다. 숫자 표시는 `utils/displayFormatters.js`에서 도메인별 포맷으로 정규화하며, 긴 문자열은 기존 뷰의 의미를 유지한 채 명시적인 말줄임·줄바꿈 클래스로 방어한다.

**Tech Stack:** Vue 3, Pinia, Vitest, Vue Test Utils, CSS

## Global Constraints

- 기존 API payload와 서버에 저장된 원본 문자열·숫자는 변경하지 않는다.
- 아이디·닉네임과 폴더명은 최대 20자다.
- 발표·면접 연습 이름과 자료 제목은 최대 50자다.
- 연습 설명은 최대 100자다.
- 일반 소수는 최대 한 자리, 점수와 횟수는 정수로 표시한다.
- 비정상 숫자와 0~100 범위를 벗어난 점수는 `-`로 표시한다.
- 관련 없는 발표·면접 녹화 로직과 API 계약은 변경하지 않는다.

---

### Task 1: Shared limits and number formatters

**Files:**
- Create: `frontend-vue-main/src/constants/inputLimits.js`
- Create: `frontend-vue-main/src/utils/displayFormatters.js`
- Create: `frontend-vue-main/tests/utils/displayFormatters.test.js`
- Modify: `frontend-vue-main/tests/views/RegisterView.test.js`
- Modify: `frontend-vue-main/tests/views/FolderSelectView.test.js`

**Interfaces:**
- Produces: `INPUT_LIMITS`, `formatScore`, `formatCount`, `formatDecimal`, `formatPercent`, `formatWpm`.

- [ ] Write failing tests for 20-character IDs and folder names and for finite/range-safe numeric output.
- [ ] Run the focused tests and confirm failure is caused by the old 30/128-character contracts and raw decimal output.
- [ ] Implement shared constants and display formatters.
- [ ] Run focused tests and confirm they pass.

### Task 2: Form validation boundaries

**Files:**
- Modify: `frontend-vue-main/src/utils/validators.js`
- Modify: `frontend-vue-main/src/views/auth/RegisterView.vue`
- Modify: `frontend-vue-main/src/views/mypage/MyPageView.vue`
- Modify: `frontend-vue-main/src/views/practice/FolderSelectView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationSetupView.vue`
- Modify: `frontend-vue-main/src/views/interview/InterviewSetupView.vue`
- Modify: `frontend-vue-main/src/views/mypage/MyPageDocumentsView.vue`
- Modify: relevant view tests under `frontend-vue-main/tests/views/`

**Interfaces:**
- Consumes: `INPUT_LIMITS` from Task 1.

- [ ] Add failing assertions for `maxlength`, counters, and submit-time validation.
- [ ] Verify the focused tests fail against the old limits.
- [ ] Replace local literal limits with shared constants and add missing counters/errors.
- [ ] Verify each focused form test passes.

### Task 3: Long text rendering defense

**Files:**
- Modify: `frontend-vue-main/src/assets/styles/views/folder-select.css`
- Modify: `frontend-vue-main/src/assets/styles/views/archive-followup.css`
- Modify: `frontend-vue-main/src/assets/styles/views/folder-detail.css`
- Modify: `frontend-vue-main/src/assets/styles/views/mypage-refresh.css`
- Modify: `frontend-vue-main/src/assets/styles/views/presentation-flow.css`
- Modify: `frontend-vue-main/src/views/practice/FolderSelectView.vue`
- Modify: `frontend-vue-main/src/views/archive/ArchiveView.vue`
- Modify: `frontend-vue-main/src/views/archive/FolderDetailView.vue`
- Modify: `frontend-vue-main/src/views/mypage/MyPageDocumentsView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationSetupView.vue`
- Modify: `frontend-vue-main/src/views/interview/InterviewSetupView.vue`

**Interfaces:**
- Produces: title attributes and scoped ellipsis/wrapping behavior at each user-data display site.

- [ ] Add failing view assertions that long server values expose their full text through `title` while keeping a truncation class.
- [ ] Verify failures are caused by missing output defenses.
- [ ] Add title attributes and scoped CSS without changing original values.
- [ ] Run focused view tests.

### Task 4: Numeric rendering defense

**Files:**
- Modify: `frontend-vue-main/src/api/normalizers/trends.js`
- Modify: `frontend-vue-main/src/views/mypage/MyPageTrendView.vue`
- Modify: `frontend-vue-main/src/api/normalizers/practice.js`
- Modify: report normalizers only where raw API decimals reach templates.
- Modify: `frontend-vue-main/tests/api/trendsNormalizer.test.js`
- Modify: relevant report and archive tests.

**Interfaces:**
- Consumes: numeric formatters from Task 1.
- Produces: numeric source values for charts plus separate safe display strings for cards and labels.

- [ ] Add failing tests for long decimals, invalid scores, non-finite values, and one-decimal deltas.
- [ ] Verify the tests fail because current values are rendered raw.
- [ ] Add `displayValue` and safe score/count formatting without mutating chart values.
- [ ] Run focused normalizer and view tests.

### Task 5: Full regression and rendered QA

**Files:**
- Verify only; no source file is expected unless QA finds a reproducible regression.

**Interfaces:**
- Consumes: completed Tasks 1-4.

- [ ] Run all Vitest tests.
- [ ] Run the Vite production build.
- [ ] Run `git diff --check` and inspect the feature diff.
- [ ] Check folder creation, register, presentation setup, archive, and trend routes for clipping, wrapping, and runtime warnings.

