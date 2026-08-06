import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { archiveApi } from '../../src/api/archiveApi.js'
import {
  normalizeArchivePractice,
  normalizePracticeFolder,
} from '../../src/api/normalizers/practice.js'

const jsonResponse = (payload = {}) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const latestRequest = () => {
  const [url, options] = globalThis.fetch.mock.calls.at(-1)
  return { url, options }
}

describe('archive practice API contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse())))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('reads archive folders from the dedicated paged endpoint', async () => {
    await archiveApi.listFolders({ type: 'presentation', keyword: '서비스 소개', page: 0 })
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/practice-folders/archive?type=presentation&keyword=%EC%84%9C%EB%B9%84%EC%8A%A4+%EC%86%8C%EA%B0%9C&page=0',
      options: { method: 'GET' },
    })

    await archiveApi.listFolders({ type: null, keyword: null, page: 0 })
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/practice-folders/archive?page=0',
      options: { method: 'GET' },
    })
  })

  test('reads folder detail using Spring query parameters', async () => {
    await archiveApi.getFolder(41, { type: 'presentation' })
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/practice-folders/41?type=presentation',
      options: { method: 'GET' },
    })
  })

  test('reads presentation and interview practices from the common folder endpoint', async () => {
    await archiveApi.listPractices(41, { page: 0, sort: 'latest' })
    expect(latestRequest()).toMatchObject({
      url: '/api/v1/practice-folders/41/practices?page=0&sort=latest',
      options: { method: 'GET' },
    })
  })
})

describe('archive practice normalizers', () => {
  test('keeps a folder score absent when Spring does not return one', () => {
    expect(normalizePracticeFolder({
      folderId: 41,
      name: '서비스 소개',
      description: '발표 폴더',
      type: 'presentation',
      practiceCount: 1,
      attemptCount: 1,
    })).toMatchObject({
      id: '41',
      name: '서비스 소개',
      count: 1,
      best: null,
      latestScore: null,
    })
  })

  test('maps the archive score and recent-practice fields without inventing values', () => {
    expect(normalizePracticeFolder({
      folderId: 5,
      type: 'presentation',
      recentPracticeDate: '2026-07-27T10:00:00',
      name: '서비스 소개 발표 폴더',
      averageScore: 87,
      description: '서비스 소개 발표 폴더입니다.',
      attemptCount: 3,
      maxScore: 91,
      recentScore: 89,
    })).toMatchObject({
      id: '5',
      count: 3,
      best: 91,
      latestScore: 89,
      averageScore: 87,
      recentPracticeDate: '2026-07-27T10:00:00',
    })
  })

  test('does not invent folder ids or attempt ordinals absent from Spring', () => {
    const normalized = normalizePracticeFolder({
      name: '식별자 없는 폴더',
      records: [{ createdAtLabel: '오늘' }],
    })

    expect(normalized.id).toBeNull()
    expect(normalized.attempts[0].attempt).toBeNull()
  })

  test('preserves real ids, date, duration, and nullable scores for presentation practices', () => {
    expect(normalizeArchivePractice({
      practiceId: 35,
      presentationId: 12,
      type: 'presentation',
      title: 'AIVO 서비스 소개',
      description: '기능 소개',
      durationSec: 308,
      createdAt: '2026-07-20T14:32:00',
    })).toMatchObject({
      id: '35',
      practiceId: 35,
      presentationId: 12,
      type: 'presentation',
      title: 'AIVO 서비스 소개',
      durationSeconds: 308,
      date: '2026.07.20',
      time: '14:32',
      score: null,
      voiceScore: null,
      videoScore: null,
      contentScore: null,
    })
  })

  test('keeps the interview id distinct from practice id', () => {
    expect(normalizeArchivePractice({
      practiceId: 35,
      interviewId: 21,
      type: 'interview',
      title: '백엔드 면접',
      durationSec: 95,
    })).toMatchObject({
      id: '35',
      practiceId: 35,
      interviewId: 21,
      presentationId: null,
      type: 'interview',
    })
  })

  test('rejects impossible scores and normalizes fractional counts', () => {
    expect(normalizePracticeFolder({
      folderId: 5,
      attemptCount: 3.9,
      maxScore: 108,
      recentScore: Number.POSITIVE_INFINITY,
      averageScore: -1,
    })).toMatchObject({
      count: 3,
      best: null,
      latestScore: null,
      averageScore: null,
    })

    expect(normalizeArchivePractice({
      practiceId: 35,
      score: 101,
      voiceScore: 91.49,
      videoScore: Number.NaN,
    })).toMatchObject({
      score: null,
      voiceScore: 91.49,
      videoScore: null,
    })
  })
})
