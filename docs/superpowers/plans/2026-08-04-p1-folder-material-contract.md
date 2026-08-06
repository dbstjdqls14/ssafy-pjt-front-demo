# P1 Folder and Existing Material Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폴더 선택과 기존 발표 자료 재사용을 서버 ID와 실제 API 계약에 맞추고, 중도 종료 Practice를 완료 연습 횟수로 잘못 표시하지 않게 한다.

**Architecture:** 폴더와 기존 자료는 서버 ID를 유일한 식별자로 사용한다. 폴더 목록의 횟수는 `completedReportCount`가 명시적으로 제공될 때만 표시하고, 현재의 `practiceCount` fallback을 제거한다. 기존 자료는 서버 목록 조회와 `/presentations/reuse`를 통해서만 재사용하며 upload/reuse 상태를 상호 배타적으로 관리한다.

**Tech Stack:** Vue 3, Pinia 4, Vue Router 4, existing Spring API client, Vitest 4, Vue Test Utils

## Global Constraints

- 폴더 이름과 자료 제목을 Vue `key`나 선택 식별자로 사용하지 않는다.
- 오른쪽 폴더 상세에는 폴더 이름과 설명만 표시한다.
- 잘못된 연습 횟수 대신 `데이터 없음`이나 최고/최근 점수 UI를 표시하지 않는다.
- 현재 Spring이 완료 리포트 수를 주지 않으면 횟수를 숨긴다.
- 기존 자료는 `GET /practice-folders/{folderId}/presentation-practices`로 조회한다.
- 재사용은 `POST /presentations/reuse`로 한 번만 수행한다.
- 뒤로 가기 후 다른 자료 모드의 상태가 남지 않게 한다.
- 아이디 찾기는 유지하고 비밀번호 찾기 진입과 동작만 제거한다.
- 백엔드 API 계약은 Git 커밋 `61875df865df4305f70ecf5b358cd7c942764e5c`의 `backend-spring-develop`을 읽기 전용 기준으로 사용한다.
- `backend-spring-develop`과 `backend-fastapi-main`은 수정하지 않는다.
- 브라우저 수동·자동 테스트는 사용자가 수행한다. 구현자는 Vitest와 Vite production build까지만 실행한다.

---

## File Map

- Modify `frontend-vue-main/src/api/normalizers/practice.js`: 완료 횟수와 설명의 strict normalization
- Modify `frontend-vue-main/src/stores/practiceStore.js`: 폴더 ID 선택과 조회 상태
- Modify `frontend-vue-main/src/views/practice/FolderSelectView.vue`: ID key, 설명 전용 preview, 요청 잠금
- Modify `frontend-vue-main/src/assets/styles/views/folder-select.css`: 설명 preview와 동일 이름 선택 스타일
- Modify `frontend-vue-main/tests/views/FolderSelectView.test.js`: 동일 이름, 설명, 잘못된 횟수 회귀 테스트
- Modify `frontend-vue-main/src/stores/presentationStore.js`: 자료 모드와 상호 배타적 상태 전이
- Modify `frontend-vue-main/src/views/presentation/PresentationSetupView.vue`: 서버 목록 조회, 이전/다음 상태 정리
- Modify `frontend-vue-main/tests/views/PresentationSetupView.test.js`: 뒤로 가기·재선택·중복 reuse 회귀 테스트
- Modify `frontend-vue-main/tests/api/springPresentationApi.test.js`: 기존 자료 GET과 reuse POST 계약
- Modify `frontend-vue-main/src/views/auth/LoginView.vue`: 비밀번호 찾기 링크 제거
- Modify `frontend-vue-main/src/views/auth/FindAccountView.vue`: password tab과 reset 동작 제거
- Modify `frontend-vue-main/src/api/authApi.js`: 사용되지 않는 password reset client 제거
- Modify `frontend-vue-main/tests/views/LoginView.test.js`: 아이디 찾기 유지·비밀번호 찾기 제거 검증

### Task 1: 폴더 응답 의미와 ID 선택 수정

**Files:**
- Modify: `frontend-vue-main/src/api/normalizers/practice.js`
- Modify: `frontend-vue-main/src/views/practice/FolderSelectView.vue`
- Modify: `frontend-vue-main/tests/views/FolderSelectView.test.js`

**Interfaces:**
- Produces folder shape: `{ id, name, description, type, completedReportCount: number | null }`
- `completedReportCount` is never derived from `practiceCount`, `attempts.length`, or `attemptCount` unless the deployed archive contract explicitly documents that exact field as report-completed count.

- [ ] **Step 1: 동일 이름 폴더 ID 선택 실패 테스트 작성**

