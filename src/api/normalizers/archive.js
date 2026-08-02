const displayDate = (value) => {
  if (!value) return '-'
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}`
}

const displayTime = (value) => {
  if (!value) return '-'
  if (/^\d{1,2}:\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

const displaySeconds = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}분 ${String(seconds).padStart(2, '0')}초`
}

// 내 기록: 연습 폴더 전체 조회 (GET /practice-folders/archive) 폴더 1건.
export const normalizeArchiveFolder = (item, index = 0) => ({
  folderId: String(item.folderId ?? item.forderId ?? item.id ?? `folder-${index + 1}`),
  type: String(item.type ?? item.practiceType ?? 'presentation').toLowerCase(),
  name: item.name ?? item.folderName ?? `연습 폴더 ${index + 1}`,
  description: item.description ?? '',
  attemptCount: Number(item.attemptCount ?? item.practiceCount ?? 0),
  averageScore: Number(item.averageScore ?? 0),
  maxScore: Number(item.maxScore ?? item.bestScore ?? 0),
  recentScore: Number(item.recentScore ?? item.latestScore ?? 0),
  recentPracticeDate: item.recentPracticeDate ?? null,
  recentPracticeDateLabel: displayDate(item.recentPracticeDate),
})

// 내 기록: 연습 폴더 상세 조회 (GET /practice-folders/{folderId}/detail).
export const normalizeFolderDetail = (item = {}) => ({
  folderId: String(item.folderId ?? ''),
  name: item.name ?? '',
  description: item.description ?? item.folderDescription ?? item.folderDesc ?? '',
  attemptCount: Number(item.attemptCount ?? 0),
  maxScore: Number(item.maxScore ?? 0),
  totalDurationSeconds: Number(item.totalDuration ?? 0),
  totalDurationLabel: displaySeconds(item.totalDuration),
})

// 연습 폴더 점수 추이 조회 (GET /practice-folders/{folderId}/score-trend) 항목 1건.
export const normalizeScoreTrendPoint = (item = {}) => ({
  practiceId: item.practiceId ?? null,
  practicedAt: item.practicedAt ?? null,
  dateLabel: displayDate(item.practicedAt),
  overallScore: Number(item.overallScore ?? 0),
  voiceScore: Number(item.voiceScore ?? 0),
  videoScore: Number(item.videoScore ?? 0),
  contentScore: Number(item.contentScore ?? 0),
})

// 연습 폴더 연습 기록 조회 (GET /practice-folders/{folderId}/practices) 항목 1건.
export const normalizeFolderPracticeRow = (item = {}, index = 0) => {
  const durationSec = Number(item.durationSec ?? 0)
  return {
    practiceId: item.practiceId ?? `practice-${index + 1}`,
    interviewId: item.interviewId ?? null,
    presentationId: item.presentationId ?? null,
    reportId: item.reportId ?? null,
    title: item.title ?? `연습 ${index + 1}`,
    type: String(item.type ?? 'presentation').toLowerCase(),
    durationSec,
    durationLabel: displaySeconds(durationSec),
    overallScore: Number(item.overallScore ?? 0),
    createdAt: item.createdAt ?? null,
    dateLabel: displayDate(item.createdAt),
    timeLabel: displayTime(item.createdAt),
  }
}

export const normalizeArchiveRecord = (item, index = 0) => {
  const recordedAt = item.recordedAt ?? item.completedAt ?? item.createdAt
  const durationSeconds = Number(item.durationSeconds)
  return {
    ...item,
    id: String(item.reportId ?? item.recordId ?? item.id ?? `record-${index + 1}`),
    folderId: item.folderId ?? item.practiceFolderId ?? null,
    type: String(item.type ?? item.practiceType ?? 'presentation').toLowerCase(),
    title: item.title ?? item.folderName ?? item.sessionTitle ?? `연습 기록 ${index + 1}`,
    date: displayDate(item.date ?? recordedAt),
    time: displayTime(item.time ?? recordedAt),
    score: Number(item.score ?? item.overallScore ?? 0),
    duration: item.duration ?? (Number.isFinite(durationSeconds) ? `${Math.floor(durationSeconds / 60)}분 ${String(durationSeconds % 60).padStart(2, '0')}초` : '-'),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
    recordingId: item.recordingId ?? item.recording?.id ?? null,
    recordingUrl: item.recordingUrl ?? item.videoUrl ?? item.mediaUrl ?? item.recording?.url ?? null,
  }
}
