# Upload, Folder Delete, Pause and Slide Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 면접 PDF 계약, 폴더 삭제, 발표 일시정지 분석 중단, 슬라이드 전환 직렬화를 프런트에서 안전하게 구현한다.

**Architecture:** 각 기능 소유 화면과 Store 경계에서 검증 및 비동기 잠금을 적용한다. 서버 상태를 낙관적으로 먼저 바꾸지 않고 성공 응답 뒤에 로컬 상태를 커밋하며, 기존 API와 전환 게이트를 재사용한다.

**Tech Stack:** Vue 3, Pinia, Vitest, Vue Test Utils

## Global Constraints

- Spring/FastAPI/DB는 수정하지 않는다.
- 발표 자료 처리 진행 표시는 이번 범위에서 제외한다.
- 사용자 오류 문구는 한국어 행동 안내형 문구로 제공한다.
- 기존 dirty worktree의 관련 없는 변경을 보존한다.

---

### Task 1: 면접 PDF 파일 계약

**Files:**
- Modify: `src/views/interview/InterviewSetupView.vue`
- Test: `tests/views/InterviewSetupView.test.js`

**Interfaces:**
- Consumes: 브라우저 `File`의 `name`, `type`
- Produces: PDF만 통과시키는 파일 선택 흐름과 사용자 오류 문구

- [ ] **Step 1: Write the failing test**

파일 입력 생성 시 `accept`가 `.pdf,application/pdf`이고, 비-PDF 파일 선택 시 등록 흐름이 중단되며 `PDF 파일만 업로드할 수 있어요. PDF 파일을 선택해 주세요.`가 표시되는 테스트를 작성한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/views/InterviewSetupView.test.js`

Expected: 기존 `.pdf,.doc,.docx` 계약 또는 오류 문구 부재로 FAIL.

- [ ] **Step 3: Write minimal implementation**

`uploadDoc(kind)`에서 PDF 전용 accept를 지정하고 파일 선택 콜백에서 확장자와 MIME 타입을 검증한다. 실패 시 화면 오류 상태를 갱신하고 prompt/API 호출을 하지 않는다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/views/InterviewSetupView.test.js`

Expected: PASS.

### Task 2: 폴더 삭제 확인과 상태 복구

**Files:**
- Modify: `src/views/practice/FolderSelectView.vue`
- Modify: `src/stores/practiceStore.js`
- Modify: `src/assets/styles/views/folder-select.css`
- Test: `tests/views/FolderSelectView.test.js`
- Test: `tests/stores/practiceStore.test.js`

**Interfaces:**
- Consumes: `practice.removeFolder(folderId): Promise<void>`
- Produces: 선택 폴더 X 버튼, 확인 모달, 삭제 성공 후 다음 선택 복구

- [ ] **Step 1: Write the failing tests**

선택 폴더의 X 클릭 시 확인 모달이 열리고, 확인 연타에도 삭제 API가 한 번만 호출되며, 성공 후 삭제된 ID가 목록에서 제거되는 테스트를 작성한다. 삭제 실패 시 모달 또는 오류가 유지되고 목록이 바뀌지 않는 경우도 검증한다.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/views/FolderSelectView.test.js tests/stores/practiceStore.test.js`

Expected: 삭제 UI 부재와 숫자/문자 ID 제거 불일치로 FAIL.

- [ ] **Step 3: Write minimal implementation**

Store의 필터를 `String(folder.id) !== String(id)`로 수정한다. View에 `deleteTarget`, `isDeleting`, `deleteError` 상태와 모달을 추가하고 성공 후 남은 첫 폴더로 선택을 복구한다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/views/FolderSelectView.test.js tests/stores/practiceStore.test.js`

Expected: PASS.

### Task 3: 발표 일시정지 분석 경계

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Test: `tests/views/PresentationRecordLifecycle.test.js`

**Interfaces:**
- Consumes: `recording.isPaused`, `faceAnalysis.start(video)`, `faceAnalysis.stop()`
- Produces: 일시정지 동안 변하지 않는 실시간 분석과 감지 누적

- [ ] **Step 1: Write the failing test**

일시정지 버튼을 누르면 `faceAnalysis.stop()`이 호출되고, 일시정지 중 tick에서 통계 누적이 일어나지 않으며, 재개 시 `faceAnalysis.start()`가 한 번 호출되는 테스트를 작성한다. 연타 시 전환 게이트가 중복 전환을 막는지도 검증한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/views/PresentationRecordLifecycle.test.js`

Expected: 현재 수동 일시정지에서 MediaPipe가 중단되지 않아 FAIL.

- [ ] **Step 3: Write minimal implementation**

수동 pause 경로에 `faceAnalysis.stop()`을 추가하고 `onTick()`에 paused guard를 추가한다. 재개는 기존 `resumeCapture()`의 start 경로를 사용하며 비동기 전환이 끝나기 전 버튼을 잠근다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/views/PresentationRecordLifecycle.test.js`

Expected: PASS.

### Task 4: 발표 슬라이드 전환 직렬화

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Modify: `src/stores/presentationStore.js`
- Test: `tests/views/PresentationRecordLifecycle.test.js`
- Test: `tests/stores/springPresentationFlow.test.js`

**Interfaces:**
- Consumes: `presentation.recordSlideTransition(fromIndex, toIndex, elapsedSeconds): Promise`
- Produces: 성공 뒤 로컬 커밋, 요청 중 다음 이동 잠금, 이전 이동 차단

- [ ] **Step 1: Write the failing tests**

이전 버튼이 항상 비활성화되는지, 다음 클릭 후 API Promise가 끝나기 전 화면 인덱스가 유지되는지, 연타가 한 요청만 만드는지, 실패 시 슬라이드와 타임라인이 유지되는지 테스트한다.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/views/PresentationRecordLifecycle.test.js tests/stores/springPresentationFlow.test.js`

Expected: 기존 낙관적 로컬 변경과 fire-and-forget 호출 때문에 FAIL.

- [ ] **Step 3: Write minimal implementation**

Store에서 서버 요청 성공 후 타임라인과 인덱스를 커밋한다. View의 `moveSlide`를 async로 만들고 `transitionGate.runExclusive`로 감싸며, 성공 뒤에만 `slideIndex`를 바꾼다. 이전 버튼과 핸들러는 제거 또는 영구 비활성화한다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/views/PresentationRecordLifecycle.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

### Task 5: 회귀 검증

**Files:**
- Verify only

**Interfaces:**
- Consumes: Tasks 1-4의 변경
- Produces: 테스트와 빌드 증거

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --run tests/views/InterviewSetupView.test.js tests/views/FolderSelectView.test.js tests/stores/practiceStore.test.js tests/views/PresentationRecordLifecycle.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Review diff**

Run: `git diff --check` and `git status --short`

Expected: whitespace 오류 없음, 백엔드 변경 없음, 기존 unrelated dirty files 보존.
