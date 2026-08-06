# P0 Session Action Interlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표·면접의 TTS, 질문/슬라이드 전환, 장치 권한, 종료와 complete를 상태 기반으로 직렬화하여 빈 미디어와 중복 요청을 차단한다.

**Architecture:** 발표와 면접 화면은 분리 유지한다. 공통으로 쓰는 것은 중요 명령 배타 실행기, 장치 상태 모델, 녹화 결과 검증 같은 저수준 모듈뿐이며 각 화면은 자신의 `canXxx` 권한을 계산한다. complete는 flush·stop·Blob 검증을 통과한 뒤 한 번만 호출한다.

**Tech Stack:** Vue 3 Composition API, Pinia 4, Vue Router 4, MediaRecorder, Web Audio API, Web Speech API, Vitest 4, Vue Test Utils

## Global Constraints

- `InterviewRecordView.vue`와 `PresentationRecordView.vue`의 UI를 공통 컴포넌트로 합치지 않는다.
- 면접에는 새로운 일시정지 버튼을 추가하지 않는다.
- TTS 중 다음·스킵·종료를 허용하지 않는다.
- 화면의 `:disabled`와 handler가 같은 `canXxx` computed를 사용한다.
- 카메라와 마이크 권한은 독립적으로 추적하되 필수 장치 하나라도 사라지면 세션을 동결한다.
- complete는 유효한 WAV/WebM과 종료된 recorder를 확인한 뒤 한 번만 실행한다.
- 브라우저 권한을 코드로 강제 허용한다고 표현하지 않는다. `getUserMedia()` 재요청과 설정 안내만 제공한다.
- 백엔드 API 계약은 Git 커밋 `61875df865df4305f70ecf5b358cd7c942764e5c`의 `backend-spring-develop`을 읽기 전용 기준으로 사용한다.
- `backend-spring-develop`과 `backend-fastapi-main`은 수정하지 않는다.
- 브라우저 수동·자동 테스트는 사용자가 수행한다. 구현자는 Vitest와 Vite production build까지만 실행한다.

---

## File Map

- Create `frontend-vue-main/src/composables/useActionInterlock.js`: 중요 명령 배타 실행과 짧은 cooldown 관리
- Create `frontend-vue-main/src/utils/recordingValidation.js`: WAV/WebM Blob과 duration 검증
- Create `frontend-vue-main/src/composables/useCaptureBridge.js`: 교체 가능한 source와 고정 recorder output 분리
- Modify `frontend-vue-main/src/composables/useMediaDevices.js`: 카메라/마이크 독립 상태, track ended, 개별 request/release
- Modify `frontend-vue-main/src/views/interview/InterviewRecordView.vue`: 면접 상태·TTS 소유권·질문 전환·종료 장벽
- Modify `frontend-vue-main/src/views/presentation/PresentationRecordView.vue`: 발표 상태·슬라이드 전환·장치 차단·종료 잠금
- Modify `frontend-vue-main/src/views/presentation/PresentationQnaView.vue`: 답변 POST·스킵·최종 종료 직렬화
- Modify `frontend-vue-main/src/stores/interviewStore.js`: complete precondition과 동일 요청 공유
- Modify `frontend-vue-main/src/stores/presentationStore.js`: complete precondition과 동일 요청 공유
- Modify `frontend-vue-main/src/assets/styles/views/interview-record.css`: disabled/권한 차단 overlay
- Modify `frontend-vue-main/src/assets/styles/views/presentation-record.css`: disabled/권한 차단 overlay
- Test `frontend-vue-main/tests/composables/useActionInterlock.test.js`
- Test `frontend-vue-main/tests/utils/recordingValidation.test.js`
- Test `frontend-vue-main/tests/composables/useCaptureBridge.test.js`
- Test `frontend-vue-main/tests/utils/mediaDevices.test.js`
- Modify `frontend-vue-main/tests/views/InterviewRecordMediaControls.test.js`
- Modify `frontend-vue-main/tests/views/PresentationRecordLifecycle.test.js`
- Modify `frontend-vue-main/tests/views/PresentationQnaView.test.js`
- Modify `frontend-vue-main/tests/stores/stores.test.js`
- Modify `frontend-vue-main/tests/stores/springPresentationFlow.test.js`

