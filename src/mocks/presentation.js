export const buildPresentationReportMock = (seconds = 258, analysis = {}, flow = {}) => ({
  overallScore: 88,
  durationSeconds: seconds,
  metrics: {
    wpm: analysis.wpm ?? 126,
    fillerCount: analysis.fillerCount ?? 7,
    gazeHold: analysis.gazeHold ?? 78,
    posture: analysis.posture ?? 84,
    voiceStability: analysis.voice ?? '안정',
  },
  highlights: [
    { label: '말하기 속도', value: `${analysis.wpm ?? 126} WPM`, tone: 'good', note: '권장 범위(110~140) 확인' },
    { label: '추임새', value: `${analysis.fillerCount ?? 7}회`, tone: 'warn', note: '반복된 습관어 구간 확인 필요' },
    { label: '시선 유지', value: `${analysis.gazeHold ?? 78}%`, tone: 'good', note: '카메라 정면 응시 비율' },
  ],
  improvements: [
    '슬라이드 전환 시 핵심 문장 앞뒤로 짧은 여백을 두면 메시지가 더 선명해집니다.',
    '시선과 자세 점수가 낮아지는 구간을 영상 타임라인에서 다시 확인해 보세요.',
  ],
  slides: flow.slides ?? [],
  transcripts: flow.transcripts ?? [],
})
