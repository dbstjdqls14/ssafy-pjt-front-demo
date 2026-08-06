# Interview Media Timeline and Profile Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TTS가 제외된 동일한 영상·오디오 타임라인과 만료 시 자동 갱신되는 프로필 이미지를 구현한다.

**Architecture:** `useRecorder`가 pause/resume 완료 Promise를 제공하고 면접 화면은 하나의 미디어 전환 함수로 영상·오디오·PCM·STT를 제어한다. 리포트는 서버 답변 시각만 사용하며, 헤더는 인증 스토어의 단발성 프로필 갱신 API를 사용한다.

**Tech Stack:** Vue 3, Pinia, MediaRecorder, Web Speech API, Vitest

## Global Constraints

- `backend-spring-develop`은 수정하지 않는다.
- 면접과 발표 화면을 공통 컴포넌트로 합치지 않는다.
- 브라우저 수동 테스트는 실행하지 않는다.

---

### Task 1: Awaitable recorder transitions

**Files:**
- Modify: `src/composables/useRecorder.js`
- Test: `tests/composables/useRecorder.test.js`

- [ ] MediaRecorder의 pause/resume 이벤트 완료를 기다리는 실패 테스트를 작성한다.
- [ ] 테스트가 기존 동기 구현에서 실패하는지 확인한다.
- [ ] `pause()`와 `resume()`이 상태 전환 완료 Promise를 반환하도록 최소 구현한다.
- [ ] 관련 테스트를 통과시킨다.

### Task 2: Synchronized interview TTS media gate

**Files:**
- Modify: `src/views/interview/InterviewRecordView.vue`
- Modify: `tests/views/InterviewRecordInterlock.test.js`

- [ ] TTS 시작 시 영상과 전체 오디오가 모두 pause되는 실패 테스트를 작성한다.
- [ ] TTS 종료 시 양쪽이 모두 resume된 뒤 잠금이 풀리는 실패 테스트를 작성한다.
- [ ] 영상·오디오·PCM을 함께 제어하는 비동기 미디어 게이트를 구현한다.
- [ ] 질문 전환·종료가 STT 확정 및 PCM flush까지 잠기는 기존 계약을 유지한다.

### Task 3: Remove ephemeral report correction

**Files:**
- Modify: `src/views/interview/InterviewReportDetailView.vue`
- Modify: `src/stores/interviewStore.js`
- Modify: `tests/views/InterviewReportDetailView.test.js`

- [ ] 서버 답변 시각이 브라우저 메모리 보정 없이 사용되는 실패 테스트를 작성한다.
- [ ] `sessionTtsWindows` 저장과 리포트 보정을 제거한다.
- [ ] 리포트 테스트를 통과시킨다.

### Task 4: Refresh expired profile image

**Files:**
- Modify: `src/stores/authStore.js`
- Modify: `src/components/common/AppHeader.vue`
- Create: `tests/components/AppHeader.test.js`

- [ ] 이미지 오류 시 `/users/me`를 한 번만 재조회하는 실패 테스트를 작성한다.
- [ ] 인증 스토어에 중복 호출을 합치는 `refreshProfileImage()`를 추가한다.
- [ ] 헤더에서 URL별 1회 갱신 및 닉네임 fallback을 구현한다.
- [ ] 컴포넌트 테스트를 통과시킨다.

### Task 5: Verification

**Files:**
- Review: all changed files

- [ ] 변경 관련 테스트를 실행한다.
- [ ] 전체 `npm test`를 실행한다.
- [ ] `npm run build`를 실행한다.
- [ ] `git diff --check`와 최종 diff를 검토한다.
