const slideImages = ['/slide-example.png', '/slide-2.png', '/slide-3.png', '/slide-4.png']

const presentationSlides = [
  { title: '서비스 소개', summary: '발표 목표와 서비스가 해결하는 문제를 소개합니다.' },
  { title: '문제와 해결 방법', summary: '기존 발표 연습 과정의 불편과 AIVO의 해결 방식을 설명합니다.' },
  { title: '핵심 기능과 기대효과', summary: '실시간 분석과 반복 연습이 만드는 변화를 보여줍니다.' },
  { title: '마무리', summary: '핵심 가치를 요약하고 다음 행동을 제안합니다.' },
].map((slide, index) => ({
  id: index + 1,
  ...slide,
  previewUrl: slideImages[index % slideImages.length],
  thumbnailUrl: slideImages[index % slideImages.length],
}))

const presentationTranscripts = [
  { time: '00:00', slide: 0, kind: 'match', label: '핵심 내용 일치', text: '안녕하세요, 오늘 발표를 맡은 발표자입니다.' },
  { time: '01:02', slide: 1, kind: 'match', label: '핵심 내용 일치', text: '저희 서비스는 발표와 면접 연습을 돕는 AI 코칭 플랫폼입니다.' },
  { time: '02:18', slide: 2, kind: 'filler', label: '습관어 2회', text: '사용자가 반복적으로, 음, 말하기 습관을 개선할 수 있도록 설계했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 핵심 메시지의 자신감을 낮춥니다.', stats: [{ label: '"음"', value: '2회' }, { label: '"어"', value: '1회' }] },
  { time: '03:47', slide: 3, kind: 'evidence', label: '근거 보완', text: '실시간 분석을 통해 발표 준비 시간을 줄일 수 있습니다.', reason: '시간을 얼마나 줄일 수 있는지 수치나 실제 사례가 없어 설득력이 약합니다.', stats: [{ label: '정량 근거', value: '0건' }, { label: '구체 사례', value: '0건' }] },
]

const presentationReport = (score) => ({
  slides: presentationSlides,
  transcripts: presentationTranscripts,
  voiceScore: Math.min(99, score + 2),
  videoScore: Math.max(60, score - 4),
  contentScore: score,
  overallScore: score,
})

export const archiveSessionMocks = [
  { id: 'svc-intro-3', type: 'presentation', title: '서비스 소개 발표', date: '2026.07.20', time: '14:32', score: 91, duration: '4분 18초', ...presentationReport(91) },
  { id: 'svc-intro-2', type: 'presentation', title: '서비스 소개 발표', date: '2026.07.12', time: '10:05', score: 84, duration: '4분 02초', ...presentationReport(84) },
  { id: 'svc-intro-1', type: 'presentation', title: '서비스 소개 발표', date: '2026.07.03', time: '16:40', score: 77, duration: '3분 50초', ...presentationReport(77) },
  { id: 'feature-demo', type: 'presentation', title: '신규 기능 데모 발표', date: '2026.07.16', time: '13:20', score: 89, duration: '5분 12초', ...presentationReport(89) },
  { id: 'mid-review', type: 'presentation', title: '프로젝트 중간 발표', date: '2026.07.11', time: '11:02', score: 85, duration: '5분 02초', ...presentationReport(85) },
  { id: 'icebreak', type: 'presentation', title: '아이스브레이킹 발표', date: '2026.07.04', time: '16:05', score: 72, duration: '3분 40초', ...presentationReport(72) },
  { id: 'backend-interview-2', type: 'interview', title: '백엔드 개발자 면접', date: '2026.07.19', time: '20:18', score: 84, duration: '9분 48초' },
  { id: 'backend-interview-1', type: 'interview', title: '백엔드 개발자 면접', date: '2026.07.10', time: '21:02', score: 76, duration: '8분 30초' },
  { id: 'cs-study', type: 'interview', title: 'CS 스터디 면접', date: '2026.07.08', time: '19:40', score: 79, duration: '7분 21초' },
  { id: 'self-intro', type: 'interview', title: '1분 자기소개 면접', date: '2026.07.02', time: '18:15', score: 81, duration: '6분 05초' },
]
