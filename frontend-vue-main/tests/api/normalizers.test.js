import { describe, expect, it } from 'vitest'

import { extractAuthUser, isEmailAvailable } from '../../src/api/normalizers/auth.js'
import { normalizeArchiveRecord } from '../../src/api/normalizers/archive.js'
import {
  mergeSupportDocuments,
  normalizePortfolioDocument,
  normalizeResumeDocument,
} from '../../src/api/normalizers/documents.js'
import { normalizeInterviewQuestions } from '../../src/api/normalizers/interview.js'
import {
  extractPresentationSlides,
  mergePresentationSlides,
} from '../../src/api/normalizers/presentation.js'
import { normalizePracticeFolder } from '../../src/api/normalizers/practice.js'

describe('API model normalizers', () => {
  it('extracts auth users from supported response envelopes', () => {
    expect(extractAuthUser({ data: { user: { id: 7, nickname: 'AIVO' } } })).toEqual({ id: 7, nickname: 'AIVO' })
    expect(extractAuthUser({ member: { id: 8, nickname: 'Coach' } })).toEqual({ id: 8, nickname: 'Coach' })
    expect(extractAuthUser(null)).toBeNull()
  })

  it('normalizes email availability aliases', () => {
    expect(isEmailAvailable({ available: true })).toBe(true)
    expect(isEmailAvailable({ data: { isAvailable: false } })).toBe(false)
    expect(isEmailAvailable({ duplicated: true })).toBe(false)
    expect(isEmailAvailable({ exists: false })).toBe(true)
  })

  it('normalizes archive records without losing server fields', () => {
    expect(normalizeArchiveRecord({
      reportId: 17,
      interviewId: 27,
      practiceFolderId: 3,
      practiceType: 'INTERVIEW',
      sessionTitle: '백엔드 면접',
      date: '2026.07.20',
      time: '14:32',
      overallScore: '84',
      durationSeconds: 125,
      recording: { id: 'recording-1', url: '/recording.webm' },
      custom: true,
    })).toMatchObject({
      id: '17',
      interviewId: 27,
      presentationId: null,
      folderId: 3,
      type: 'interview',
      title: '백엔드 면접',
      score: 84,
      duration: '2분 05초',
      recordingId: 'recording-1',
      recordingUrl: '/recording.webm',
      custom: true,
    })
  })

  it('does not invent or expose impossible archive scores', () => {
    expect(normalizeArchiveRecord({ reportId: 18 })).toMatchObject({ score: null })
    expect(normalizeArchiveRecord({ reportId: 19, overallScore: 108 })).toMatchObject({ score: null })
  })

  it('normalizes practice folders and attempt aliases', () => {
    expect(normalizePracticeFolder({
      practiceFolderId: 41,
      folderName: '서비스 발표',
      practiceType: 'PRESENTATION',
      records: [{ attemptNumber: 2, createdAtLabel: '오늘', overallScore: 88 }],
    })).toMatchObject({
      id: '41',
      name: '서비스 발표',
      type: 'presentation',
      count: 1,
      best: 88,
      badge: '최근 88점',
      attempts: [{ attempt: 2, date: '오늘', score: 88 }],
    })
  })

  it('normalizes real resume and portfolio DTOs without colliding ids', () => {
    const resume = normalizeResumeDocument({
      id: 9,
      title: '백엔드 개발자 자소서',
      resumePath: 's3://bucket/resume.pdf',
      content: '지원 동기 본문',
      createdAt: '2026-07-20T14:32:00',
      updatedAt: '2026-07-21T10:00:00',
    })
    const portfolio = normalizePortfolioDocument({
      id: 9,
      title: 'AIVO 포트폴리오',
      portfolioPath: 's3://bucket/portfolio.pdf',
      summary: '프로젝트 요약',
      createdAt: '2026-07-22T09:00:00',
    })

    expect(resume).toMatchObject({
      id: 'resume:9',
      serverId: 9,
      name: '백엔드 개발자 자소서',
      type: 'resume',
      content: '지원 동기 본문',
      storagePath: 's3://bucket/resume.pdf',
      date: '2026.07.21',
    })
    expect(portfolio).toMatchObject({
      id: 'portfolio:9',
      serverId: 9,
      name: 'AIVO 포트폴리오',
      type: 'portfolio',
      summary: '프로젝트 요약',
      storagePath: 's3://bucket/portfolio.pdf',
      date: '2026.07.22',
    })
    expect(resume).not.toHaveProperty('size')
    expect(portfolio).not.toHaveProperty('previewUrl')
  })

  it('merges both resources in descending server date order', () => {
    const merged = mergeSupportDocuments(
      [{ id: 1, title: '오래된 자소서', createdAt: '2026-07-01T00:00:00' }],
      [
        { id: 1, title: '최신 포트폴리오', createdAt: '2026-07-03T00:00:00' },
        { id: 2, title: '중간 포트폴리오', updatedAt: '2026-07-02T00:00:00' },
      ],
    )

    expect(merged.map((item) => item.id)).toEqual(['portfolio:1', 'portfolio:2', 'resume:1'])
  })

  it('normalizes interview question aliases and drops empty questions', () => {
    expect(normalizeInterviewQuestions([
      { id: 7, question: '프로젝트에서 맡은 역할은?', category: '프로젝트', estimatedMinutes: '3' },
      { questionId: 8, content: '협업 경험을 말해 주세요.' },
      { id: 9, content: '' },
    ])).toEqual([
      { questionId: 7, text: '프로젝트에서 맡은 역할은?', cat: '프로젝트', min: 3 },
      { questionId: 8, text: '협업 경험을 말해 주세요.', cat: '공통', min: 2 },
    ])
  })

  it('extracts nested presentation slides and merges local preview fallbacks', () => {
    const apiSlides = extractPresentationSlides({
      data: {
        result: {
          pages: [{ slideId: 'slide-1', slideNumber: 1, name: '서비스 소개', coreContent: '핵심 가치' }],
        },
      },
    })
    const merged = mergePresentationSlides(apiSlides, [{
      previewUrl: 'blob:local-preview',
      thumbnailUrl: 'blob:local-thumbnail',
      extractedText: '로컬 추출 본문',
    }])

    expect(merged).toEqual([expect.objectContaining({
      id: 'slide-1',
      number: 1,
      title: '서비스 소개',
      keyPoints: '핵심 가치',
      previewUrl: 'blob:local-preview',
      thumbnailUrl: 'blob:local-thumbnail',
      extractedText: '로컬 추출 본문',
    })])
  })
})
