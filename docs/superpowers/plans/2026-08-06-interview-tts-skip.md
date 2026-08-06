# Interview TTS Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `바로 답변하기` button that cancels the currently playing interview-question TTS and resumes the existing answer capture pipeline immediately without recreating or stopping media resources.

**Architecture:** Keep the change inside `InterviewRecordView.vue`, where the TTS and capture lifecycle already live. A guarded asynchronous `skipQuestionTts()` invalidates the active utterance, cancels speech synthesis, and awaits the existing `resumeAnswerCapture()` path; the existing recorder, PCM, STT, camera stream, and MediaPipe instances remain owned by their current composables.

**Tech Stack:** Vue 3 `<script setup>`, Web Speech APIs, existing recorder/PCM/MediaPipe composables, Vitest, Vue Test Utils

## Global Constraints

- The skip button label is exactly `바로 답변하기`.
- Clicking it starts answer capture immediately without another countdown.
- Camera and microphone tracks, recorder instances, PCM capture, STT, and MediaPipe must be resumed, not recreated or stopped.
- The current question ID, index, segment start, and answer data contract must remain unchanged.
- TTS unsupported behavior, normal TTS completion, next-question, finish, permission-loss, API, Pinia, and backend contracts must remain unchanged.
- Late `SpeechSynthesisUtterance` callbacks and repeated clicks must not resume capture more than once.

---

### Task 1: Add the guarded TTS-skip transition and UI

**Files:**
- Modify: `frontend-vue-main/tests/views/InterviewRecordInterlock.test.js`
- Modify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`

**Interfaces:**
- Consumes: `ttsRunId`, `isSpeaking`, `resumeAnswerCapture()`, `window.speechSynthesis.cancel()`, `transitionGate`, `deviceBlocked`, and `deviceRetrying` already owned by `InterviewRecordView.vue`.
- Produces: local `isSkippingTts: Ref<boolean>` and `skipQuestionTts(): Promise<void>`; no exported API or store contract changes.

- [ ] **Step 1: Write the failing TTS skip lifecycle test**

Add a test after `질문 TTS 재생 중에는 다음 질문과 종료를 잠근다` that starts the first question, records the current question text and initial cancel count, clicks `.ivr-speaking-skip`, and asserts:

```js
test('TTS를 건너뛰면 같은 캡처 자원을 한 번만 재개하고 바로 답변을 시작한다', async () => {
  const { wrapper } = await mountView()
  await wrapper.get('.ivr-control-primary').trigger('click')
  await vi.advanceTimersByTimeAsync(5_000)
  await flushPromises()

  const questionText = wrapper.get('.ivr-question').text()
  const utterance = speechSynthesis.speak.mock.calls[0][0]
  const cancelCount = speechSynthesis.cancel.mock.calls.length
  const recognition = recognitionInstances[0]

  expect(wrapper.get('.ivr-speaking-skip').text()).toBe('바로 답변하기')
  wrapper.get('.ivr-speaking-skip').element.click()
  wrapper.get('.ivr-speaking-skip').element.click()
  await flushPromises()

  expect(speechSynthesis.cancel).toHaveBeenCalledTimes(cancelCount + 1)
  expect(wrapper.get('.ivr-question').text()).toBe(questionText)
  expect(recorderInstances[0].resume).toHaveBeenCalledTimes(1)
  expect(recorderInstances[1].resume).toHaveBeenCalledTimes(1)
  expect(pcmCaptureInstances[0].resume).toHaveBeenCalledTimes(1)
  expect(faceAnalysis.resume).toHaveBeenCalledTimes(1)
  expect(recognition.start).toHaveBeenCalledTimes(2)
  expect(media.stopStream).not.toHaveBeenCalled()
  expect(faceAnalysis.stop).not.toHaveBeenCalled()
  expect(wrapper.find('.ivr-speaking-skip').exists()).toBe(false)

  utterance.onend()
  await flushPromises()
  expect(recorderInstances[0].resume).toHaveBeenCalledTimes(1)
  expect(faceAnalysis.resume).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(1_000)
  expect(wrapper.get('.ivr-qtimer').text()).toContain('0:59')
  wrapper.unmount()
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/views/InterviewRecordInterlock.test.js
```

Expected: FAIL because `.ivr-speaking-skip` does not exist.

- [ ] **Step 3: Implement the guarded asynchronous transition**

Near `isSpeaking`, add:

```js
const isSkippingTts = ref(false)
```

After `stopTts`, add `skipQuestionTts()` with these exact guards and lifecycle operations:

```js
const skipQuestionTts = async () => {
  if (
    !started.value
    || !isSpeaking.value
    || isSkippingTts.value
    || isFinishing.value
    || deviceBlocked.value
    || deviceRetrying.value
  ) return

  isSkippingTts.value = true
  try {
    ttsRunId += 1
    if (ttsSupported) {
      try { window.speechSynthesis.cancel() } catch {}
    }
    isSpeaking.value = false
    await resumeAnswerCapture()
  } finally {
    isSkippingTts.value = false
  }
}
```

Add `isSkippingTts.value` to `isPrimaryLocked`. Update `onTick()` to return while either `isSpeaking` or `isSkippingTts` is true, so the question clock begins only after capture resume completes.

- [ ] **Step 4: Add the accessible skip button to the speaking notice**

Keep the notice mounted during the short resume transition and add the button:

```vue
<div v-if="started && (isSpeaking || isSkippingTts)" class="ivr-speaking-notice" role="status">
  <span class="ivr-speaking-copy">
    <i aria-hidden="true"></i>
    <span>{{ isSkippingTts ? '답변을 준비하고 있어요' : '질문을 읽는 중이에요 — 끝나면 답변을 시작하세요' }}</span>
  </span>
  <button
    type="button"
    class="ivr-speaking-skip"
    :disabled="isSkippingTts"
    @click="skipQuestionTts"
  >{{ isSkippingTts ? '답변 준비 중…' : '바로 답변하기' }}</button>
</div>
```

Update the scoped CSS so `.ivr-speaking-notice` allows wrapping, `.ivr-speaking-copy` aligns the status dot and text, and `.ivr-speaking-skip` has a white background, red text, keyboard focus outline, and disabled state. Retain the existing red notice background and pulse animation.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/views/InterviewRecordInterlock.test.js
```

Expected: the new skip test and all existing TTS, recorder, MediaPipe, STT, next-question, and finish interlock tests pass.

- [ ] **Step 6: Run complete automated verification**

Run:

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
```

Expected: all Vitest suites pass and Vite exits with code 0.

- [ ] **Step 7: Verify the rendered interaction**

The flow under test is: `/interview/record` → start interview → wait for first-question TTS → click `바로 답변하기` → the TTS notice disappears, current question remains, the answer timer decreases, and no console error or permission modal appears.

Repeat on the second question and verify the same state transition. Check page identity, meaningful DOM, framework overlay absence, console health, and the selected interaction state.

- [ ] **Step 8: Inspect and commit the final change**

Run `git diff --check`, inspect the Vue/test diff, and verify `git status --short` contains only the two planned files. Then commit:

```powershell
git add frontend-vue-main/src/views/interview/InterviewRecordView.vue frontend-vue-main/tests/views/InterviewRecordInterlock.test.js
git commit -m "feat: allow skipping interview question TTS"
```
