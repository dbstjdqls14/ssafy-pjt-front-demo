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
  { time: '00:46', slide: 0, kind: 'filler', label: '필러 1회', text: '그래서 저희는, 음, 이 문제를 데이터로 풀어보고자 했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 발표 초반 집중도를 떨어뜨립니다.', stats: [{ label: '"음"', value: '1회' }] },
  { time: '01:02', slide: 1, kind: 'match', label: '핵심 내용 일치', text: '저희 서비스는 발표와 면접 연습을 돕는 AI 코칭 플랫폼입니다.' },
  { time: '01:18', slide: 1, kind: 'match', label: '핵심 내용 일치', text: '기존에는 녹화 영상을 처음부터 끝까지 직접 돌려보며 문제를 찾아야 했습니다.' },
  { time: '01:35', slide: 1, kind: 'gaze', label: '시선 이탈', text: '그 대신 이 부분에서는 슬라이드 노트를 오래 들여다보게 되네요.', reason: '카메라 정면 대신 슬라이드 노트를 오래 응시했어요. 카메라 정면을 더 오래 응시해보세요.' },
  { time: '01:50', slide: 1, kind: 'match', label: '핵심 내용 일치', text: 'AIVO는 이 과정을 자동으로 분석해서 문제 구간만 짚어드립니다.' },
  { time: '02:05', slide: 2, kind: 'match', label: '핵심 내용 일치', text: '핵심 기능은 실시간 음성 분석과 시선, 자세 분석입니다.' },
  { time: '02:18', slide: 2, kind: 'filler', label: '필러 2회', text: '사용자가 반복적으로, 음, 말하기 습관을 개선할 수 있도록 설계했습니다.', reason: '문장 중간의 "음"이 흐름을 끊고 핵심 메시지의 자신감을 낮춥니다.', stats: [{ label: '"음"', value: '2회' }, { label: '"어"', value: '1회' }] },
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

// 폴더 설명(제목 기준)과 연습(개별 시도) 설명을 함께 둔다 — 폴더 상세 페이지는
// FOLDER_DESCRIPTIONS를, 리포트 상세 페이지는 세션별 description을 그대로 쓴다.
const FOLDER_DESCRIPTIONS = {
  '서비스 소개 발표': 'AIVO 서비스를 처음 소개할 때 쓰는 5분 발표 대본이에요.',
  '신규 기능 데모 발표': '새로 추가된 기능을 시연하는 발표 연습이에요.',
  '프로젝트 중간 발표': '팀 프로젝트 중간 점검 발표 연습이에요.',
  '아이스브레이킹 발표': '가볍게 분위기를 푸는 짧은 발표 연습이에요.',
  '백엔드 개발자 면접': '백엔드 직무 기술 면접 대비 연습이에요.',
  'CS 스터디 면접': 'CS 기초 지식을 점검하는 스터디용 면접 연습이에요.',
  '1분 자기소개 면접': '면접 초반 자기소개를 다듬는 연습이에요.',
}

export const archiveSessionMocks = [
  { id: 'svc-intro-3', type: 'presentation', title: '서비스 소개 발표', description: '3차 연습 — 도입부 필러 줄이기에 집중했어요.', date: '2026.07.20', time: '14:32', score: 91, duration: '4분 18초', ...presentationReport(91) },
  { id: 'svc-intro-2', type: 'presentation', title: '서비스 소개 발표', description: '2차 연습 — 시선 처리를 개선해봤어요.', date: '2026.07.12', time: '10:05', score: 84, duration: '4분 02초', ...presentationReport(84) },
  { id: 'svc-intro-1', type: 'presentation', title: '서비스 소개 발표', description: '1차 연습 — 처음 대본으로 시간만 재봤어요.', date: '2026.07.03', time: '16:40', score: 77, duration: '3분 50초', ...presentationReport(77) },
  { id: 'feature-demo', type: 'presentation', title: '신규 기능 데모 발표', description: FOLDER_DESCRIPTIONS['신규 기능 데모 발표'], date: '2026.07.16', time: '13:20', score: 89, duration: '5분 12초', ...presentationReport(89) },
  { id: 'mid-review', type: 'presentation', title: '프로젝트 중간 발표', description: FOLDER_DESCRIPTIONS['프로젝트 중간 발표'], date: '2026.07.11', time: '11:02', score: 85, duration: '5분 02초', ...presentationReport(85) },
  { id: 'icebreak', type: 'presentation', title: '아이스브레이킹 발표', description: FOLDER_DESCRIPTIONS['아이스브레이킹 발표'], date: '2026.07.04', time: '16:05', score: 72, duration: '3분 40초', ...presentationReport(72) },
  { id: 'backend-interview-2', type: 'interview', title: '백엔드 개발자 면접', description: '2차 연습 — 압박 질문 대응을 더 연습했어요.', date: '2026.07.19', time: '20:18', score: 84, duration: '9분 48초' },
  { id: 'backend-interview-1', type: 'interview', title: '백엔드 개발자 면접', description: '1차 연습 — 기술 질문 답변 흐름만 확인했어요.', date: '2026.07.10', time: '21:02', score: 76, duration: '8분 30초' },
  { id: 'cs-study', type: 'interview', title: 'CS 스터디 면접', description: FOLDER_DESCRIPTIONS['CS 스터디 면접'], date: '2026.07.08', time: '19:40', score: 79, duration: '7분 21초' },
  { id: 'self-intro', type: 'interview', title: '1분 자기소개 면접', description: FOLDER_DESCRIPTIONS['1분 자기소개 면접'], date: '2026.07.02', time: '18:15', score: 81, duration: '6분 05초' },
]

