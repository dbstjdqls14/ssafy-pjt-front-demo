<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CameraZoomControl from '../../components/common/CameraZoomControl.vue'
import {
  INTERVIEW_MEDIA_CONSTRAINTS,
  useMediaDevices,
} from '../../composables/useMediaDevices.js'
import { useMicLevel } from '../../composables/useMicLevel.js'
import { useRecordingStore } from '../../stores/recordingStore.js'

const router = useRouter()
const recording = useRecordingStore()
// 사이트 설정에서 권한을 껐다 켜면 브라우저가 기존 트랙을 끊는다. 그 신호를 받아
// 새로고침 없이 다시 요청한다(발표 장치 확인과 동일).
const onDevicesChanged = () => {
  const hasLiveVideo = stream.value?.getVideoTracks?.().some((track) => track.readyState !== 'ended')
  const hasLiveAudio = stream.value?.getAudioTracks?.().some((track) => track.readyState !== 'ended')
  if (hasLiveVideo && hasLiveAudio) return
  void requestDevices()
}
const {
  stream,
  videoTrack,
  audioTrack,
  videoState,
  audioState,
  isChecking,
  checkDevices,
  requestVideo,
  requestAudio,
  releaseVideo,
  releaseAudio,
  refreshPermissionStates,
  stopStream,
} = useMediaDevices({ onDevicesChanged })
const { level: micLevel, start: startMicLevel, stop: stopMicLevel } = useMicLevel()

const videoEl = ref(null)
const camOn = ref(true)
const micOn = ref(true)

const isLive = (track) => track?.readyState !== 'ended'
const videoReady = computed(() => videoState.value === 'granted' && isLive(videoTrack.value))
const audioReady = computed(() => audioState.value === 'granted' && isLive(audioTrack.value))
const deviceReady = computed(() => videoReady.value && audioReady.value && camOn.value && micOn.value)

// 실제 마이크 입력 음량(0~1)에 맞춰 막대가 실시간으로 오르내린다(통화 앱의
// 마이크 테스트와 동일한 방식). 막대 개수만큼 threshold를 나눠 몇 개를 켤지 정한다.
const MIC_BAR_COUNT = 14
const micBars = computed(() => {
  const activeCount = Math.round(micLevel.value * MIC_BAR_COUNT)
  return Array.from({ length: MIC_BAR_COUNT }, (_, i) => i < activeCount)
})

const connStatus = computed(() => {
  if (videoReady.value && audioReady.value) return '장치 연결 정상'
  if (!videoReady.value && !audioReady.value) return '카메라·마이크 연결 필요'
  return videoReady.value ? '마이크 연결 필요' : '카메라 연결 필요'
})
const cameraState = computed(() => {
  if (!camOn.value) return '카메라 · 꺼짐'
  if (videoState.value === 'denied') return '카메라 · 권한 필요'
  return videoReady.value ? '카메라 · 연결 정상' : '카메라 · 확인 중'
})
const cameraDevice = computed(() => {
  if (!camOn.value) return '사용 안 함'
  if (videoState.value === 'denied') return '연결 안 됨'
  return videoReady.value ? 'HD Web Camera' : '연결 대기'
})
const micStateLabel = computed(() => {
  if (!micOn.value) return '마이크 · 꺼짐'
  if (audioState.value === 'denied') return '마이크 · 권한 필요'
  return audioReady.value ? '마이크 · 입력 정상' : '마이크 · 확인 중'
})
const micDevice = computed(() => {
  if (!micOn.value) return '사용 안 함'
  if (audioState.value === 'denied') return '연결 안 됨'
  return audioReady.value ? 'Default Microphone' : '연결 대기'
})

watch(stream, (value) => {
  if (videoEl.value) videoEl.value.srcObject = value ?? null
})

const syncMicLevelAnalysis = () => {
  if (stream.value && audioReady.value && micOn.value) startMicLevel(stream.value)
  else stopMicLevel()
}

