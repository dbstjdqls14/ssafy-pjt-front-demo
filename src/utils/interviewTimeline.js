export const questionIndexAtTime = (questions, timeSec) => {
  if (!Array.isArray(questions) || questions.length === 0) return 0

  const targetSec = Math.max(0, Number(timeSec) || 0)

  // 질문 사이에 TTS 재생 구간(답변엔 없지만 영상엔 있는 시간)이 끼어 있으면
  // durationSec만 이어붙인 합이 다음 질문의 실제 시작 시각과 어긋난다 —
  // 각 질문 자신의 startSec(있다면)을 경계로 직접 쓴다.
  for (let index = questions.length - 1; index >= 0; index -= 1) {
    const startSec = Number(questions[index]?.startSec)
    if (Number.isFinite(startSec) && targetSec >= startSec) return index
  }

  return 0
}
