# Recording Permission Modal Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표와 면접 녹화의 권한 차단 모달을 단일 공통 컴포넌트로 통일하고, 권한 복구 성공 시 중단 전 진행 상태를 자동 복원한다.

**Architecture:** 새 `RequiredMediaPermissionModal.vue`는 고정 문구와 단일 확인 버튼만 담당하고 `confirm` 이벤트를 각 녹화 화면으로 전달한다. 발표와 면접 화면은 기존 장치 요청·녹화 생명주기를 유지하되, 성공 시에만 모달을 닫고 진행 중이었다면 자동 재개하며 실패 시 오류 원문 없이 모달을 유지한다.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue Router 4, Vitest, Vue Test Utils, scoped CSS

## Global Constraints

- 제목은 `카메라와 마이크 권한이 필요합니다.`를 그대로 사용한다.
- 본문은 `주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.`를 그대로 사용한다.
- 버튼은 `확인` 하나만 표시하고 요청 중에는 `확인 중…`으로 표시한다.
- 권한 재확인 실패 시 모달을 유지하고 브라우저 원문 오류와 별도 오류 문단을 노출하지 않는다.
- 카메라와 마이크가 모두 복구됐을 때만 모달을 닫는다.
- 진행 중 권한 상실이었다면 발표와 면접을 자동 재개한다.
- 시작 전 권한 실패였다면 자동으로 발표나 면접을 시작하지 않는다.
- 권한 모달의 `발표 종료하기`, `면접 종료` 버튼만 제거하며 일반 이탈 확인과 정상 종료 동작은 변경하지 않는다.
- 새 의존성을 추가하지 않는다.

---

### Task 1: 공통 미디어 권한 모달

**Files:**
- Create: `src/components/common/RequiredMediaPermissionModal.vue`
- Create: `tests/components/RequiredMediaPermissionModal.test.js`

**Interfaces:**
- Consumes: prop `busy: boolean`
- Produces: event `confirm`, test id `required-media-permission-confirm`

- [ ] **Step 1: 공통 문구·단일 버튼·이벤트 테스트 작성**

```js
import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import RequiredMediaPermissionModal from '../../src/components/common/RequiredMediaPermissionModal.vue'

test('renders fixed permission guidance and emits confirm from one button', async () => {
  const wrapper = mount(RequiredMediaPermissionModal)
  expect(wrapper.text()).toContain('카메라와 마이크 권한이 필요합니다.')
  expect(wrapper.text()).toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
  expect(wrapper.findAll('button')).toHaveLength(1)
  await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
  expect(wrapper.emitted('confirm')).toHaveLength(1)
})

test('disables the button and shows progress while checking', () => {
  const wrapper = mount(RequiredMediaPermissionModal, { props: { busy: true } })
  const button = wrapper.get('[data-testid="required-media-permission-confirm"]')
  expect(button.text()).toBe('확인 중…')
  expect(button.attributes('disabled')).toBeDefined()
})
```

- [ ] **Step 2: 컴포넌트 테스트를 실행해 구현 부재 실패 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/components/RequiredMediaPermissionModal.test.js`

Expected: FAIL because `RequiredMediaPermissionModal.vue` does not exist.

- [ ] **Step 3: 공통 컴포넌트와 면접 기준 스타일 구현**

```vue
<script setup>
defineProps({ busy: { type: Boolean, default: false } })
defineEmits(['confirm'])
</script>

