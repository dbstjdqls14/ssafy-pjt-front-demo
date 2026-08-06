import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

export const INTERVIEW_MEDIA_CONSTRAINTS = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
  audio: { echoCancellation: true, noiseSuppression: true },
}

export const getStreamAspectRatio = (mediaStream, fallback = 16 / 9) => {
  const settings = mediaStream?.getVideoTracks?.()[0]?.getSettings?.() ?? {}
  const ratio = Number(settings.aspectRatio)
    || (Number(settings.width) > 0 && Number(settings.height) > 0
      ? Number(settings.width) / Number(settings.height)
      : fallback)

  return Number.isFinite(ratio) && ratio >= 1 && ratio <= 2.4 ? ratio : fallback
}

const isLiveTrack = (track) => track && track.readyState !== 'ended'

const createTrackStream = (tracks) => {
  if (typeof MediaStream === 'function') return new MediaStream(tracks)
  return {
    getTracks: () => [...tracks],
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
  }
}

const stateForError = (error) => (
  ['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(error?.name)
    ? 'denied'
    : 'error'
)

const permissionNameForKind = (kind) => (kind === 'video' ? 'camera' : 'microphone')

export const queryMediaPermissionState = async (kind) => {
  if (!navigator.permissions?.query) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: permissionNameForKind(kind) })
    return status?.state ?? 'unsupported'
  } catch {
    return 'unsupported'
  }
}

export const queryRequiredMediaPermissions = async () => {
  const [video, audio] = await Promise.all([
    queryMediaPermissionState('video'),
    queryMediaPermissionState('audio'),
  ])
  return { video, audio }
}

/**
 * 카메라와 마이크 source track을 독립적으로 소유한다.
 *
 * 화면의 켜기/끄기는 브라우저 권한 값을 조작하는 기능이 아니다. releaseVideo /
 * releaseAudio는 실제 source track을 stop해 OS 장치 사용을 끝내고, request 계열은
 * getUserMedia를 다시 호출해 사용자의 권한을 요청한다.
 */