### Task 1: 중요 명령 배타 실행기

**Files:**
- Create: `frontend-vue-main/src/composables/useActionInterlock.js`
- Create: `frontend-vue-main/tests/composables/useActionInterlock.test.js`

**Interfaces:**
- Produces: `useActionInterlock({ cooldownMs = 1000 })`
- Returns: `pendingAction`, `isCoolingDown`, `isLocked`, `runExclusive(name, action)`, `clearCooldown()`

- [ ] **Step 1: 중복 실행과 cooldown 실패 테스트 작성**

```js
it('실행 중인 명령과 완료 직후 재클릭을 차단한다', async () => {
  vi.useFakeTimers()
  const gate = useActionInterlock({ cooldownMs: 1000 })
  let resolveAction
  const action = vi.fn(() => new Promise((resolve) => { resolveAction = resolve }))

  const first = gate.runExclusive('advance', action)
  await gate.runExclusive('advance', action)
  expect(action).toHaveBeenCalledTimes(1)

  resolveAction('done')
  await first
  await gate.runExclusive('advance', action)
  expect(action).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(1000)
  await gate.runExclusive('advance', action)
  expect(action).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인**

Run: `npm test -- tests/composables/useActionInterlock.test.js`

Expected: FAIL because `useActionInterlock.js` does not exist.

- [ ] **Step 3: 배타 실행기 구현**

```js
import { computed, onBeforeUnmount, ref } from 'vue'

