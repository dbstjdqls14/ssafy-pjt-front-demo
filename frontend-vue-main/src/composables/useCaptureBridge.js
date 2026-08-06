const defaultMediaStreamFactory = (tracks) => new MediaStream(tracks)

/**
 * 교체되는 카메라/마이크 source와 MediaRecorder가 보는 output을 분리한다.
 * source track을 실제 stop한 뒤 다시 받아도 output track identity가 유지되므로
 * recorder를 중간에 새로 만들거나 서로 다른 WebM을 이어 붙일 필요가 없다.
 */
export const useCaptureBridge = ({
  documentRef = document,
  audioContextFactory = () => new (window.AudioContext || window.webkitAudioContext)(),
  mediaStreamFactory = defaultMediaStreamFactory,
  requestFrame = (callback) => window.requestAnimationFrame(callback),
  cancelFrame = (id) => window.cancelAnimationFrame(id),
  width = 1280,
  height = 720,
  frameRate = 30,
} = {}) => {
  const canvas = documentRef.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const sourceVideo = documentRef.createElement('video')
  sourceVideo.muted = true
  sourceVideo.playsInline = true
  sourceVideo.autoplay = true

  const videoOutputStream = canvas.captureStream(frameRate)
  const audioContext = audioContextFactory()
  const audioDestination = audioContext.createMediaStreamDestination()
  const audioGain = audioContext.createGain()
  audioGain.gain.value = 1
  audioGain.connect(audioDestination)

  const outputStream = mediaStreamFactory([
    ...videoOutputStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ])

  let videoSourceTrack = null
  let audioSourceTrack = null
  let audioSourceNode = null
  let frameId = null
  let disposed = false

  const paintUnavailableFrame = () => {
    if (!context) return
    context.fillStyle = '#11152f'
    context.fillRect(0, 0, width, height)
  }

  const drawFrame = () => {
    if (disposed) return
    if (videoSourceTrack && videoSourceTrack.readyState !== 'ended' && sourceVideo.srcObject) {
      try {
        const sourceWidth = Number(sourceVideo.videoWidth)
        const sourceHeight = Number(sourceVideo.videoHeight)
        if (sourceWidth > 0 && sourceHeight > 0) {
          const scale = Math.min(width / sourceWidth, height / sourceHeight)
          const drawWidth = sourceWidth * scale
          const drawHeight = sourceHeight * scale
          paintUnavailableFrame()
          context?.drawImage(
            sourceVideo,
            (width - drawWidth) / 2,
            (height - drawHeight) / 2,
            drawWidth,
            drawHeight,
          )
        } else {
          context?.drawImage(sourceVideo, 0, 0, width, height)
        }
      } catch {
        paintUnavailableFrame()
      }
    } else {
      paintUnavailableFrame()
    }
    frameId = requestFrame(drawFrame)
  }
  paintUnavailableFrame()
  frameId = requestFrame(drawFrame)

  const disconnectVideo = () => {
    videoSourceTrack = null
    sourceVideo.srcObject = null
    paintUnavailableFrame()
  }

  const connectVideoTrack = async (track) => {
    if (!track) throw new Error('연결할 카메라 track이 없습니다.')
    if (track.readyState === 'ended') throw new Error('연결할 카메라 track이 종료되었습니다.')
    if (videoSourceTrack === track && sourceVideo.srcObject) return track
    disconnectVideo()
    videoSourceTrack = track
    sourceVideo.srcObject = mediaStreamFactory([track])
    await sourceVideo.play?.().catch?.(() => {})
    return track
  }

  const disconnectAudio = () => {
    audioSourceNode?.disconnect?.()
    audioSourceNode = null
    audioSourceTrack = null
  }

  const connectAudioTrack = async (track) => {
    if (!track) throw new Error('연결할 마이크 track이 없습니다.')
    if (track.readyState === 'ended') throw new Error('연결할 마이크 track이 종료되었습니다.')
    if (audioSourceTrack === track && audioSourceNode) return track
    disconnectAudio()
    audioSourceTrack = track
    audioSourceNode = audioContext.createMediaStreamSource(mediaStreamFactory([track]))
    audioSourceNode.connect(audioGain)
    if (audioContext.state === 'suspended') await audioContext.resume?.()
    return track
  }

  const setAudioMuted = (muted) => {
    audioGain.gain.value = muted ? 0 : 1
  }

  const dispose = async () => {
    if (disposed) return
    disposed = true
    if (frameId !== null) cancelFrame(frameId)
    frameId = null
    disconnectVideo()
    disconnectAudio()
    audioGain.disconnect?.()
    outputStream.getTracks().forEach((track) => track.stop?.())
    await audioContext.close?.()
  }

  return {
    outputStream,
    connectVideoTrack,
    disconnectVideo,
    connectAudioTrack,
    disconnectAudio,
    setAudioMuted,
    dispose,
  }
}