<template>
  <div class="required-media-permission-modal" role="dialog" aria-modal="true" aria-labelledby="requiredMediaPermissionTitle">
    <div class="required-media-permission-dialog">
      <h2 id="requiredMediaPermissionTitle">카메라와 마이크 권한이 필요합니다.</h2>
      <p>주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.</p>
      <button data-testid="required-media-permission-confirm" type="button" :disabled="busy" @click="$emit('confirm')">
        {{ busy ? '확인 중…' : '확인' }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 공통 컴포넌트 테스트 통과 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/components/RequiredMediaPermissionModal.test.js`

Expected: 2 tests PASS.

### Task 2: 발표 권한 복구 자동 재개

**Files:**
- Modify: `src/views/presentation/PresentationRecordView.vue`
- Modify: `tests/views/PresentationDeviceGuard.test.js`

**Interfaces:**
- Consumes: `RequiredMediaPermissionModal`, `requestRequiredDevices()`, `connectCaptureSources()`, `resumeCapture()`
- Produces: presentation permission recovery with no exit action and conditional automatic resume

- [ ] **Step 1: 발표 모달 통일·자동 재개·실패 유지 테스트 수정 및 추가**

```js
expect(wrapper.get('.required-media-permission-dialog').text())
  .toContain('카메라와 마이크 권한이 필요합니다.')
expect(wrapper.findAll('.required-media-permission-dialog button')).toHaveLength(1)
expect(wrapper.text()).not.toContain('발표 종료하기')

await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
await flushPromises()
expect(recorder.resume).toHaveBeenCalledOnce()
expect(wrapper.find('.required-media-permission-modal').exists()).toBe(false)
```

실패 테스트에서는 `requestRequiredDevices`가 `NotAllowedError`를 던지게 하고 모달이 남아 있으며 `Permission denied`와 별도 오류 문단이 없는지 검증한다. 시작 실패 테스트에서는 복구 성공 뒤 `presentation.startRecordingSession`이 추가 호출되지 않는지 검증한다.

- [ ] **Step 2: 발표 테스트를 실행해 기존 두 버튼·수동 재개 때문에 실패 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/PresentationDeviceGuard.test.js`

Expected: FAIL because the view still renders the presentation-specific modal and does not automatically resume.

- [ ] **Step 3: 발표 화면에 공통 모달과 복구 전 상태 기록 적용**

```js
let resumeAfterDeviceRecovery = false

freezeForDeviceLoss = ({ kind } = {}) => {
  // existing guards and blocked state
  resumeAfterDeviceRecovery = recording.isRecording && !recording.isPaused
  pauseForDeviceLoss()
}

const requestDevicesAfterLoss = async () => {
  if (deviceRetrying.value) return false
  deviceRetrying.value = true
  try {
    await requestRequiredDevices(INTERVIEW_MEDIA_CONSTRAINTS)
    await connectCaptureSources()
    deviceBlocked.value = false
    if (resumeAfterDeviceRecovery) resumeCapture()
    resumeAfterDeviceRecovery = false
    return true
  } catch {
    deviceBlocked.value = true
    return false
  } finally {
    deviceRetrying.value = false
  }
}
```

기존 `deviceBlockCopy`, 권한 오류 문단과 권한 모달의 종료 버튼을 제거하고 공통 컴포넌트를 렌더링한다.

- [ ] **Step 4: 발표 테스트 통과 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/PresentationDeviceGuard.test.js`

Expected: all presentation device guard tests PASS.

### Task 3: 면접 권한 모달 통일

**Files:**
- Modify: `src/views/interview/InterviewRecordView.vue`
- Modify: `tests/views/InterviewRecordMediaControls.test.js`

**Interfaces:**
- Consumes: `RequiredMediaPermissionModal`, existing `resumeAfterDeviceRecovery`, `requestDevicesAfterLoss()`
- Produces: interview permission modal with fixed copy, one confirm action, no raw retry error

- [ ] **Step 1: 면접 고정 문구·단일 버튼·성공·실패 테스트 수정 및 추가**

```js
expect(wrapper.get('.required-media-permission-dialog').text())
  .toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
expect(wrapper.findAll('.required-media-permission-dialog button')).toHaveLength(1)
expect(wrapper.text()).not.toContain('면접 종료')
expect(wrapper.text()).not.toContain('카메라 연결이 끊겨 면접을 일시적으로 멈췄습니다.')
```

복구 성공 시 `recording.resume`, 녹화 레코더와 분석 재개 경로가 호출되고 모달이 닫히는지 검증한다. 실패 시 모달과 단일 확인 버튼이 유지되고 `Permission denied`가 없는지 검증한다.

- [ ] **Step 2: 면접 테스트를 실행해 기존 종료 버튼과 단계별 문구 때문에 실패 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/InterviewRecordMediaControls.test.js`

Expected: FAIL because the view still renders its local modal copy and two buttons.

- [ ] **Step 3: 면접 화면에서 로컬 문구·마크업·스타일을 공통 컴포넌트로 교체**

```vue
<RequiredMediaPermissionModal
  v-if="deviceBlocked"
  :busy="deviceRetrying"
  @confirm="requestDevicesAfterLoss"
/>
```

`deviceBlockCopy`와 `.ivr-device-modal`, `.ivr-device-actions` 스타일을 제거한다. `requestDevicesAfterLoss` 실패 경로는 모달 표시 상태만 유지하고 `recordingError`에 권한 원문을 넣지 않는다.

- [ ] **Step 4: 면접 테스트 통과 확인**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/views/InterviewRecordMediaControls.test.js`

Expected: all interview media control tests PASS.

### Task 4: 전체 회귀와 렌더링 검증

**Files:**
- Verify: `src/components/common/RequiredMediaPermissionModal.vue`
- Verify: `src/views/presentation/PresentationRecordView.vue`
- Verify: `src/views/interview/InterviewRecordView.vue`

**Interfaces:**
- Consumes: Tasks 1-3
- Produces: test, build, rendered-layout, console, and git-diff evidence

- [ ] **Step 1: 관련 테스트 함께 실행**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run tests/components/RequiredMediaPermissionModal.test.js tests/views/PresentationDeviceGuard.test.js tests/views/InterviewRecordMediaControls.test.js`

Expected: all related tests PASS.

- [ ] **Step 2: 전체 테스트 실행**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run`

Expected: all test files PASS.

- [ ] **Step 3: 프로덕션 빌드 실행**

Run: `& 'C:\Users\SSAFY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vite\bin\vite.js' build`

Expected: Vite build completes successfully.

- [ ] **Step 4: 로컬 렌더링과 상호작용 확인**

```text
1. 발표와 면접 녹화 화면에서 권한 차단 상태를 재현한다.
2. 두 화면의 모달 크기, 배경, 제목, 본문과 단일 확인 버튼이 같은지 확인한다.
3. 권한이 차단된 채 확인하면 모달이 유지되는지 확인한다.
4. 사이트 설정에서 카메라와 마이크를 허용한 뒤 확인하면 모달이 닫히고 진행 중 상태가 자동 재개되는지 확인한다.
5. 데스크톱과 720px 화면에서 겹침과 잘림이 없는지 확인한다.
6. 콘솔에 관련 오류가 없는지 확인한다.
```

- [ ] **Step 5: 변경 커밋과 작업 트리 확인**

```powershell
git add frontend-vue-main/src/components/common/RequiredMediaPermissionModal.vue frontend-vue-main/src/views/presentation/PresentationRecordView.vue frontend-vue-main/src/views/interview/InterviewRecordView.vue frontend-vue-main/tests/components/RequiredMediaPermissionModal.test.js frontend-vue-main/tests/views/PresentationDeviceGuard.test.js frontend-vue-main/tests/views/InterviewRecordMediaControls.test.js
git commit -m "fix: 녹화 권한 복구 모달 통일"
git diff --check
git status --short
```

Expected: commit succeeds, whitespace errors are absent, and the worktree is clean.