export const useActionInterlock = ({ cooldownMs = 1000 } = {}) => {
  const pendingAction = ref(null)
  const isCoolingDown = ref(false)
  let cooldownTimer = null
  const isLocked = computed(() => Boolean(pendingAction.value) || isCoolingDown.value)

  const clearCooldown = () => {
    if (cooldownTimer) window.clearTimeout(cooldownTimer)
    cooldownTimer = null
    isCoolingDown.value = false
  }

  const runExclusive = async (name, action) => {
    if (isLocked.value) return undefined
    pendingAction.value = name
    try {
      return await action()
    } finally {
      pendingAction.value = null
      isCoolingDown.value = cooldownMs > 0
      if (isCoolingDown.value) {
        cooldownTimer = window.setTimeout(clearCooldown, cooldownMs)
      }
    }
  }

  onBeforeUnmount(clearCooldown)
  return { pendingAction, isCoolingDown, isLocked, runExclusive, clearCooldown }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/composables/useActionInterlock.test.js`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend-vue-main/src/composables/useActionInterlock.js frontend-vue-main/tests/composables/useActionInterlock.test.js
git commit -m "feat: 중요 세션 동작 배타 실행기 추가"
```

### Task 2: 녹화 결과 검증 장벽

**Files:**
- Create: `frontend-vue-main/src/utils/recordingValidation.js`
- Create: `frontend-vue-main/tests/utils/recordingValidation.test.js`
- Modify: `frontend-vue-main/src/stores/interviewStore.js`
- Modify: `frontend-vue-main/src/stores/presentationStore.js`

**Interfaces:**
- Produces: `assertCompleteMedia({ durationSeconds, audioBlob, videoBlob, minBytes = 1024 })`
- Throws: `RecordingValidationError` with codes `EMPTY_DURATION`, `EMPTY_AUDIO`, `EMPTY_VIDEO`, `AUDIO_TOO_SMALL`, `VIDEO_TOO_SMALL`

- [ ] **Step 1: duration과 Blob 실패 테스트 작성**

```js
it.each([
  [{ durationSeconds: 0, audioBlob: new Blob(['a']), videoBlob: new Blob(['v']) }, 'EMPTY_DURATION'],
  [{ durationSeconds: 10, audioBlob: null, videoBlob: new Blob(['v']) }, 'EMPTY_AUDIO'],
  [{ durationSeconds: 10, audioBlob: new Blob(['a']), videoBlob: null }, 'EMPTY_VIDEO'],
])('잘못된 complete 미디어를 거부한다', (input, code) => {
  expect(() => assertCompleteMedia({ ...input, minBytes: 1 })).toThrowError(expect.objectContaining({ code }))
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/utils/recordingValidation.test.js`

Expected: FAIL because validator does not exist.

- [ ] **Step 3: validator와 store precondition 구현**

`completeInterview()`와 `completeSession()`의 API 호출 직전에 validator를 실행한다. presentation은 WAV와 WebM, interview는 session audio와 video를 전달한다. 검증 실패 시 API를 호출하지 않고 기존 분석 화면으로 이동하지 않는다.

- [ ] **Step 4: store 중복 complete 테스트 보강**

```js
const first = store.completeInterview()
const second = store.completeInterview()
expect(first).toBe(second)
await first
expect(interviewApi.complete).toHaveBeenCalledTimes(1)
```

- [ ] **Step 5: 관련 테스트 통과 확인**

Run: `npm test -- tests/utils/recordingValidation.test.js tests/stores/stores.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add frontend-vue-main/src/utils/recordingValidation.js frontend-vue-main/src/stores/interviewStore.js frontend-vue-main/src/stores/presentationStore.js frontend-vue-main/tests/utils/recordingValidation.test.js frontend-vue-main/tests/stores/stores.test.js frontend-vue-main/tests/stores/springPresentationFlow.test.js
git commit -m "fix: complete 미디어 검증 장벽 추가"
```

### Task 3: 카메라·마이크 독립 권한과 장치 상실 감지

**Files:**
- Modify: `frontend-vue-main/src/composables/useMediaDevices.js`
- Modify: `frontend-vue-main/tests/utils/mediaDevices.test.js`

**Interfaces:**
- Produces: `videoState`, `audioState` with `idle | requesting | granted | denied | ended | error`
- Produces: `requestVideo()`, `requestAudio()`, `requestRequiredDevices()`, `releaseVideo()`, `releaseAudio()`
- Callback: `onRequiredDeviceLost({ kind, reason })`

- [ ] **Step 1: 마이크 거부가 video stream을 제거하지 않는 테스트 작성**

```js
it('audio 요청 실패 후에도 granted video track을 유지한다', async () => {
  navigator.mediaDevices.getUserMedia
    .mockResolvedValueOnce(videoStream)
    .mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
  const media = useMediaDevices()
  await media.requestVideo()
  await expect(media.requestAudio()).rejects.toThrow()
  expect(media.videoState.value).toBe('granted')
  expect(media.audioState.value).toBe('denied')
  expect(media.stream.value.getVideoTracks()).toHaveLength(1)
})
```

- [ ] **Step 2: 기존 결합 요청 때문에 테스트가 실패하는지 확인**

Run: `npm test -- tests/utils/mediaDevices.test.js`

Expected: FAIL because separate request APIs do not exist.

- [ ] **Step 3: 독립 track collection과 ended 감시 구현**

`stream`은 현재 살아 있는 video/audio track으로 재구성한다. release는 해당 종류 track만 stop한다. 외부 권한 제거 또는 장치 분리로 `ended`가 발생하면 상태를 `ended`로 바꾸고 callback을 한 번 호출한다.

- [ ] **Step 4: granted/denied/ended 조합 테스트 통과 확인**

Run: `npm test -- tests/utils/mediaDevices.test.js`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend-vue-main/src/composables/useMediaDevices.js frontend-vue-main/tests/utils/mediaDevices.test.js
git commit -m "feat: 카메라와 마이크 권한 상태 분리"
```

### Task 4: 고정 녹화 stream bridge

**Files:**
- Create: `frontend-vue-main/src/composables/useCaptureBridge.js`
- Create: `frontend-vue-main/tests/composables/useCaptureBridge.test.js`

**Interfaces:**
- Produces: `outputStream`, `connectVideoTrack(track)`, `disconnectVideo()`, `connectAudioTrack(track)`, `disconnectAudio()`, `dispose()`
- Video output: `canvas.captureStream(30)` track identity remains stable
- Audio output: `AudioContext.createMediaStreamDestination()` track identity remains stable

- [ ] **Step 1: source 교체 후 output track identity 유지 테스트 작성**

```js
it('카메라와 마이크 source를 교체해도 recorder output track을 유지한다', async () => {
  const bridge = useCaptureBridge({ documentRef: fakeDocument, audioContextFactory })
  const initialVideoOutput = bridge.outputStream.getVideoTracks()[0]
  const initialAudioOutput = bridge.outputStream.getAudioTracks()[0]

  await bridge.connectVideoTrack(firstVideoTrack)
  await bridge.connectAudioTrack(firstAudioTrack)
  bridge.disconnectVideo()
  bridge.disconnectAudio()
  await bridge.connectVideoTrack(secondVideoTrack)
  await bridge.connectAudioTrack(secondAudioTrack)

  expect(bridge.outputStream.getVideoTracks()[0]).toBe(initialVideoOutput)
  expect(bridge.outputStream.getAudioTracks()[0]).toBe(initialAudioOutput)
  expect(firstVideoTrack.stop).toHaveBeenCalledOnce()
  expect(firstAudioTrack.stop).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: 모듈 부재 실패 확인**

Run: `npm test -- tests/composables/useCaptureBridge.test.js`

Expected: FAIL because the bridge does not exist.

- [ ] **Step 3: video canvas bridge 구현**

source video track은 내부 muted video element에 연결하고 canvas에 frame을 그린다. source가 없으면 마지막 frame을 유지하지 않고 검은 frame과 장치 중단 상태를 그린다. `disconnectVideo()`는 source track과 element source를 정리하지만 canvas output track은 유지한다.

- [ ] **Step 4: Web Audio bridge 구현**

source audio track은 `MediaStreamAudioSourceNode → GainNode → MediaStreamDestination`에 연결한다. source가 없거나 TTS gate가 활성화되면 gain을 0으로 둔다. `disconnectAudio()`는 source node와 source track만 종료하며 destination output track은 유지한다.

- [ ] **Step 5: lifecycle 테스트 통과 확인**

Run: `npm test -- tests/composables/useCaptureBridge.test.js`

Expected: PASS for connect, disconnect, reconnect, dispose.

- [ ] **Step 6: 커밋**

```bash
git add frontend-vue-main/src/composables/useCaptureBridge.js frontend-vue-main/tests/composables/useCaptureBridge.test.js
git commit -m "feat: 교체 가능한 미디어 녹화 브리지 추가"
```

### Task 5: 면접 TTS·질문 전환·종료 직렬화

**Files:**
- Modify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`
- Modify: `frontend-vue-main/src/assets/styles/views/interview-record.css`
- Modify: `frontend-vue-main/tests/views/InterviewRecordMediaControls.test.js`

**Interfaces:**
- Consumes: `useActionInterlock`, `useCaptureBridge`, independent media states, `assertCompleteMedia`
- Produces computed: `canStart`, `canAdvance`, `canFinish`, `canUseMediaControls`

- [ ] **Step 1: TTS 중 다음·종료가 실행되지 않는 테스트 작성**

TTS mock의 `onend`를 보관하고, TTS가 끝나기 전에 주요 버튼을 여러 번 클릭해 `qIndex`와 router가 변하지 않는지 검증한다. `onend` 실행 후 한 번만 다음 질문으로 이동하는지 검증한다.

- [ ] **Step 2: 현재 구현에서 실패 확인**

Run: `npm test -- tests/views/InterviewRecordMediaControls.test.js`

Expected: FAIL because the primary button remains enabled while `isSpeaking` is true.

- [ ] **Step 3: 상태·권한 computed 구현**

```js
const phase = ref('READY')
const transitionGate = useActionInterlock({ cooldownMs: 1000 })
const pauseReasons = ref(new Set())
const hasPauseReason = (reason) => pauseReasons.value.has(reason)

const canAdvance = computed(() =>
  started.value
  && phase.value === 'CAPTURING'
  && !transitionGate.isLocked.value
  && !isSpeaking.value
  && !isFinishing.value
)
```

`openSegment()` 시작은 `TRANSITIONING`, TTS 재생은 `PROMPT_PLAYING`, 종료 후 `CAPTURING`으로 전이한다. `onPrimaryButton`, `advanceQuestion`, 자동 타이머가 모두 `canAdvance`를 검사한다.

- [ ] **Step 4: TTS pause 소유권 복구 구현**

TTS 시작 시 `TTS_GATE`를 추가하고 PCM/STT를 멈춘다. `stopTts()`와 TTS completion은 `TTS_GATE`만 제거한다. `USER_PAUSE` 또는 `DEVICE_BLOCKED`가 남아 있으면 재개하지 않는다. TTS 취소 callback은 `ttsRunId`가 현재 run과 일치할 때만 상태를 변경한다.

- [ ] **Step 5: 권한 차단 overlay 구현**

카메라 또는 마이크 상실 시 `DEVICE_BLOCKED`로 전이하고 화면을 어둡게 한다. 모달에는 누락 장치와 `권한 다시 요청`, `처음부터 다시 시작`, `면접 종료`를 표시한다. 브라우저 권한을 직접 바꾸는 토글처럼 보이게 하지 않고 실제 `getUserMedia()` 요청 버튼으로 제공한다. 재요청 성공 후 현재의 불완전한 answer/media를 그대로 이어 붙이지 않고 처음부터 다시 시작하거나 종료하도록 한다.

- [ ] **Step 6: 종료 전에 Blob 검증과 queue 대기 연결**

`endInterview()`는 transition gate로 한 번만 실행한다. TTS 정리, 마지막 segment, PCM flush, recorder stop, Blob validation이 끝난 뒤 `finishRecording`과 `/interview/analyzing` 이동을 수행한다.

- [ ] **Step 7: 면접 lifecycle 테스트 통과 확인**

Run: `npm test -- tests/views/InterviewRecordMediaControls.test.js tests/stores/stores.test.js`

Expected: PASS with TTS, rapid click, device loss, invalid Blob scenarios.

- [ ] **Step 8: 커밋**

```bash
git add frontend-vue-main/src/views/interview/InterviewRecordView.vue frontend-vue-main/src/assets/styles/views/interview-record.css frontend-vue-main/tests/views/InterviewRecordMediaControls.test.js
git commit -m "fix: 면접 질문 전환과 종료 경합 차단"
```

### Task 6: 발표 녹화와 Q&A 중요 동작 직렬화

**Files:**
- Modify: `frontend-vue-main/src/views/presentation/PresentationRecordView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationQnaView.vue`
- Modify: `frontend-vue-main/src/assets/styles/views/presentation-record.css`
- Modify: `frontend-vue-main/src/assets/styles/views/presentation-qna.css`
- Modify: `frontend-vue-main/tests/views/PresentationRecordLifecycle.test.js`
- Modify: `frontend-vue-main/tests/views/PresentationQnaView.test.js`

**Interfaces:**
- Consumes: `useActionInterlock`, `useCaptureBridge`, independent media states, store `completeSession()`
- Produces: separate presentation `canChangeSlide`, `canPause`, `canFinish`; Q&A `canSaveAnswer`, `canSkip`, `canFinalize`

- [ ] **Step 1: 녹화 종료와 슬라이드 전환 연타 실패 테스트 작성**

발표 종료 버튼을 연타하고 동시에 슬라이드 전환을 요청해 finish가 한 번, slide event가 종료 이후 기록되지 않는지 검증한다.

- [ ] **Step 2: Q&A 답변 POST 중 다음·스킵·최종 종료 실패 테스트 작성**

answer API Promise를 보류한 상태에서 세 버튼을 클릭하고, API와 complete가 추가 호출되지 않는지 검증한다.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationQnaView.test.js`

Expected: at least one rapid-action test fails.

- [ ] **Step 4: 발표 record 권한과 device overlay 구현**

면접 UI를 공유하지 않고 발표 화면 안에서 별도 computed와 overlay를 구현한다. 사용자 일시정지 재개 전에는 `카메라와 마이크가 다시 켜집니다.` 확인을 표시한다. 권한 상실 시 발표를 동결하고 재요청 또는 발표 종료만 허용한다.

- [ ] **Step 5: Q&A answer/skip/finalize 직렬화 구현**

답변이 성공한 후에만 다음 질문으로 이동한다. 스킵은 빈 답변 상태를 기록하되 answer POST를 보내지 않는다. 모든 질문을 스킵한 경우 최종 종료 전에 Q&A 평가가 생성되지 않음을 안내한다.

- [ ] **Step 6: Q&A OFF/ON complete 위치 검증**

- OFF: record 종료 후 분석 화면에서 complete 한 번
- ON: record 종료에서는 complete하지 않고 질문 생성, Q&A 최종 종료 후 분석 화면에서 complete 한 번

- [ ] **Step 7: 발표 lifecycle 테스트 통과 확인**

Run: `npm test -- tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationQnaView.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add frontend-vue-main/src/views/presentation/PresentationRecordView.vue frontend-vue-main/src/views/presentation/PresentationQnaView.vue frontend-vue-main/src/assets/styles/views/presentation-record.css frontend-vue-main/src/assets/styles/views/presentation-qna.css frontend-vue-main/tests/views/PresentationRecordLifecycle.test.js frontend-vue-main/tests/views/PresentationQnaView.test.js
git commit -m "fix: 발표 녹화와 질의응답 동작 직렬화"
```

### Task 7: 브라우저 이탈과 전체 P0 검증

**Files:**
- Modify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationRecordView.vue`
- Modify: `frontend-vue-main/src/views/interview/InterviewAnalyzingView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationAnalyzingView.vue`
- Modify: lifecycle tests for those views

**Interfaces:**
- Consumes: session phase and teardown functions

- [ ] **Step 1: active 상태에서 route leave가 confirm 없이 진행되지 않는 테스트 작성**

녹화·FINALIZING·ANALYZING에서 router navigation을 시도하고 취소 시 현재 route와 session ID가 유지되는지 검증한다.

- [ ] **Step 2: 이탈 확정 cleanup 구현**

이탈 확정 시 TTS, STT, PCM, MediaRecorder, timer, pending action, local active session을 정리한다. 서버 cancel API가 없으므로 서버 Practice 삭제 성공처럼 표시하지 않는다.

- [ ] **Step 3: P0 테스트 실행**

Run: `npm test -- tests/composables/useActionInterlock.test.js tests/composables/useCaptureBridge.test.js tests/utils/recordingValidation.test.js tests/utils/mediaDevices.test.js tests/views/InterviewRecordMediaControls.test.js tests/views/PresentationRecordLifecycle.test.js tests/views/PresentationQnaView.test.js tests/stores/stores.test.js tests/stores/springPresentationFlow.test.js`

Expected: PASS.

- [ ] **Step 4: 전체 테스트와 빌드**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 5: 백엔드 디렉터리 무변경 확인**

Run: `git diff --exit-code 61875df865df4305f70ecf5b358cd7c942764e5c -- backend-spring-develop backend-fastapi-main`

Expected: no working-tree changes in either backend directory. API 비교를 위해 읽은 기준 커밋과 프런트 브랜치의 기존 동기화 차이는 별도이며, 이번 작업 diff에는 백엔드 파일이 없어야 한다.

- [ ] **Step 6: 최종 커밋**

```bash
git add frontend-vue-main
git commit -m "test: 발표 면접 세션 안정화 회귀 검증"
```