export const useMediaDevices = ({ onDevicesChanged, onRequiredDeviceLost } = {}) => {
  // 브라우저 네이티브 객체는 Vue proxy로 감싸면 track identity 비교가 깨진다.
  const stream = shallowRef(null)
  const videoTrack = shallowRef(null)
  const audioTrack = shallowRef(null)
  const videoState = ref('idle')
  const audioState = ref('idle')
  const videoPermissionState = ref('unknown')
  const audioPermissionState = ref('unknown')
  const devices = ref({ cameras: [], microphones: [], speakers: [] })
  const error = ref(null)
  const isChecking = ref(false)

  const trackRemovers = new Map()
  const requestVersions = { video: 0, audio: 0 }
  let disposed = false

  const invalidateRequest = (kind) => {
    requestVersions[kind] += 1
  }

  const rebuildStream = () => {
    const tracks = [videoTrack.value, audioTrack.value].filter(isLiveTrack)
    stream.value = tracks.length ? createTrackStream(tracks) : null
  }

  const detachTrackWatcher = (track) => {
    trackRemovers.get(track)?.()
    trackRemovers.delete(track)
  }

  const notifyLost = (kind, reason) => {
    onRequiredDeviceLost?.({ kind, reason })
    onDevicesChanged?.({ kind, reason })
  }

  const applyPermissionState = (kind, permissionState, { notify = true } = {}) => {
    const permission = kind === 'video' ? videoPermissionState : audioPermissionState
    const target = kind === 'video' ? videoTrack : audioTrack
    const state = kind === 'video' ? videoState : audioState
    const previousPermission = permission.value
    let lossNotified = false
    permission.value = permissionState

    if (permissionState === 'denied') {
      invalidateRequest(kind)
      const alreadyDenied = !target.value && state.value === 'denied'
      const track = target.value
      if (track) {
        detachTrackWatcher(track)
        track.stop?.()
      }
      target.value = null
      state.value = 'denied'
      rebuildStream()
      if (!alreadyDenied && notify) {
        notifyLost(kind, 'permission-denied')
        lossNotified = true
      }
    } else if (state.value === 'denied' && !target.value) {
      state.value = 'idle'
    }

    if (notify && !lossNotified && previousPermission !== permissionState) {
      onDevicesChanged?.({ kind, reason: 'permission-change', permissionState })
    }
  }

  const refreshPermissionStates = async ({ notify = true } = {}) => {
    const permissions = await queryRequiredMediaPermissions()
    if (disposed) return permissions
    applyPermissionState('video', permissions.video, { notify })
    applyPermissionState('audio', permissions.audio, { notify })
    return permissions
  }

  const markTrackEnded = (kind, track) => {
    const target = kind === 'video' ? videoTrack : audioTrack
    const state = kind === 'video' ? videoState : audioState
    if (target.value !== track || state.value === 'ended') return
    detachTrackWatcher(track)
    target.value = null
    state.value = 'ended'
    rebuildStream()
    notifyLost(kind, 'ended')
  }

  const watchTrack = (kind, track) => {
    const onEnded = () => markTrackEnded(kind, track)
    track.addEventListener?.('ended', onEnded)
    trackRemovers.set(track, () => track.removeEventListener?.('ended', onEnded))
  }

  const replaceTrack = (kind, nextTrack) => {
    const target = kind === 'video' ? videoTrack : audioTrack
    const state = kind === 'video' ? videoState : audioState
    const previous = target.value
    if (previous && previous !== nextTrack) {
      detachTrackWatcher(previous)
      previous.stop?.()
    }
    target.value = nextTrack ?? null
    state.value = nextTrack ? 'granted' : 'idle'
    if (nextTrack) watchTrack(kind, nextTrack)
    rebuildStream()
  }

  const releaseKind = (kind) => {
    invalidateRequest(kind)
    const target = kind === 'video' ? videoTrack : audioTrack
    const state = kind === 'video' ? videoState : audioState
    const track = target.value
    if (track) {
      detachTrackWatcher(track)
      track.stop?.()
    }
    target.value = null
    state.value = 'idle'
    rebuildStream()
  }

  const requestKind = async (kind, constraints) => {
    const requestVersion = requestVersions[kind] + 1
    requestVersions[kind] = requestVersion
    const target = kind === 'video' ? videoTrack : audioTrack
    const state = kind === 'video' ? videoState : audioState
    state.value = 'requesting'
    error.value = null
    try {
      const requested = kind === 'video'
        ? { video: constraints ?? INTERVIEW_MEDIA_CONSTRAINTS.video, audio: false }
        : { video: false, audio: constraints ?? INTERVIEW_MEDIA_CONSTRAINTS.audio }
      const requestedStream = await navigator.mediaDevices.getUserMedia(requested)
      if (disposed || requestVersions[kind] !== requestVersion) {
        requestedStream.getTracks?.().forEach((track) => track.stop?.())
        return null
      }
      const nextTrack = kind === 'video'
        ? requestedStream.getVideoTracks?.()[0]
        : requestedStream.getAudioTracks?.()[0]
      if (!nextTrack) throw new Error(`${kind} 입력 트랙을 가져오지 못했습니다.`)
      requestedStream.getTracks?.()
        .filter((track) => track !== nextTrack)
        .forEach((track) => track.stop?.())
      replaceTrack(kind, nextTrack)
      const permission = kind === 'video' ? videoPermissionState : audioPermissionState
      permission.value = 'granted'
      return nextTrack
    } catch (requestError) {
      if (disposed || requestVersions[kind] !== requestVersion) return null
      error.value = requestError
      state.value = isLiveTrack(target.value) ? 'granted' : stateForError(requestError)
      throw requestError
    }
  }

  const requestVideo = (constraints) => requestKind('video', constraints)
  const requestAudio = (constraints) => requestKind('audio', constraints)
  const releaseVideo = () => releaseKind('video')
  const releaseAudio = () => releaseKind('audio')

  const loadDevices = async () => {
    const mediaDevices = await navigator.mediaDevices.enumerateDevices()
    devices.value = {
      cameras: mediaDevices.filter((device) => device.kind === 'videoinput'),
      microphones: mediaDevices.filter((device) => device.kind === 'audioinput'),
      speakers: mediaDevices.filter((device) => device.kind === 'audiooutput'),
    }
    return devices.value
  }

  const requestRequiredDevices = async (constraints = INTERVIEW_MEDIA_CONSTRAINTS) => {
    isChecking.value = true
    error.value = null
    const requests = []
    if (constraints.video !== false) requests.push(requestVideo(constraints.video))
    if (constraints.audio !== false) requests.push(requestAudio(constraints.audio))
    try {
      const results = await Promise.allSettled(requests)
      await loadDevices().catch(() => devices.value)
      const rejected = results.find((result) => result.status === 'rejected')
      if (rejected) throw rejected.reason
      return stream.value
    } finally {
      isChecking.value = false
    }
  }

  // 기존 화면 API 호환 이름. 내부 동작은 이제 종류별 요청으로 분리되어 한 장치의
  // 거부가 다른 장치의 살아 있는 track을 제거하지 않는다.
  const checkDevices = requestRequiredDevices

  const stopStream = () => {
    releaseVideo()
    releaseAudio()
    error.value = null
  }

  const globalRemovers = []
  if (navigator.mediaDevices?.addEventListener) {
    const onDeviceChange = () => onDevicesChanged?.({ kind: null, reason: 'devicechange' })
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
    globalRemovers.push(() => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange))
  }

  void Promise.all(['camera', 'microphone'].map(async (permissionName) => {
    try {
      const status = await navigator.permissions?.query({ name: permissionName })
      if (!status || disposed) return
      const kind = permissionName === 'camera' ? 'video' : 'audio'
      const onChange = () => {
        applyPermissionState(kind, status.state)
      }
      applyPermissionState(kind, status.state, { notify: false })
      status.addEventListener?.('change', onChange)
      globalRemovers.push(() => status.removeEventListener?.('change', onChange))
    } catch {
      /* Permissions API에서 장치 권한 조회를 지원하지 않는 브라우저 */
    }
  }))

  const onWindowFocus = () => { void refreshPermissionStates() }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void refreshPermissionStates()
  }
  window.addEventListener?.('focus', onWindowFocus)
  document.addEventListener?.('visibilitychange', onVisibilityChange)
  globalRemovers.push(() => window.removeEventListener?.('focus', onWindowFocus))
  globalRemovers.push(() => document.removeEventListener?.('visibilitychange', onVisibilityChange))

  const dispose = () => {
    disposed = true
    globalRemovers.splice(0).forEach((remove) => remove())
    stopStream()
  }

  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    stream,
    videoTrack,
    audioTrack,
    videoState,
    audioState,
    videoPermissionState,
    audioPermissionState,
    devices,
    error,
    isChecking,
    requestVideo,
    requestAudio,
    requestRequiredDevices,
    releaseVideo,
    releaseAudio,
    checkDevices,
    loadDevices,
    refreshPermissionStates,
    stopStream,
    dispose,
  }
}
