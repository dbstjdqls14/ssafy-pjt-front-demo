<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useMediaDevices } from '../../composables/useMediaDevices.js'
import { useRealtimePresentationAnalysis } from '../../composables/useRealtimePresentationAnalysis.js'

const router = useRouter()
const { stream, error, checkDevices, stopStream } = useMediaDevices()
const analysis = useRealtimePresentationAnalysis()

const videoEl = ref(null)
const camOn = ref(true)
const micOn = ref(true)

const hasStream = computed(() => Boolean(stream.value) && !error.value)
const deviceReady = computed(() => hasStream.value && camOn.value && micOn.value)
const canProceed = computed(() => deviceReady.value && analysis.isReady.value)
const analysisStateLabel = computed(() => {
  if (analysis.modelStatus.value === 'loading') return 'AI 분석 모델 불러오는 중'
  if (analysis.modelStatus.value === 'error') return 'AI 분석 모델 준비 실패'
  if (analysis.isReady.value) return `AI 분석 모델 준비 완료 · ${analysis.delegate.value || 'CPU'}`
  return 'AI 분석 모델 준비 대기'
})

// 14-bar mic level meter, 9 active — matches the legacy static preview.
const micBars = Array.from({ length: 14 }, (_, i) => i < 9)

const connStatus = computed(() => {
  if (error.value) return '장치 권한 필요'
  return hasStream.value ? '장치 연결 정상' : '장치 연결 확인 중'
})
const cameraState = computed(() => {
  if (!camOn.value) return '카메라 · 꺼짐'
  if (error.value) return '카메라 · 권한 필요'
  return hasStream.value ? '카메라 · 연결 정상' : '카메라 · 확인 중'
})
const cameraDevice = computed(() => {
  if (!camOn.value) return '사용 안 함'
  if (error.value) return '연결 안 됨'
  return hasStream.value ? 'HD Web Camera' : '연결 대기'
})
const micStateLabel = computed(() => {
  if (!micOn.value) return '마이크 · 꺼짐'
  if (error.value) return '마이크 · 권한 필요'
  return hasStream.value ? '마이크 · 입력 정상' : '마이크 · 확인 중'
})
const micDevice = computed(() => {
  if (!micOn.value) return '사용 안 함'
  if (error.value) return '연결 안 됨'
  return hasStream.value ? 'Default Microphone' : '연결 대기'
})

watch(stream, (value) => {
  if (videoEl.value) videoEl.value.srcObject = value ?? null
})

const applyTrackState = () => {
  stream.value?.getVideoTracks().forEach((track) => { track.enabled = camOn.value })
  stream.value?.getAudioTracks().forEach((track) => { track.enabled = micOn.value })
}
const toggleCam = () => { camOn.value = !camOn.value; applyTrackState() }
const toggleMic = () => { micOn.value = !micOn.value; applyTrackState() }

const goNext = () => {
  if (!canProceed.value) return
  stopStream()
  router.push('/presentation/ready')
}

const retryModels = () => { void analysis.loadModels() }

onMounted(async () => {
  const modelLoad = analysis.loadModels()
  try {
    await checkDevices({ video: true, audio: true })
    applyTrackState()
  } catch {
    /* error ref drives the "권한 필요" UI */
  }
  await modelLoad
})
</script>

<template>
  <main class="page-shell presentation-flow-shell" data-flow-shell>
    <div class="wizard-shell">
      <div class="workflow-stage">
        <div class="workflow-stage-content" data-flow-content>
          <div class="device-check">
            <div class="video-preview">
              <div class="camera-preview-head">
                <span class="device-live-indicator"><i aria-hidden="true"></i>LIVE</span>
                <span>{{ connStatus }}</span>
              </div>
              <div class="camera-stage">
                <video v-show="hasStream && camOn" ref="videoEl" autoplay muted playsinline></video>
                <div v-show="!(hasStream && camOn)" class="avatar-silhouette"><span class="head"></span><span class="shoulders"></span></div>
                <span class="camera-guide">얼굴과 어깨가 화면 중앙에 오도록 조정해주세요.</span>
              </div>
              <div class="device-preview-controls">
                <button
                  type="button"
                  class="device-icon-toggle"
                  :class="{ 'is-off': !camOn }"
                  :aria-pressed="camOn"
                  :aria-label="`카메라 ${camOn ? '켜짐' : '꺼짐'}`"
                  @click="toggleCam"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z"/><path d="m16 10 5-2v8l-5-2Z"/></svg>
                  <span class="device-off-mark" aria-hidden="true"></span>
                </button>
                <button
                  type="button"
                  class="device-icon-toggle"
                  :class="{ 'is-off': !micOn }"
                  :aria-pressed="micOn"
                  :aria-label="`마이크 ${micOn ? '켜짐' : '꺼짐'}`"
                  @click="toggleMic"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></svg>
                  <span class="device-off-mark" aria-hidden="true"></span>
                </button>
              </div>
            </div>

            <div class="confirm-panel">
              <h3>장치 상태</h3>
              <div class="confirm-row" :class="{ 'is-off': !camOn }"><span>{{ cameraState }}</span><b>{{ cameraDevice }}</b></div>
              <div class="confirm-row" :class="{ 'is-off': !micOn }"><span>{{ micStateLabel }}</span><b>{{ micDevice }}</b></div>
              <div class="confirm-row"><span>스피커 · 출력 정상</span><b>Realtek Audio</b></div>
              <div class="confirm-row analysis-ready-row" :class="{ 'is-off': analysis.modelStatus.value === 'error' }">
                <span>{{ analysisStateLabel }}</span>
                <button
                  v-if="analysis.modelStatus.value === 'error'"
                  type="button"
                  class="analysis-retry-button"
                  @click="retryModels"
                >다시 시도</button>
                <b v-else>{{ analysis.isReady.value ? 'READY' : 'LOADING' }}</b>
              </div>
              <ul class="device-check-guidance" aria-label="장치 확인 안내">
                <li>얼굴이 화면 중앙에 있고 충분히 밝은지 확인하세요.</li>
                <li>말할 때 입력 레벨이 움직이는지 확인하세요.</li>
                <li>테스트 소리가 정상적으로 들리는지 확인하세요.</li>
              </ul>
              <p class="mic-level-label">마이크 입력 레벨</p>
              <div class="mic-level">
                <span v-for="(active, i) in micBars" :key="i" :class="{ 'is-active': active && micOn }"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="workflow-footer-actions">
          <RouterLink
            class="workflow-side-button workflow-side-prev"
            to="/presentation/slides"
            aria-label="핵심 내용 설정으로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button
            type="button"
            class="workflow-side-button workflow-side-next"
            aria-label="설정 확인으로 이동"
            :disabled="!canProceed"
            @click="goNext"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
