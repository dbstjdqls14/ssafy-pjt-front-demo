import { describe, expect, it } from 'vitest'

import { extractAuthUser, isEmailAvailable } from '../../src/api/normalizers/auth.js'
import { normalizeArchiveRecord } from '../../src/api/normalizers/archive.js'
import { formatDocumentSize, inferDocumentType, normalizeDocument } from '../../src/api/normalizers/documents.js'
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

  it('normalizes document aliases and file metadata', () => {
    expect(formatDocumentSize(1536)).toBe('2KB')
    expect(formatDocumentSize(1572864)).toBe('1.5MB')
    expect(inferDocumentType('AIVO_포트폴리오.pdf')).toBe('portfolio')
    expect(inferDocumentType('이력서.pdf')).toBe('resume')
    expect(normalizeDocument({
      documentId: 9,
      originalName: 'resume.pdf',
      documentType: 'RESUME',
      fileSize: 1536,
      fileUrl: '/documents/9',
    })).toMatchObject({
      id: '9',
      name: 'resume.pdf',
      type: 'resume',
      size: '2KB',
      previewUrl: '/documents/9',
      downloadUrl: '/documents/9',
    })
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
