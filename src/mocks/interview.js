export const buildInterviewReportMock = (score = 84, seconds = 588) => ({
  overallScore: score,
  durationSeconds: seconds,
  metrics: { answerStructure: 82, specificity: 78, keywordCoverage: 74, gazeHold: 80 },
  improvements: [
    '답변 도입에서 결론을 먼저 제시하면 전달력이 올라갑니다.',
    '프로젝트 경험에 수치(성과 지표)를 덧붙이면 설득력이 강해집니다.',
  ],
})
