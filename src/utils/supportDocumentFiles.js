export const MAX_SUPPORT_DOCUMENT_FILE_SIZE = 50 * 1024 * 1024

export const validateSupportDocumentFile = (file) => {
  if (!file) return 'PDF 파일을 선택해 주세요.'

  const isPdfName = file.name?.toLowerCase().endsWith('.pdf')
  const isPdfType = !file.type || file.type === 'application/pdf'
  if (!isPdfName || !isPdfType) return 'PDF 파일만 등록할 수 있습니다.'
  if (file.size <= 0) return '내용이 없는 파일은 등록할 수 없습니다.'
  if (file.size > MAX_SUPPORT_DOCUMENT_FILE_SIZE) return 'PDF 파일은 50MB 이하여야 합니다.'

  return ''
}
