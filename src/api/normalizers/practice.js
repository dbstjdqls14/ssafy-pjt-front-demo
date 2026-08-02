export const normalizePracticeFolder = (item, index = 0) => {
  const attempts = item.attempts ?? item.records ?? []
  const latest = attempts[0]
  const count = Number(item.attemptCount ?? item.practiceCount ?? attempts.length)
  const type = String(item.type ?? item.practiceType ?? 'presentation').toLowerCase()
  const lastDate = item.lastPracticedAtLabel ?? item.lastPracticeDate ?? latest?.date ?? '-'
  const best = Number(item.best ?? item.bestScore ?? Math.max(0, ...attempts.map((attempt) => Number(attempt.score ?? attempt.overallScore ?? 0))))
  return {
    ...item,
    id: String(item.folderId ?? item.forderId ?? item.practiceFolderId ?? item.id ?? `folder-${index + 1}`),
    name: item.name ?? item.folderName ?? `연습 폴더 ${index + 1}`,
    type,
    description: item.description ?? '',
    count,
    meta: item.meta ?? `${type === 'presentation' ? '발표' : '면접'} · ${count}회 연습 · ${lastDate}`,
    best,
    badge: item.badge ?? (count ? `최근 ${Number(item.latestScore ?? latest?.score ?? best)}점` : '새 폴더'),
    attempts: attempts.map((attempt, attemptIndex) => ({
      attempt: attempt.attempt ?? attempt.attemptNumber ?? attemptIndex + 1,
      date: attempt.date ?? attempt.createdAtLabel ?? '-',
      score: Number(attempt.score ?? attempt.overallScore ?? 0),
    })),
  }
}