```js
practice.folders = [
  { id: '11', name: '같은 이름', description: '첫 번째 설명', type: 'presentation' },
  { id: '22', name: '같은 이름', description: '두 번째 설명', type: 'presentation' },
]
await wrapper.find('[data-folder-id="22"]').trigger('click')
expect(wrapper.findAll('.folder-row.selected')).toHaveLength(1)
expect(practice.folderId).toBe('22')
```

- [ ] **Step 2: preview와 잘못된 횟수 실패 테스트 작성**

선택된 폴더 오른쪽에 이름과 설명만 있고 `최고 점수`, `최근 연습`, `데이터 없음`이 없는지 검증한다. `practiceCount: 4`만 있는 응답에는 `4회 연습`이 표시되지 않는지 검증한다.

- [ ] **Step 3: 현재 구현에서 실패 확인**

Run: `npm test -- tests/views/FolderSelectView.test.js`

Expected: FAIL because `folder.name` is used as key/selected identity and score/history markup remains.

- [ ] **Step 4: normalizer와 template 구현**

- `:key="folder.id"`
- `:class="{ selected: selected?.id === folder.id }"`
- `:aria-pressed="selected?.id === folder.id"`
- `data-folder-id` 추가
- preview는 `selected.name`, `selected.description || '등록된 폴더 설명이 없습니다.'`만 렌더링
- `practiceCount`와 `attempts.length` fallback 제거

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/views/FolderSelectView.test.js`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add frontend-vue-main/src/api/normalizers/practice.js frontend-vue-main/src/views/practice/FolderSelectView.vue frontend-vue-main/tests/views/FolderSelectView.test.js
git commit -m "fix: 폴더 선택과 완료 횟수 의미 정정"
```

### Task 2: 폴더 화면 요청 잠금과 설명 레이아웃

**Files:**
- Modify: `frontend-vue-main/src/stores/practiceStore.js`
- Modify: `frontend-vue-main/src/views/practice/FolderSelectView.vue`
- Modify: `frontend-vue-main/src/assets/styles/views/folder-select.css`
- Modify: `frontend-vue-main/tests/views/FolderSelectView.test.js`

**Interfaces:**
- Produces: `isLoadingFolders`, `isCreatingFolder`, `canContinue`

- [ ] **Step 1: 조회·생성 중 상호작용 차단 테스트 작성**

`loadFolders()` 또는 `createFolder()` Promise가 pending인 동안 탭, 행, 다음 버튼이 disabled인지 확인한다. 생성 연타에도 create API가 한 번 호출되는지 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/views/FolderSelectView.test.js`

Expected: FAIL on rapid create/select scenario.

- [ ] **Step 3: store 상태와 동일 disabled 조건 구현**

조회/생성 중에는 선택·검색·탭·다음 동작을 handler에서도 거부한다. 설명은 긴 문자열을 줄바꿈하되 오른쪽 panel을 넘지 않게 `overflow-wrap: anywhere`를 적용한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/views/FolderSelectView.test.js`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend-vue-main/src/stores/practiceStore.js frontend-vue-main/src/views/practice/FolderSelectView.vue frontend-vue-main/src/assets/styles/views/folder-select.css frontend-vue-main/tests/views/FolderSelectView.test.js
git commit -m "fix: 폴더 조회와 생성 동작 잠금"
```

### Task 3: 기존 발표 자료 서버 조회 계약 고정

**Files:**
- Modify: `frontend-vue-main/src/api/practiceApi.js`
- Modify: `frontend-vue-main/src/api/presentationApi.js`
- Modify: `frontend-vue-main/tests/api/springPresentationApi.test.js`

**Interfaces:**
- Consumes: `folderId`, `sourcePresentationId`
- Produces: `practiceApi.getPresentationPractices(folderId)` and `presentationApi.reuse(request)`

- [ ] **Step 1: GET/POST 계약 테스트 작성**

```js
await practiceApi.getPresentationPractices(5)
expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/practice-folders/5/presentation-practices'), expect.anything())

await presentationApi.reuse({ folderId: 5, sourcePresentationId: 12, title: '연습', description: '' })
expect(lastJsonBody()).toMatchObject({ folderId: 5, sourcePresentationId: 12 })
```

- [ ] **Step 2: 요청/응답 adapter 검증**

목록 항목은 유효한 `presentationId`가 있는 것만 허용하고 ID 기준으로 중복 제거한다. 조회 실패 시 이전 캐시를 실제 서버 목록처럼 유지하지 않는다.

- [ ] **Step 3: API 테스트 통과 확인**

Run: `npm test -- tests/api/springPresentationApi.test.js`

Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add frontend-vue-main/src/api/practiceApi.js frontend-vue-main/src/api/presentationApi.js frontend-vue-main/tests/api/springPresentationApi.test.js
git commit -m "test: 기존 발표 자료 API 계약 고정"
```

