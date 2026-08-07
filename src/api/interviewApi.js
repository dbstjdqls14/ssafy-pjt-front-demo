import { del, get, post } from './client.js'
import { practiceApi } from './practiceApi.js'

// 실제 백엔드 면접 API (base /api/v1). 조회는 무인증 공개, 쓰기는 Bearer 필수.
// 면접 생성 시 AI 질문이 함께 생성되어 questionItems로 반환된다(별도 질문 조회 없음).
export const interviewApi = {
  // ── 조회 (무인증) ──
  listCompanies() {
    return get('/interviews/companies')
  },

  listOccupations() {
    return get('/interviews/occupations')
  },

  listOccupationJobs(occupationId) {
    return get(`/interviews/occupations/${occupationId}/jobs`)
  },

  getJob(jobId) {
    return get(`/interviews/jobs/${jobId}`)
  },

  listInterviewers() {
    return get('/interviews/interviewers')
  },

  // 면접 리포트 조회(다시 보기) — complete 응답과 동일한 스키마를 반환한다.
  getReport(interviewId) {
    return get(`/interviews/${interviewId}/interview-report`)
  },

  getReportStatus(interviewId) {
    return get(`/interviews/${interviewId}/interview-report/status`)
  },

  getQuestions(interviewId) {
    return get(`/interviews/${interviewId}/questions`)
  },

  getQuestionFeedback(interviewId, questionId) {
    return get(`/interviews/${interviewId}/questions/${questionId}/feedbacks`)
  },

  // ── 쓰기 (Bearer 필수) ──
  // payload: { companyId, occupationId, jobId, workExperience, title, folderId,
  //            portfolioIds[], resumeIds[], interviewerId } — 전부 optional.
  // 응답: { interviewId, practiceId, interviewerId, questions[], questionItems:[{questionId,question}] }
  create(payload) {
    return post('/interviews', payload)
  },

  addQuestion(interviewId, question) {
    return post(`/interviews/${interviewId}/questions`, { question })
  },

  removeQuestion(interviewId, questionId) {
    return del(`/interviews/${interviewId}/questions/${questionId}`)
  },

  // 질문 구간 오디오의 비언어 분석(자막 아님).
  // 응답: { sequence, fillerCount, silenceDetected, silenceDurationMs, averageWpm, feedback }
  // fillerCount는 현재 sequence 청크의 증분값이다. 서버가 세션 누적값을 반환할
  // 경우에는 totalFillerCount 또는 countScope: 'session'으로 범위를 명시한다.
  // (stutterDetected 필드도 내려오지만 명세 실수 — AI 모델이 측정하지 않는 죽은 값이라 쓰지 않는다)
  analyzeAudio(practiceId, { blob, sequence, fileName = `answer-${sequence}.wav` }) {
    return practiceApi.analyzeAudio(practiceId, { blob, sequence, fileName })
  },

  // 면접 종료 → 리포트 전체가 동기 반환된다(분석 폴링 없음).
  // request: { durationSec, answers: [{ questionId, question, answer, startTime, endTime }] }
  // startTime/endTime은 녹화 시작 기준 경과 초(정수) — 질문 구간 시작/종료 시점.
  // videoBlob: 리포트에서 재생할 녹화 영상. audio만 보내던 걸 그대로 두면 백엔드가
  // 이걸 리포트용 영상 자산으로 인식/저장하지 못한다는 피드백을 받아 video 필드로도
  // 함께 보낸다(오디오만 녹음한 게 아니라면 audio와 같은 blob일 수 있음 — 정상).
  complete(interviewId, { request, blob, fileName = 'interview-audio.webm', videoBlob, videoFileName = 'interview-video.webm' }) {
    const formData = new FormData()
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
    if (blob) formData.append('audio', blob, fileName)
    if (videoBlob) formData.append('video', videoBlob, videoFileName)
    return post(`/interviews/${interviewId}/complete`, formData)
  },
}
