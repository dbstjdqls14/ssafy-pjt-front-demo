export const formatDocumentSize = (bytes = 0) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export const inferDocumentType = (name = '') => (/포트폴리오|portfolio/i.test(name) ? 'portfolio' : 'resume')

export const normalizeDocument = (item, index = 0) => ({
  id: String(item.documentId ?? item.id ?? `document-${index + 1}`),
  name: item.name ?? item.fileName ?? item.originalName ?? `지원자료 ${index + 1}`,
  type: item.type === 'portfolio' || item.documentType === 'PORTFOLIO' ? 'portfolio' : 'resume',
  size: item.size ?? item.fileSizeLabel ?? formatDocumentSize(Number(item.fileSize ?? 0)),
  date: item.date ?? item.updatedAtLabel ?? item.updatedAt ?? item.createdAt ?? '방금 전',
  mimeType: item.mimeType ?? item.contentType ?? 'application/pdf',
  previewUrl: item.previewUrl ?? item.fileUrl ?? item.downloadUrl ?? null,
  downloadUrl: item.downloadUrl ?? item.fileUrl ?? null,
})
