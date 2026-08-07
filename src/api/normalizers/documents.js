const DOCUMENT_TYPES = new Set(['resume', 'portfolio'])

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

const normalizedServerId = (item) => item?.id ?? item?.resumeId ?? item?.portfolioId

const normalizeBase = (item, type) => {
  const serverId = normalizedServerId(item)
  const sortDate = item?.updatedAt ?? item?.createdAt ?? null

  return {
    ...item,
    id: `${type}:${serverId}`,
    serverId,
    name: item?.title ?? '제목 없는 자료',
    type,
    date: formatDate(sortDate),
    createdAt: item?.createdAt ?? null,
    updatedAt: item?.updatedAt ?? null,
    sortDate,
  }
}

export const normalizeResumeDocument = (item = {}) => ({
  ...normalizeBase(item, 'resume'),
  storagePath: item.resumePath ?? null,
  content: item.content ?? '',
})

export const normalizePortfolioDocument = (item = {}) => ({
  ...normalizeBase(item, 'portfolio'),
  storagePath: item.portfolioPath ?? null,
  summary: item.summary ?? '',
})

export const mergeSupportDocuments = (resumes = [], portfolios = []) => [
  ...resumes.map(normalizeResumeDocument),
  ...portfolios.map(normalizePortfolioDocument),
].sort((left, right) => {
  const leftTime = new Date(left.sortDate ?? 0).getTime() || 0
  const rightTime = new Date(right.sortDate ?? 0).getTime() || 0
  return rightTime - leftTime
})

export const parseSupportDocumentId = (value) => {
  const [type, rawId] = String(value ?? '').split(':')
  if (!DOCUMENT_TYPES.has(type) || !rawId) return null

  const numericId = Number(rawId)
  return {
    type,
    serverId: Number.isNaN(numericId) ? rawId : numericId,
  }
}
