const ERROR_MESSAGES = {
  EMPTY_DURATION: '녹화 시간이 없어 분석을 시작할 수 없습니다.',
  EMPTY_AUDIO: '녹음 파일이 없어 분석을 시작할 수 없습니다.',
  EMPTY_VIDEO: '녹화 파일이 없어 분석을 시작할 수 없습니다.',
  AUDIO_TOO_SMALL: '녹음 파일이 비어 있거나 손상되었습니다. 다시 녹화해 주세요.',
  VIDEO_TOO_SMALL: '녹화 파일이 비어 있거나 손상되었습니다. 다시 녹화해 주세요.',
}

export class RecordingValidationError extends Error {
  constructor(code) {
    super(ERROR_MESSAGES[code] ?? '녹화 결과를 확인할 수 없습니다.')
    this.name = 'RecordingValidationError'
    this.code = code
  }
}

const hasBlobSize = (blob) => blob && Number.isFinite(Number(blob.size))

export const assertCompleteMedia = ({
  durationSeconds,
  audioBlob,
  videoBlob,
  minBytes = 1_024,
} = {}) => {
  const normalizedDuration = Number(durationSeconds)
  const normalizedMinBytes = Math.max(1, Number(minBytes) || 1)

  if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0) {
    throw new RecordingValidationError('EMPTY_DURATION')
  }
  if (!hasBlobSize(audioBlob)) throw new RecordingValidationError('EMPTY_AUDIO')
  if (!hasBlobSize(videoBlob)) throw new RecordingValidationError('EMPTY_VIDEO')
  if (audioBlob.size < normalizedMinBytes) throw new RecordingValidationError('AUDIO_TOO_SMALL')
  if (videoBlob.size < normalizedMinBytes) throw new RecordingValidationError('VIDEO_TOO_SMALL')

  return {
    durationSeconds: normalizedDuration,
    audioBlob,
    videoBlob,
  }
}
