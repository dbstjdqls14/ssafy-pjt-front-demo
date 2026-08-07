# Interview Report Question Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 면접 리포트의 다음 질문 전환 안내를 실제 질문 종료 지점과 일치시키고 마지막 질문에서는 숨긴다.

**Architecture:** 질문 선택과 영상 재생 타임라인은 기존 `questions[].startSec/durationSec` 계약을 유지한다. 화면은 현재 질문의 존재 여부와 다음 질문 존재 여부로 안내 표시 조건을 계산하고, 질문 단위 그래프의 종료점인 `100%`에 안내를 배치한다.

**Tech Stack:** Vue 3 `<script setup>`, Vitest, Vue Test Utils

## Global Constraints

- 분석 버킷의 마지막 `endSec`은 질문 경계로 사용하지 않는다.
- 실제 영상 탐색과 질문 자동 전환 로직은 변경하지 않는다.
- 음성·몸짓 그래프가 같은 표시 조건과 위치를 사용한다.
- 기존의 다른 미커밋 변경을 수정하거나 커밋하지 않는다.

---

### Task 1: 질문 전환 안내의 실제 경계 정렬

**Files:**
- Modify: `src/views/interview/InterviewReportDetailView.vue:798-806,1207-1215,1310-1318`
- Test: `tests/views/InterviewReportDetailView.test.js`

**Interfaces:**
- Consumes: `selected`, `questions`, `current.durationSec`, `wasQuestionCutShort`
- Produces: `showQuestionTransitionMarker: ComputedRef<boolean>` 및 그래프 오른쪽 끝의 전환 안내

- [x] **Step 1: 분석 버킷이 일찍 끝나는 질문의 실패 테스트 작성**

  질문 1의 `durationSeconds`는 58초, 음성 버킷은 30~40초로 구성한다. 질문 2도 함께 제공하고 `.iv-pace-cutoff`의 인라인 `left`가 `100%`인지 검증한다.

- [x] **Step 2: 마지막 질문에서 안내가 없는 실패 테스트 작성**

  질문이 하나뿐이고 60초 전에 끝난 fixture를 제공한 뒤 `.iv-pace-cutoff`가 렌더링되지 않는지 검증한다.

- [x] **Step 3: 실패 원인 확인**

  실행:

  ```powershell
  node_modules/.bin/vitest run tests/views/InterviewReportDetailView.test.js
  ```

  예상 결과: 첫 테스트는 `68.9655%`와 `100%` 불일치, 두 번째 테스트는 마지막 질문에도 안내가 렌더링되어 실패한다.

- [x] **Step 4: 최소 구현**

  `selected < questions.length - 1 && wasQuestionCutShort`를 의미하는 계산값을 추가한다. 음성·몸짓 안내의 `v-if`에 이 값을 사용하고 `left: '100%'`를 적용한다. `paceCutoffPct`와 `gestureCutoffPct`는 질문 전환 표시에서 제거한다.

- [x] **Step 5: 대상 테스트 통과 확인**

  실행:

  ```powershell
  node_modules/.bin/vitest run tests/views/InterviewReportDetailView.test.js
  ```

  예상 결과: 대상 테스트 파일 전체 통과.

- [x] **Step 6: 전체 검증**

  실행:

  ```powershell
  node_modules/.bin/vitest run
  node_modules/.bin/vite build
  git diff --check
  ```

  예상 결과: 전체 테스트와 빌드 통과, 공백 오류 없음.

- [x] **Step 7: 변경 파일만 커밋**

  ```powershell
  git add src/views/interview/InterviewReportDetailView.vue tests/views/InterviewReportDetailView.test.js docs/superpowers/plans/2026-08-07-interview-report-question-boundary.md
  git commit -m "fix: align interview question boundary marker"
  ```
