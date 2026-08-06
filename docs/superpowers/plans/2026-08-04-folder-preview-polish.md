# Folder Preview Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표·면접 폴더 선택 화면을 기준 시안에 가깝게 정돈하고 빈 연습 데이터를 `-`로 표시한다.

**Architecture:** 기존 `FolderSelectView.vue`의 API·스토어 데이터 흐름은 유지하고 표시 분기만 변경한다. `folder-select.css`에서 우측 요약 패널과 목록 행의 반응형 비율을 조정하며, `FolderSelectView.test.js`가 빈 데이터와 정상 데이터 계약을 검증한다.

**Tech Stack:** Vue 3, Pinia, CSS, Vitest, Vue Test Utils

## Global Constraints

- 백엔드와 API 계약을 변경하지 않는다.
- 폴더명이나 응답 순서에 의존한 하드코딩을 추가하지 않는다.
- 로딩과 오류 상태는 `-`로 숨기지 않는다.
- 발표와 면접에 동일한 표시 규칙을 적용한다.

---

### Task 1: 빈 연습 표시 계약

**Files:**
- Modify: `frontend-vue-main/tests/views/FolderSelectView.test.js`
- Modify: `frontend-vue-main/src/views/practice/FolderSelectView.vue`

**Interfaces:**
- Consumes: `selected.best`, `folder.latestScore`, `practice.recentPractices`
- Produces: 완료 기록이 없을 때 각 표시 영역의 텍스트 `-`

- [ ] **Step 1: 빈 폴더가 세 위치에 `-`를 표시하는 실패 테스트 작성**
- [ ] **Step 2: 테스트를 실행해 기존 빈 상태 문구 때문에 실패하는지 확인**
- [ ] **Step 3: 목록 점수·최고 점수·최근 연습 빈 분기를 `-`로 변경**
- [ ] **Step 4: 테스트를 다시 실행해 통과 확인**

### Task 2: 기준 시안 비율로 UI 정돈

**Files:**
- Modify: `frontend-vue-main/src/assets/styles/views/folder-select.css`
- Test: `frontend-vue-main/tests/views/FolderSelectView.test.js`

**Interfaces:**
- Consumes: 기존 `.folder-row`, `.folder-preview-*` DOM 구조
- Produces: 선택 행 단독 강조와 조밀한 우측 요약 레이아웃

- [ ] **Step 1: 정상 데이터의 제목·최고 점수·최근 3회 구조 회귀 테스트 확인**
- [ ] **Step 2: 우측 패널 여백, 제목, 점수, 구분선, 최근 행 크기를 반응형으로 조정**
- [ ] **Step 3: 폴더 선택 화면 테스트 실행**
- [ ] **Step 4: 전체 테스트와 프로덕션 빌드 실행**
