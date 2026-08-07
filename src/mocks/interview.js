export const interviewQuestionMocks = [
  { text: '1분 자기소개를 해주세요.', cat: '공통', min: 2 },
  { text: '지원 직무에서 맡은 역할과 가장 큰 기여는 무엇인가요?', cat: '프로젝트', min: 3 },
  { text: '대용량 요청을 처리하기 위해 어떤 구조를 선택했나요?', cat: '기술', min: 3 },
  { text: '팀원과 기술적 의견이 달랐던 경험을 말해 주세요.', cat: '협업', min: 3 },
  { text: '입사 후 3년 내 이루고 싶은 목표가 있나요?', cat: '동기', min: 3 },
]

export const buildInterviewReportMock = (score = 84, seconds = 588) => ({
  overallScore: score,
  durationSeconds: seconds,
  metrics: { answerStructure: 82, specificity: 78, keywordCoverage: 74, gazeHold: 80 },
  improvements: [
    '답변 도입에서 결론을 먼저 제시하면 전달력이 올라갑니다.',
    '프로젝트 경험에 수치(성과 지표)를 덧붙이면 설득력이 강해집니다.',
  ],
})