// ── 내 기록(폴더 목록) 데모 데이터 ──
// 실제 계정에 연습 기록이 아직 없을 때(신규 QA 계정 등) "내 기록" 화면이
// 완전히 빈 상태로만 보여 폴더 상세 화면을 테스트할 수 없다. 위 세션
// 목(archiveSessionMocks)을 제목 기준으로 묶어 폴더 단위로 재구성해 재사용
// 한다 — 실제 폴더 API가 데이터를 채워 넣기 전까지의 데모용.

const toIsoDate = (label) => (label ?? '').replace(/\./g, '-')
const parseKoreanDuration = (label) => {
  const minuteMatch = /(\d+)\s*분/.exec(label ?? '')
  const secondMatch = /(\d+)\s*초/.exec(label ?? '')
  return (minuteMatch ? Number(minuteMatch[1]) * 60 : 0) + (secondMatch ? Number(secondMatch[1]) : 0)
}

const archiveFolderGroups = (() => {
  const groups = new Map()
  archiveSessionMocks.forEach((session) => {
    if (!groups.has(session.title)) groups.set(session.title, [])
    groups.get(session.title).push(session)
  })
  return [...groups.values()].map((sessions) => (
    [...sessions].sort((a, b) => toIsoDate(b.date).localeCompare(toIsoDate(a.date)))
  ))
})()

// GET /practice-folders/archive 폴백 — normalizeArchiveFolder가 그대로 받을 수
// 있는 원본(raw) 필드 형태로 둔다(실제 API 응답과 같은 모양).
export const archiveFolderMocks = archiveFolderGroups.map((sorted) => {
  const [latest] = sorted
  const scores = sorted.map((s) => s.score)
  return {
    folderId: `folder-${latest.id}`,
    type: latest.type,
    name: latest.title,
    description: FOLDER_DESCRIPTIONS[latest.title] ?? '',
    attemptCount: sorted.length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    maxScore: Math.max(...scores),
    recentScore: latest.score,
    recentPracticeDate: toIsoDate(latest.date),
  }
})

// GET /practice-folders/{folderId}/detail, /score-trend, /practices 폴백 —
// 폴더 목록 목에서 만든 folderId로 이 세 응답을 함께 찾는다.
export const findArchiveFolderMock = (folderId) => {
  const sorted = archiveFolderGroups.find((group) => `folder-${group[0].id}` === folderId)
  if (!sorted) return null
  const [latest] = sorted
  const totalDuration = sorted.reduce((sum, s) => sum + parseKoreanDuration(s.duration), 0)
  return {
    detail: {
      folderId,
      name: latest.title,
      description: FOLDER_DESCRIPTIONS[latest.title] ?? '',
      attemptCount: sorted.length,
      maxScore: Math.max(...sorted.map((s) => s.score)),
      totalDuration,
    },
    scoreTrend: sorted.map((s) => ({
      practiceId: s.id,
      practicedAt: toIsoDate(s.date),
      overallScore: s.score,
      voiceScore: s.voiceScore ?? s.score,
      videoScore: s.videoScore ?? s.score,
      contentScore: s.contentScore ?? s.score,
    })),
    practices: sorted.map((s) => ({
      practiceId: s.id,
      title: s.title,
      type: s.type,
      durationSec: parseKoreanDuration(s.duration),
      overallScore: s.score,
      createdAt: `${toIsoDate(s.date)}T${s.time}:00`,
    })),
  }
}
