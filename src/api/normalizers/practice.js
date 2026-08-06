const scoreOrNull = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

const nonNegativeInteger = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback
}

export const normalizePracticeFolder = (item, index = 0) => {
  const attempts = item.attempts ?? item.records ?? []
  const latest = attempts[0]
  const count = nonNegativeInteger(item.attemptCount ?? item.practiceCount ?? attempts.length)
  const type = String(item.type ?? item.practiceType ?? 'presentation').toLowerCase()
  const lastDate = item.recentPracticeDate ?? item.lastPracticedAtLabel ?? item.lastPracticeDate ?? latest?.date ?? '-'
  const attemptScores = attempts
    .map((attempt) => scoreOrNull(attempt.score ?? attempt.overallScore))
    .filter((score) => score != null)
  const explicitBest = item.maxScore ?? item.best ?? item.bestScore
  const best = explicitBest == null
    ? (attemptScores.length ? Math.max(...attemptScores) : null)
    : scoreOrNull(explicitBest)
  const explicitLatestScore = item.recentScore ?? item.latestScore ?? latest?.score ?? latest?.overallScore
  const latestScore = scoreOrNull(explicitLatestScore)
  const explicitAverageScore = item.averageScore
  const averageScore = scoreOrNull(explicitAverageScore)
  const rawId = item.folderId ?? item.practiceFolderId ?? item.id
  return {
    ...item,
    id: rawId == null ? null : String(rawId),
    name: item.name ?? item.folderName ?? `연습 폴더 ${index + 1}`,
    type,
    description: item.description ?? '',
    count,
    meta: item.meta ?? `${type === 'presentation' ? '발표' : '면접'} · ${count}회 연습${lastDate === '-' ? '' : ` · ${lastDate}`}`,
    best,
    latestScore,
    averageScore,
    recentPracticeDate: item.recentPracticeDate ?? null,
    badge: item.badge ?? (latestScore == null ? (count ? `${count}회 연습` : '새 폴더') : `최근 ${latestScore}점`),
    attempts: attempts.map((attempt, attemptIndex) => ({
      attempt: attempt.attempt ?? attempt.attemptNumber ?? null,
      date: attempt.date ?? attempt.createdAtLabel ?? '-',
      score: scoreOrNull(attempt.score ?? attempt.overallScore),
    })),
  }
}

const displayDate = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}`
}

const displayTime = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

const nullableNumber = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const normalizeArchivePractice = (item) => {
  const presentationId = nullableNumber(item.presentationId)
  const interviewId = nullableNumber(item.interviewId)
  const explicitType = String(item.type ?? item.practiceType ?? '').toLowerCase()
  const type = explicitType === 'interview' || explicitType === 'presentation'
    ? explicitType
    : interviewId != null ? 'interview' : 'presentation'
  const rawPracticeId = item.practiceId ?? item.id
  return ({
  ...item,
  id: rawPracticeId == null ? null : String(rawPracticeId),
  practiceId: nullableNumber(rawPracticeId),
  presentationId,
  interviewId,
  type,
  title: item.title ?? (type === 'interview' ? '면접 연습' : '발표 연습'),
  description: item.description ?? '',
  durationSeconds: nullableNumber(item.durationSec ?? item.durationSeconds),
  createdAt: item.createdAt ?? item.practicedAt ?? null,
  date: displayDate(item.createdAt ?? item.practicedAt),
  time: displayTime(item.createdAt ?? item.practicedAt),
  score: scoreOrNull(item.score ?? item.overallScore),
  voiceScore: scoreOrNull(item.voiceScore),
  videoScore: scoreOrNull(item.videoScore),
  contentScore: scoreOrNull(item.contentScore),
  })
}

export const normalizePresentationPractice = (item) => normalizeArchivePractice({
  ...item,
  type: 'presentation',
})
