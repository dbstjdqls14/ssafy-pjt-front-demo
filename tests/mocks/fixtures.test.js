import { describe, expect, test } from 'vitest'

import { archiveSessionMocks } from '../../src/mocks/archive.js'
import { buildInterviewReportMock, interviewQuestionMocks } from '../../src/mocks/interview.js'
import { practiceFolderMocks } from '../../src/mocks/practiceFolders.js'
import { buildPresentationReportMock } from '../../src/mocks/presentation.js'
import { supportDocumentMocks } from '../../src/mocks/supportDocuments.js'

describe('domain fallback fixtures', () => {
  test('keeps practice, document, and interview seed data available', () => {
    expect(practiceFolderMocks).toHaveLength(4)
    expect(supportDocumentMocks).toHaveLength(6)
    expect(interviewQuestionMocks).toHaveLength(5)
  })

  test('keeps archive report details attached to presentation sessions', () => {
    const session = archiveSessionMocks.find((item) => item.id === 'svc-intro-3')

    expect(archiveSessionMocks).toHaveLength(10)
    expect(session).toMatchObject({ score: 91, overallScore: 91 })
    expect(session.slides).toHaveLength(4)
    expect(session.transcripts).toHaveLength(4)
  })

  test('builds presentation and interview fallback reports from runtime values', () => {
    const slides = [{ id: 'slide-1' }]
    const presentation = buildPresentationReportMock(120, { wpm: 132, fillerCount: 2 }, { slides })
    const interview = buildInterviewReportMock(90, 300)

    expect(presentation).toMatchObject({
      durationSeconds: 120,
      metrics: { wpm: 132, fillerCount: 2 },
      slides,
    })
    expect(interview).toMatchObject({ overallScore: 90, durationSeconds: 300 })
  })
})
