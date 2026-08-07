import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const media = vi.hoisted(() => ({
  onRequiredDeviceLost: null,
  videoTrack: { kind: 'video', readyState: 'live', stop: vi.fn() },
  audioTrack: { kind: 'audio', readyState: 'live', stop: vi.fn() },
  videoTrackRef: null,
  audioTrackRef: null,
  requestVideo: vi.fn().mockResolvedValue(undefined),
  requestAudio: vi.fn().mockResolvedValue(undefined),
  requestRequiredDevices: vi.fn().mockResolvedValue(undefined),
  releaseVideo: vi.fn(),
  releaseAudio: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('../../src/composables/useMediaDevices.js', () => ({
  INTERVIEW_MEDIA_CONSTRAINTS: { audio: true, video: true },
  getStreamAspectRatio: () => 16 / 9,
  useMediaDevices: (options = {}) => {
    media.onRequiredDeviceLost = options.onRequiredDeviceLost
    media.videoTrackRef = ref(media.videoTrack)
    media.audioTrackRef = ref(media.audioTrack)
    return {
      stream: ref({
        getTracks: () => [media.videoTrack, media.audioTrack],
        getVideoTracks: () => [media.videoTrack],
        getAudioTracks: () => [media.audioTrack],
      }),
      videoTrack: media.videoTrackRef,
      audioTrack: media.audioTrackRef,
      videoState: ref('granted'),
      audioState: ref('granted'),
      checkDevices: media.requestRequiredDevices,
      requestRequiredDevices: media.requestRequiredDevices,
      requestVideo: media.requestVideo,
      requestAudio: media.requestAudio,
      releaseVideo: media.releaseVideo,
      releaseAudio: media.releaseAudio,
      stopStream: media.stopStream,
    }
  },
}))

const bridge = vi.hoisted(() => ({
  outputStream: {
    getTracks: () => [],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
  },
  connectVideoTrack: vi.fn().mockResolvedValue(undefined),
  connectAudioTrack: vi.fn().mockResolvedValue(undefined),
  disconnectVideo: vi.fn(),
  disconnectAudio: vi.fn(),
  setAudioMuted: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../src/composables/useCaptureBridge.js', () => ({ useCaptureBridge: () => bridge }))

const recorders = vi.hoisted(() => [])
vi.mock('../../src/composables/useRecorder.js', () => ({
  useRecorder: () => {
    const recorder = {
      start: vi.fn(), pause: vi.fn(), resume: vi.fn(),
      stop: vi.fn().mockResolvedValue(new Blob(['media-data'.repeat(200)], { type: 'video/webm' })),
    }
    recorders.push(recorder)
    return recorder
  },
}))

vi.mock('../../src/composables/useFaceAnalysis.js', () => ({
  useFaceAnalysis: () => ({
    tiltScore: ref(null), gazeDeviationCount: ref(0),
    prepare: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined), stop: vi.fn(),
    getSessionSummary: () => ({ gazeDeviationCount: 0, gazeEvents: [], tiltBuckets: [] }),
  }),
}))

vi.mock('../../src/services/pcmWavCapture.js', () => ({
  PcmWavCapture: class {
    start = vi.fn().mockResolvedValue(undefined)
    stop = vi.fn().mockResolvedValue({ wavBlob: new Blob(['wav-data'.repeat(200)], { type: 'audio/wav' }), chunks: [] })
    pause = vi.fn()
    resume = vi.fn()
  },
}))

import InterviewRecordView from '../../src/views/interview/InterviewRecordView.vue'
import { useInterviewStore } from '../../src/stores/interviewStore.js'
import { useRecordingStore } from '../../src/stores/recordingStore.js'

describe('InterviewRecordView device controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recorders.length = 0
    media.onRequiredDeviceLost = null
    media.requestRequiredDevices.mockResolvedValue(undefined)
    localStorage.setItem('aivo.interview-record-tutorial-seen:guest', 'true')
    sessionStorage.clear()
    Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
    vi.stubGlobal('MediaStream', class {
      constructor(tracks = []) { this.tracks = tracks }
      getTracks() { return this.tracks }
      getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio') }
      getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video') }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  const mountView = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const interview = useInterviewStore()
    interview.questions = [{ id: 1, text: '자기소개를 해주세요.', cat: '공통' }]
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/interview/record', component: InterviewRecordView },
        { path: '/interview/analyzing', component: { template: '<div />' } },
        { path: '/interview/setup', component: { template: '<div />' } },
      ],
    })
    await router.push('/interview/record')
    await router.isReady()
    const wrapper = mount(InterviewRecordView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    return { wrapper }
  }

  test('시작 전 장치 끄기는 실제 트랙을 release하고 다시 켜기는 권한을 재요청한다', async () => {
    const { wrapper } = await mountView()
    const [cameraButton, microphoneButton] = wrapper.findAll('.ivr-toggle')

    await cameraButton.trigger('click')
    await microphoneButton.trigger('click')
    expect(media.releaseVideo).toHaveBeenCalledTimes(1)
    expect(media.releaseAudio).toHaveBeenCalledTimes(1)

    await cameraButton.trigger('click')
    await microphoneButton.trigger('click')
    expect(media.requestVideo).toHaveBeenCalledTimes(1)
    expect(media.requestAudio).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  test('실행 중 장치 권한을 잃으면 공통 모달을 표시하고 복구 후 자동 재개한다', async () => {
    const { wrapper } = await mountView()
    const recording = useRecordingStore()
    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()
    const videoResumeCallsBeforeLoss = recorders[0].resume.mock.calls.length
    const audioResumeCallsBeforeLoss = recorders[1].resume.mock.calls.length

    expect(media.onRequiredDeviceLost).toBeTypeOf('function')
    media.onRequiredDeviceLost({ kind: 'audio', reason: 'permission-denied' })
    await flushPromises()

    const permissionModal = wrapper.get('.required-media-permission-dialog')
    expect(permissionModal.isVisible()).toBe(true)
    expect(permissionModal.text()).toContain('카메라와 마이크 권한이 필요합니다.')
    expect(permissionModal.text()).toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
    expect(permissionModal.text()).not.toContain('면접 종료')
    expect(permissionModal.text()).not.toContain('연결이 끊겨 면접을 일시적으로 멈췄습니다.')
    expect(permissionModal.findAll('button')).toHaveLength(1)
    expect(wrapper.get('.ivr-control-primary').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()
    expect(media.requestRequiredDevices).toHaveBeenCalled()
    expect(recording.isPaused).toBe(false)
    expect(recorders[0].resume).toHaveBeenCalledTimes(videoResumeCallsBeforeLoss + 1)
    expect(recorders[1].resume).toHaveBeenCalledTimes(audioResumeCallsBeforeLoss + 1)
    expect(wrapper.find('.required-media-permission-modal').exists()).toBe(false)
    wrapper.unmount()
  })

  test('시작 시 브라우저 권한이 차단되면 녹화를 시작하지 않고 복구 안내를 표시한다', async () => {
    const { wrapper } = await mountView()
    const recording = useRecordingStore()
    media.videoTrackRef.value = null
    media.audioTrackRef.value = null
    media.requestRequiredDevices.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))

    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(recording.isRecording).toBe(false)
    expect(recorders[0].start).not.toHaveBeenCalled()
    const permissionModal = wrapper.get('.required-media-permission-dialog')
    expect(permissionModal.text()).toContain('카메라와 마이크 권한이 필요합니다.')
    expect(permissionModal.text()).toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
    expect(permissionModal.text()).not.toContain('Permission denied')

    media.videoTrackRef.value = media.videoTrack
    media.audioTrackRef.value = media.audioTrack
    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()

    expect(recording.isRecording).toBe(false)
    expect(recorders[0].start).not.toHaveBeenCalled()
    expect(wrapper.find('.required-media-permission-modal').exists()).toBe(false)
    wrapper.unmount()
  })

  test('5초 카운트다운 중 권한을 차단하면 카운트다운을 취소하고 녹화를 시작하지 않는다', async () => {
    const { wrapper } = await mountView()
    const recording = useRecordingStore()

    await wrapper.get('.ivr-control-primary').trigger('click')
    await flushPromises()
    media.videoTrackRef.value = null
    media.onRequiredDeviceLost({ kind: 'video', reason: 'permission-denied' })
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(recording.isRecording).toBe(false)
    expect(recorders[0].start).not.toHaveBeenCalled()
    expect(wrapper.get('.required-media-permission-dialog').text()).toContain('카메라와 마이크 권한이 필요합니다.')
    expect(wrapper.get('.ivr-control-primary').text()).toBe('면접 시작')
    wrapper.unmount()
  })

  test('권한 재확인이 실패하면 공통 모달과 확인 버튼을 유지한다', async () => {
    const { wrapper } = await mountView()
    media.videoTrackRef.value = null
    media.audioTrackRef.value = null
    media.requestRequiredDevices.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))

    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    media.requestRequiredDevices.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
    await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')
    await flushPromises()

    const permissionModal = wrapper.get('.required-media-permission-dialog')
    expect(permissionModal.text()).not.toContain('Permission denied')
    expect(permissionModal.findAll('button')).toHaveLength(1)
    expect(permissionModal.get('button').text()).toBe('확인')
    wrapper.unmount()
  })

  test('카운트다운 전후 같은 live source를 bridge에 연결하고 녹화기는 고정 output만 사용한다', async () => {
    const { wrapper } = await mountView()
    const requiredDeviceRequestsBeforeStart = media.requestRequiredDevices.mock.calls.length
    await wrapper.get('.ivr-control-primary').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(bridge.connectVideoTrack).toHaveBeenCalledTimes(2)
    expect(bridge.connectAudioTrack).toHaveBeenCalledTimes(2)
    expect(bridge.connectVideoTrack).toHaveBeenNthCalledWith(1, media.videoTrack)
    expect(bridge.connectVideoTrack).toHaveBeenNthCalledWith(2, media.videoTrack)
    expect(bridge.connectAudioTrack).toHaveBeenNthCalledWith(1, media.audioTrack)
    expect(bridge.connectAudioTrack).toHaveBeenNthCalledWith(2, media.audioTrack)
    expect(media.requestRequiredDevices).toHaveBeenCalledTimes(requiredDeviceRequestsBeforeStart)
    expect(recorders[0].start).toHaveBeenCalledWith(bridge.outputStream)
    wrapper.unmount()
  })
})