### Task 4: upload/reuse 상태 중복 제거

**Files:**
- Modify: `frontend-vue-main/src/stores/presentationStore.js`
- Modify: `frontend-vue-main/src/views/presentation/PresentationSetupView.vue`
- Modify: `frontend-vue-main/tests/views/PresentationSetupView.test.js`

**Interfaces:**
- Produces: `materialMode` with `none | upload | reuse | existing-session`
- Produces: `selectUpload(file)`, `selectReuse(material)`, `clearMaterialSelection()`, `applySelectedMaterial()`

- [ ] **Step 1: 재현 시나리오 테스트 작성**

다음 순서를 자동화한다.

1. 새 자료 업로드 선택
2. 다음
3. 이전
4. 기존 자료 모달 열기
5. 서버 자료 선택
6. 다음
7. 이전
8. 기존 자료 모달 다시 열기

마지막에 선택된 기존 자료가 한 개이고, 로컬 File이 없으며, reuse POST가 총 한 번만 호출되는지 검증한다.

- [ ] **Step 2: 현재 분산 상태 때문에 실패하는지 확인**

Run: `npm test -- tests/views/PresentationSetupView.test.js`

Expected: FAIL because staged/source/reused/session states can coexist.

- [ ] **Step 3: 단일 materialMode 전이 구현**

- upload 선택 시 `reusedSource`, `appliedReuseId`, 이전 session slide를 제거
- reuse 선택 시 `stagedFile`, `sourceFile`, upload preview를 제거
- modal을 열 때 `loadReusableMaterials()`를 새로 호출
- 같은 `sourcePresentationId`가 이미 적용됐으면 reuse POST를 다시 호출하지 않음
- 선택 해제 시 현재 mode의 데이터만 정리하고 `none`으로 전이

- [ ] **Step 4: 다음 버튼 요청 잠금 구현**

upload/reuse API가 pending인 동안 이전·다음·모드 변경·선택 해제 버튼을 모두 막고 handler에서도 동일 조건을 검사한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/views/PresentationSetupView.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add frontend-vue-main/src/stores/presentationStore.js frontend-vue-main/src/views/presentation/PresentationSetupView.vue frontend-vue-main/tests/views/PresentationSetupView.test.js frontend-vue-main/tests/stores/springPresentationFlow.test.js
git commit -m "fix: 발표 자료 선택 모드 중복 제거"
```

### Task 5: 계정 찾기 노출 정리

**Files:**
- Modify: `frontend-vue-main/src/views/auth/LoginView.vue`
- Modify: `frontend-vue-main/src/views/auth/FindAccountView.vue`
- Modify: `frontend-vue-main/src/api/authApi.js`
- Modify: `frontend-vue-main/tests/views/LoginView.test.js`

**Interfaces:**
- Keeps: `POST /auth/find-id`
- Removes from UI/client: password recovery/reset entry and request

- [ ] **Step 1: 아이디 찾기 유지·비밀번호 찾기 제거 테스트 작성**

로그인 화면과 `/find-account`에서 `비밀번호 찾기`가 없고 `아이디 찾기`만 존재하는지 검증한다. 소셜 로그인 버튼도 존재하지 않는지 검증한다.

- [ ] **Step 2: 현재 password 링크 때문에 실패 확인**

Run: `npm test -- tests/views/LoginView.test.js`

Expected: FAIL because `LoginView.vue` links to `?tab=password`.

- [ ] **Step 3: password UI와 사용되지 않는 API 제거**

FindAccountView는 id form만 렌더링한다. 기존 `/find-account` 경로는 유지하여 북마크가 깨지지 않게 하고 password query는 id 화면으로 정규화한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/views/LoginView.test.js`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend-vue-main/src/views/auth/LoginView.vue frontend-vue-main/src/views/auth/FindAccountView.vue frontend-vue-main/src/api/authApi.js frontend-vue-main/tests/views/LoginView.test.js
git commit -m "fix: 비밀번호 찾기 진입 제거"
```

### Task 6: P1 전체 검증

**Files:**
- Test-only adjustments limited to the files above

- [ ] **Step 1: 관련 테스트 실행**

Run: `npm test -- tests/views/FolderSelectView.test.js tests/views/PresentationSetupView.test.js tests/api/springPresentationApi.test.js tests/views/LoginView.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

- [ ] **Step 2: 전체 테스트와 빌드 실행**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 3: 백엔드 디렉터리 무변경 확인**

Run: `git status --short -- backend-spring-develop backend-fastapi-main`

Expected: no output.

- [ ] **Step 4: 최종 커밋**

```bash
git add frontend-vue-main
git commit -m "test: 폴더와 발표 자료 재사용 회귀 검증"
```