const toggleCam = async () => {
  if (videoReady.value) {
    releaseVideo()
    camOn.value = false
    return
  }
  camOn.value = true
  try { await requestVideo(INTERVIEW_MEDIA_CONSTRAINTS.video) } catch { /* 상태 ref가 UI를 갱신한다. */ }
}
const toggleMic = async () => {
  if (audioReady.value) {
    releaseAudio()
    micOn.value = false
    syncMicLevelAnalysis()
    return
  }
  micOn.value = true
  try { await requestAudio(INTERVIEW_MEDIA_CONSTRAINTS.audio) } catch { /* 상태 ref가 UI를 갱신한다. */ }
  syncMicLevelAnalysis()
}

const goNext = () => {
  if (!deviceReady.value) return
  stopMicLevel()
  stopStream()
  router.push('/interview/ready')
}

const requestDevices = async () => {
  if (isChecking.value) return
  try {
    await checkDevices(INTERVIEW_MEDIA_CONSTRAINTS)
    camOn.value = videoReady.value
    micOn.value = audioReady.value
    syncMicLevelAnalysis()
    if (videoEl.value) videoEl.value.srcObject = stream.value ?? null
  } catch {
    camOn.value = videoReady.value || videoState.value === 'denied'
    micOn.value = audioReady.value || audioState.value === 'denied'
    syncMicLevelAnalysis()
  }
}

onMounted(() => {
  void Promise.resolve(refreshPermissionStates({ notify: false })).finally(requestDevices)
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
              <div class="camera-stage" :style="{ '--camera-zoom': recording.cameraZoom }">
                <video v-show="videoReady && camOn" ref="videoEl" autoplay muted playsinline></video>
                <div v-show="!(videoReady && camOn)" class="avatar-silhouette"><span class="head"></span><span class="shoulders"></span></div>
                <CameraZoomControl :model-value="recording.cameraZoom" @update:model-value="recording.setCameraZoom" />
                <span class="camera-guide">얼굴과 어깨가 화면 중앙에 오도록 조정해주세요.</span>
              </div>
              <div class="device-preview-controls">
                <button type="button" class="device-icon-toggle" :class="{ 'is-off': !camOn }" :aria-pressed="camOn" :aria-label="`카메라 ${camOn ? '켜짐' : '꺼짐'}`" @click="toggleCam">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z"/><path d="m16 10 5-2v8l-5-2Z"/></svg>
                  <span class="device-off-mark" aria-hidden="true"></span>
                </button>
                <button type="button" class="device-icon-toggle" :class="{ 'is-off': !micOn }" :aria-pressed="micOn" :aria-label="`마이크 ${micOn ? '켜짐' : '꺼짐'}`" @click="toggleMic">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></svg>
                  <span class="device-off-mark" aria-hidden="true"></span>
                </button>
              </div>
            </div>

            <div class="confirm-panel">
              <h3>장치 상태</h3>
              <div data-testid="camera-status" class="confirm-row" :class="{ 'is-off': !videoReady }"><span>{{ cameraState }}</span><b>{{ cameraDevice }}</b></div>
              <div data-testid="microphone-status" class="confirm-row" :class="{ 'is-off': !audioReady }"><span>{{ micStateLabel }}</span><b>{{ micDevice }}</b></div>
              <div class="confirm-row"><span>스피커 · 출력 정상</span><b>Realtek Audio</b></div>
              <ul class="device-check-guidance" aria-label="장치 확인 안내">
                <li>얼굴이 화면 중앙에 있고 충분히 밝은지 확인하세요.</li>
                <li>말할 때 입력 레벨이 움직이는지 확인하세요.</li>
                <li>답변 전 2초 정도 생각한 뒤 결론부터 말해보세요.</li>
              </ul>
              <p class="mic-level-label">마이크 입력 레벨</p>
              <div class="mic-level">
                <span v-for="(active, i) in micBars" :key="i" :class="{ 'is-active': active && micOn }"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="workflow-footer-actions">
          <RouterLink class="workflow-side-button workflow-side-prev" to="/interview/questions" aria-label="면접 질문 생성으로 돌아가기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </RouterLink>
          <button type="button" class="workflow-side-button workflow-side-next" aria-label="설정 확인으로 이동" :disabled="!deviceReady" @click="goNext">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
