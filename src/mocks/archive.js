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

// 슬라이드 하나를 소개하는 데 한두 마디로는 부족해서, 실제 발표처럼 슬라이드당
// 여러 문장이 이어지도록 데모 발화를 채운다. text는 항상 실제 발화(내용 탭에서
// 그대로 이어붙임), reason은 코칭 피드백(영상 탭에서만 보여줌)으로 구분한다.
const presentationTranscripts = [
  { time: '00:00', slide: 0, kind: 'match', label: '핵심 내용 일치', text: '안녕하세요, 오늘 발표를 맡은 발표자입니다.' },
  { time: '00:14', slide: 0, kind: 'match', label: '핵심 내용 일치', text: '저희 팀은 발표와 면접을 준비하는 사람들이 겪는 어려움에 주목했습니다.' },
  { time: '00:30', slide: 0, kind: 'match', label: '핵심 내용 일치', text: '긴장한 상태에서는 스스로 말하기 습관이나 시선 처리를 점검하기가 쉽지 않습니다.' },
  { time: '00:46', slide: 0, kind: 'filler', label: '추임새 1회', text: '그래서 저희는, 음, 이 문제를 데이터로 풀어보고자 했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 발표 초반 집중도를 떨어뜨립니다.', stats: [{ label: '"음"', value: '1회' }] },
  { time: '01:02', slide: 1, kind: 'match', label: '핵심 내용 일치', text: '저희 서비스는 발표와 면접 연습을 돕는 AI 코칭 플랫폼입니다.' },
  { time: '01:18', slide: 1, kind: 'match', label: '핵심 내용 일치', text: '기존에는 녹화 영상을 처음부터 끝까지 직접 돌려보며 문제를 찾아야 했습니다.' },
  { time: '01:35', slide: 1, kind: 'gaze', label: '시선 이탈', text: '그 대신 이 부분에서는 슬라이드 노트를 오래 들여다보게 되네요.', reason: '카메라 정면 대신 슬라이드 노트를 오래 응시했어요. 카메라 정면을 더 오래 응시해보세요.' },
  { time: '01:50', slide: 1, kind: 'match', label: '핵심 내용 일치', text: 'AIVO는 이 과정을 자동으로 분석해서 문제 구간만 짚어드립니다.' },
  { time: '02:05', slide: 2, kind: 'match', label: '핵심 내용 일치', text: '핵심 기능은 실시간 음성 분석과 시선, 자세 분석입니다.' },
  { time: '02:18', slide: 2, kind: 'filler', label: '추임새 2회', text: '사용자가 반복적으로, 음, 말하기 습관을 개선할 수 있도록 설계했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 핵심 메시지의 자신감을 낮춥니다.', stats: [{ label: '"음"', value: '2회' }, { label: '"어"', value: '1회' }] },
  { time: '02:40', slide: 2, kind: 'motion', label: '몸 움직임', text: '이 기능을 설명하는 동안 상체가 좌우로 흔들렸습니다.', reason: '설명 중 상체가 좌우로 흔들렸어요. 어깨를 고정하고 무게중심을 유지해보세요.' },
  { time: '03:05', slide: 2, kind: 'match', label: '핵심 내용 일치', text: '이 모든 데이터는 리포트로 정리되어 한눈에 확인할 수 있습니다.' },
  { time: '03:25', slide: 2, kind: 'match', label: '핵심 내용 일치', text: '사용자는 리포트를 보고 다음 연습에서 무엇을 개선할지 바로 알 수 있습니다.' },
  { time: '03:47', slide: 3, kind: 'evidence', label: '근거 보완', text: '실시간 분석을 통해 발표 준비 시간을 줄일 수 있습니다.', reason: '시간을 얼마나 줄일 수 있는지 수치나 실제 사례가 없어 설득력이 약합니다.', stats: [{ label: '정량 근거', value: '0건' }, { label: '구체 사례', value: '0건' }] },
  { time: '03:58', slide: 3, kind: 'match', label: '핵심 내용 일치', text: '지금까지 AIVO의 핵심 기능과 기대 효과를 말씀드렸습니다.' },
  { time: '04:14', slide: 3, kind: 'match', label: '핵심 내용 일치', text: '저희는 반복 연습을 통해 실력이 눈에 보이게 성장하는 경험을 제공하고자 합니다.' },
  { time: '04:32', slide: 3, kind: 'match', label: '핵심 내용 일치', text: '발표와 면접이 더 이상 두렵지 않은 순간을 만들어 드리겠습니다.' },
  { time: '04:48', slide: 3, kind: 'match', label: '핵심 내용 일치', text: '들어주셔서 감사합니다.' },
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
