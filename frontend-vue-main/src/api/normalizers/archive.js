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

export const normalizeArchiveRecord = (item, index = 0) => {
  const recordedAt = item.recordedAt ?? item.completedAt ?? item.createdAt
  const durationSeconds = item.durationSeconds == null || item.durationSeconds === ''
    ? Number.NaN
    : Number(item.durationSeconds)
  const rawScore = item.score ?? item.overallScore
  const numericScore = rawScore == null || rawScore === '' ? null : Number(rawScore)
  const score = Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 100
    ? numericScore
    : null
  const roundedDurationSeconds = Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? Math.round(durationSeconds)
    : undefined
  return {
    ...item,
    id: String(item.reportId ?? item.recordId ?? item.id ?? `record-${index + 1}`),
    presentationId: item.presentationId ?? item.presentation?.presentationId ?? null,
    interviewId: item.interviewId ?? item.interview?.interviewId ?? null,
    folderId: item.folderId ?? item.practiceFolderId ?? null,
    type: String(item.type ?? item.practiceType ?? 'presentation').toLowerCase(),
    title: item.title ?? item.folderName ?? item.sessionTitle ?? `연습 기록 ${index + 1}`,
    date: displayDate(item.date ?? recordedAt),
    time: displayTime(item.time ?? recordedAt),
    score,
    duration: item.duration ?? (roundedDurationSeconds != null ? `${Math.floor(roundedDurationSeconds / 60)}분 ${String(roundedDurationSeconds % 60).padStart(2, '0')}초` : '-'),
    durationSeconds: roundedDurationSeconds,
    recordingId: item.recordingId ?? item.recording?.id ?? null,
    recordingUrl: item.recordingUrl ?? item.videoUrl ?? item.mediaUrl ?? item.recording?.url ?? null,
  }
}
