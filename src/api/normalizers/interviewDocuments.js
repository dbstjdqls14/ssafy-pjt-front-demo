// 포트폴리오/자기소개서 응답을 면접 설정 화면에서 쓰는 공통 모양으로 맞춘다.
// 서버는 파일 크기를 내려주지 않으므로 size는 없다(업로드 직후에만 로컬로 안다).
const normalizeDoc = (kind, label) => (item, index = 0) => ({
  id: item.portfolioId ?? item.resumeId ?? item.id ?? `${kind}-${index + 1}`,
  kind,
  label,
  title: item.title ?? `${label} ${index + 1}`,
  path: item.portfolioPath ?? item.resumePath ?? '',
  createdAt: item.createdAt ?? null,
})

export const normalizePortfolio = normalizeDoc('portfolio', '포트폴리오')
export const normalizeResume = normalizeDoc('resume', '자기소개서')

export const normalizePortfolios = (items = []) => items.map(normalizePortfolio)
export const normalizeResumes = (items = []) => items.map(normalizeResume)
