# Presentation Upload Exit Guard and Support Size Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표 자료 업로드 중 이전 이동을 확인창으로 보호하고, 면접 지원 자료 등록 버튼에 실제 검증과 일치하는 최대 50MB 안내를 표시한다.

**Architecture:** 발표 설정 화면이 업로드 요청의 이탈 상태를 소유하고 Vue Router 이탈 가드와 하단 이전 버튼을 하나의 확인창 흐름으로 합친다. 면접 설정 화면은 기존 공통 PDF/50MB 검증 함수를 재사용하고, 등록 버튼 내부의 오른쪽 보조 문구로 제한을 노출한다.

**Tech Stack:** Vue 3 Composition API, Vue Router 4, Pinia, Vitest, Vue Test Utils, CSS

## Global Constraints

- 확인창 문구는 제목 `발표 자료를 업로드 중이에요`, 본문 `업로드가 끝나기 전에 이전 화면으로 돌아갈까요?`를 그대로 사용한다.
- 확인창 버튼은 `업로드 계속하기`, `이전 화면으로 돌아가기`를 사용한다.
- 업로드 중 하단 이전 버튼과 브라우저 뒤로가기는 같은 확인창을 사용한다.
- 사용자가 이탈을 확정한 뒤 완료된 비동기 업로드는 `/presentation/slides`로 강제 이동시키지 않는다.
- 새로고침과 탭 닫기는 이번 범위에서 제외한다.
- `기존 자료 선택` 버튼은 변경하지 않는다.
- 자기소개서와 포트폴리오 등록 버튼의 제목은 가운데를 유지하고 `최대 50MB`는 버튼 오른쪽에 작고 회색으로 표시한다.
- 면접 답변 텍스트 동작은 변경하지 않는다.
- 새 프레임워크나 의존성을 추가하지 않는다.

---

### Task 1: 발표 업로드 이탈 확인 흐름

**Files:**
- Modify: `tests/views/PresentationSetupView.test.js`
- Modify: `src/views/presentation/PresentationSetupView.vue`
- Modify: `src/assets/styles/views/presentation-setup.css`

**Interfaces:**
- Consumes: `presentation.uploadPresentation(file): Promise<void>`, `router.push(location)`, `onBeforeRouteLeave(guard)`
- Produces: `requestPrevious()`, `continueUpload()`, `confirmLeave()`, `data-testid="presentation-upload-leave-modal"`

- [ ] **Step 1: 하단 이전 버튼의 업로드 중 확인 동작 테스트 작성**

```js
it('업로드 중 이전 버튼을 누르면 이동하지 않고 확인창을 연다', async () => {
  const upload = deferred()
  vi.spyOn(presentation, 'uploadPresentation').mockReturnValue(upload.promise)

  await fillValidSetup(wrapper)
  await wrapper.get('.workflow-side-next').trigger('click')
  await flushPromises()
  await wrapper.get('.workflow-side-prev').trigger('click')

  expect(router.currentRoute.value.path).toBe('/presentation/setup')
  expect(wrapper.get('[data-testid="presentation-upload-leave-modal"]').text())
    .toContain('발표 자료를 업로드 중이에요')

  await wrapper.get('[data-testid="continue-presentation-upload"]').trigger('click')
  expect(wrapper.find('[data-testid="presentation-upload-leave-modal"]').exists()).toBe(false)
})
```

- [ ] **Step 2: 테스트를 실행해 현재 실패 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/PresentationSetupView.test.js`

Expected: FAIL because the previous control is still an unconditional `RouterLink` and the modal does not exist.

- [ ] **Step 3: 브라우저 뒤로가기와 늦은 업로드 완료 회귀 테스트 작성**

```js
it('브라우저 뒤로가기를 확인하고 이탈한 뒤 업로드가 끝나도 슬라이드로 이동하지 않는다', async () => {
  const upload = deferred()
  vi.spyOn(presentation, 'uploadPresentation').mockReturnValue(upload.promise)

  await fillValidSetup(wrapper)
  await wrapper.get('.workflow-side-next').trigger('click')
  await flushPromises()
  router.back()
  await flushPromises()

  expect(router.currentRoute.value.path).toBe('/presentation/setup')
  await wrapper.get('[data-testid="leave-presentation-upload"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/practice/folders')

  upload.resolve()
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/practice/folders')
})
```

- [ ] **Step 4: 공통 이탈 상태와 라우터 가드 구현**

```js
const leavePromptOpen = ref(false)
const pendingLeaveLocation = ref(null)
let allowRouteLeave = false
let submissionAbandoned = false

