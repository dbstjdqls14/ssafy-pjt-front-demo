const PERMISSION_ERROR_NAMES = new Set([
  'NotAllowedError',
  'PermissionDeniedError',
  'SecurityError',
])

export const MEDIA_PERMISSION_GUIDANCE = '주소창 왼쪽의 사이트 설정에서 카메라와 마이크를 허용한 뒤 다시 시도해 주세요.'

export const isMediaPermissionError = (error) => PERMISSION_ERROR_NAMES.has(error?.name)

export const mediaAccessErrorMessage = (error, fallback = MEDIA_PERMISSION_GUIDANCE) => (
  isMediaPermissionError(error) ? MEDIA_PERMISSION_GUIDANCE : (error?.message || fallback)
)
