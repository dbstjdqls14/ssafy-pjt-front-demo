export const MAX_PRESENTATION_FILE_SIZE = 50 * 1024 * 1024

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'pptx'])
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

export const getFileExtension = (name = '') => name.split('.').pop()?.toLowerCase() ?? ''

export const validatePresentationFile = (file) => {
  if (!file) return '발표 자료를 선택해 주세요.'

  const extension = getFileExtension(file.name)
  const supportedType = !file.type || SUPPORTED_MIME_TYPES.has(file.type)

  if (!SUPPORTED_EXTENSIONS.has(extension) || !supportedType) {
    return 'PDF 또는 PPTX 파일만 업로드할 수 있어요.'
  }
  if (file.size <= 0) return '내용이 없는 파일은 업로드할 수 없어요.'
  if (file.size > MAX_PRESENTATION_FILE_SIZE) return '파일 크기는 50MB 이하여야 해요.'

  return ''
}
