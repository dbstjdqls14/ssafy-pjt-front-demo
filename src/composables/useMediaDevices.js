import { onBeforeUnmount, ref } from 'vue'

export const getStreamAspectRatio = (mediaStream, fallback = 16 / 9) => {
  const settings = mediaStream?.getVideoTracks?.()[0]?.getSettings?.() ?? {}
  const ratio = Number(settings.aspectRatio)
    || (Number(settings.width) > 0 && Number(settings.height) > 0
      ? Number(settings.width) / Number(settings.height)
      : fallback)

  return Number.isFinite(ratio) && ratio >= 1 && ratio <= 2.4 ? ratio : fallback
}

export const useMediaDevices = () => {
  const stream = ref(null)
  const devices = ref({
    cameras: [],
    microphones: [],
    speakers: [],
  })
  const error = ref(null)
  const isChecking = ref(false)

  const stopStream = () => {
    stream.value?.getTracks().forEach((track) => track.stop())
    stream.value = null
  }

  const loadDevices = async () => {
    const mediaDevices = await navigator.mediaDevices.enumerateDevices()

    devices.value = {
      cameras: mediaDevices.filter((device) => device.kind === 'videoinput'),
      microphones: mediaDevices.filter((device) => device.kind === 'audioinput'),
      speakers: mediaDevices.filter((device) => device.kind === 'audiooutput'),
    }

    return devices.value
  }

  const checkDevices = async (constraints = { video: true, audio: true }) => {
    isChecking.value = true
    error.value = null

    try {
      stopStream()
      stream.value = await navigator.mediaDevices.getUserMedia(constraints)
      await loadDevices()
      return stream.value
    } catch (deviceError) {
      error.value = deviceError
      throw deviceError
    } finally {
      isChecking.value = false
    }
  }

  onBeforeUnmount(stopStream)

  return {
    stream,
    devices,
    error,
    isChecking,
    checkDevices,
    loadDevices,
    stopStream,
  }
}