const openLeavePrompt = (location) => {
  pendingLeaveLocation.value = location
  leavePromptOpen.value = true
}

const requestPrevious = async () => {
  if (isSubmitting.value) {
    openLeavePrompt('/practice/folders?type=presentation')
    return
  }
  allowRouteLeave = true
  await router.push('/practice/folders?type=presentation')
}

onBeforeRouteLeave((to) => {
  if (allowRouteLeave || !isSubmitting.value) return true
  openLeavePrompt(to.fullPath)
  return false
})
```

- [ ] **Step 5: 확인창 결정과 업로드 완료 경쟁 조건 구현**

```js
const continueUpload = () => {
  leavePromptOpen.value = false
  pendingLeaveLocation.value = null
}

const confirmLeave = async () => {
  submissionAbandoned = true
  allowRouteLeave = true
  const target = pendingLeaveLocation.value || '/practice/folders?type=presentation'
  leavePromptOpen.value = false
  pendingLeaveLocation.value = null
  await router.push(target)
}

// goNext 성공 경로
if (submissionAbandoned) return
leavePromptOpen.value = false
pendingLeaveLocation.value = null
allowRouteLeave = true
await router.push('/presentation/slides')
```

- [ ] **Step 6: 하단 이전 버튼과 확인창 마크업·스타일 구현**

```vue
<button
  type="button"
  class="workflow-side-button workflow-side-prev"
  aria-label="폴더 선택으로 돌아가기"
  @click="requestPrevious"
>
  이전
</button>

<div v-if="leavePromptOpen" class="presentation-upload-leave-backdrop">
  <section data-testid="presentation-upload-leave-modal" role="dialog" aria-modal="true">
    <h2>발표 자료를 업로드 중이에요</h2>
    <p>업로드가 끝나기 전에 이전 화면으로 돌아갈까요?</p>
    <button data-testid="continue-presentation-upload" @click="continueUpload">업로드 계속하기</button>
    <button data-testid="leave-presentation-upload" @click="confirmLeave">이전 화면으로 돌아가기</button>
  </section>
</div>
```

- [ ] **Step 7: 발표 설정 테스트 통과 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/PresentationSetupView.test.js`

Expected: all `PresentationSetupView` tests PASS.

- [ ] **Step 8: 발표 이탈 방어 변경 커밋**

```powershell
git add frontend-vue-main/tests/views/PresentationSetupView.test.js frontend-vue-main/src/views/presentation/PresentationSetupView.vue frontend-vue-main/src/assets/styles/views/presentation-setup.css
git commit -m "fix: 발표 업로드 중 이탈 확인 추가"
```

### Task 2: 면접 지원 자료 50MB 안내와 실제 제한

**Files:**
- Modify: `tests/views/InterviewSetupView.test.js`
- Modify: `src/views/interview/InterviewSetupView.vue`
- Modify: `src/assets/styles/views/interview-flow.css`

**Interfaces:**
- Consumes: `validateSupportDocumentFile(file): string`, `interview.uploadResumeDoc(file, title)`, `interview.uploadPortfolioDoc(file, title)`
- Produces: `data-testid="resume-upload-limit"`, `data-testid="portfolio-upload-limit"`, registration-time 50MB rejection

- [ ] **Step 1: 버튼 안내와 초과 파일 거절 테스트 작성**

```js
it('자기소개서와 포트폴리오 등록 버튼 오른쪽에 50MB 제한을 표시한다', async () => {
  const { wrapper } = await mountView()
  expect(wrapper.get('[data-testid="resume-upload-limit"]').text()).toBe('최대 50MB')
  expect(wrapper.get('[data-testid="portfolio-upload-limit"]').text()).toBe('최대 50MB')
})

it('50MB를 초과한 지원 자료는 제목 입력과 업로드 전에 거절한다', async () => {
  const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 })
  // 테스트용 file input change를 발생시킨다.
  expect(wrapper.text()).toContain('PDF 파일은 50MB 이하여야 합니다.')
  expect(window.prompt).not.toHaveBeenCalled()
  expect(uploadResume).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 면접 설정 테스트를 실행해 현재 실패 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/InterviewSetupView.test.js`

Expected: FAIL because size labels and 50MB validation are not wired into this view.

- [ ] **Step 3: 공통 지원 문서 검증을 업로드 시작 전에 적용**

```js
import { validateSupportDocumentFile } from '../../utils/supportDocumentFiles.js'

const validationError = validateSupportDocumentFile(file)
if (validationError) {
  docsAuthError.value = validationError
  return
}
```

- [ ] **Step 4: 등록 버튼 오른쪽 안내 마크업과 반응형 스타일 구현**

```vue
<button class="iv-doc-choice iv-doc-upload-choice" type="button" @click="uploadDoc('resume')">
  <span>자기소개서 등록</span>
  <small data-testid="resume-upload-limit">최대 50MB</small>
</button>
```

```css
.interview-flow-page .iv-doc-upload-choice {
  position: relative;
  padding-inline: 58px;
}

.interview-flow-page .iv-doc-upload-choice small {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  color: #9aa3b5;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
```

- [ ] **Step 5: 면접 설정 테스트 통과 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/InterviewSetupView.test.js`

Expected: all `InterviewSetupView` tests PASS.

- [ ] **Step 6: 면접 지원 자료 변경 커밋**

```powershell
git add frontend-vue-main/tests/views/InterviewSetupView.test.js frontend-vue-main/src/views/interview/InterviewSetupView.vue frontend-vue-main/src/assets/styles/views/interview-flow.css
git commit -m "fix: 면접 지원 자료 용량 안내 및 검증 추가"
```

### Task 3: 회귀·빌드·렌더링 검증

**Files:**
- Verify: `frontend-vue-main/tests`
- Verify: `frontend-vue-main/src/views/presentation/PresentationSetupView.vue`
- Verify: `frontend-vue-main/src/views/interview/InterviewSetupView.vue`

**Interfaces:**
- Consumes: Task 1 and Task 2 deliverables
- Produces: verified test, build, diff, and rendered interaction evidence

- [ ] **Step 1: 관련 뷰 테스트 함께 실행**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/PresentationSetupView.test.js tests/views/InterviewSetupView.test.js`

Expected: both files PASS with no unhandled promise rejection.

- [ ] **Step 2: 전체 프런트 테스트 실행**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run`

Expected: all test files PASS.

- [ ] **Step 3: 프로덕션 빌드 실행**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vite\bin\vite.js' build`

Expected: Vite build completes successfully.

- [ ] **Step 4: 로컬 화면에서 레이아웃과 상호작용 확인**

```text
1. 발표 설정에서 유효한 자료를 선택하고 다음을 누른다.
2. 업로드 중 하단 이전과 브라우저 뒤로가기가 같은 확인창을 여는지 확인한다.
3. 업로드 계속하기가 현재 화면을 유지하는지 확인한다.
4. 이전 화면으로 돌아가기가 폴더 화면으로 이동하고 늦은 완료 후에도 슬라이드로 튀지 않는지 확인한다.
5. 면접 설정에서 두 등록 버튼의 제목이 가운데이고 최대 50MB가 오른쪽 회색 보조 문구인지 데스크톱과 좁은 폭에서 확인한다.
```

- [ ] **Step 5: 최종 diff와 작업 상태 확인**

Run: `git diff --check; git status --short; git log -5 --oneline`

Expected: whitespace errors are absent, only planned commits are present, and no unrelated files are modified.
