import { describe, expect, test } from 'vitest'

import { archiveSessionMocks } from '../../src/mocks/archive.js'
import { buildPresentationReportMock } from '../../src/mocks/presentation.js'
import { supportDocumentMocks } from '../../src/mocks/supportDocuments.js'

describe('domain fallback fixtures', () => {
  test('keeps document seed data available', () => {
    expect(supportDocumentMocks).toHaveLength(6)
  })

  test('keeps archive report details attached to presentation sessions', () => {
    const session = archiveSessionMocks.find((item) => item.id === 'svc-intro-3')

    expect(archiveSessionMocks).toHaveLength(10)
    expect(session).toMatchObject({ score: 91, overallScore: 91 })
    expect(session.slides).toHaveLength(4)
    expect(session.transcripts).toHaveLength(18)
  })

  test('builds presentation fallback reports from runtime values', () => {
    const slides = [{ id: 'slide-1' }]
    const presentation = buildPresentationReportMock(120, { wpm: 132, fillerCount: 2 }, { slides })

    expect(presentation).toMatchObject({
      durationSeconds: 120,
      metrics: { wpm: 132, fillerCount: 2 },
      slides,
    })
  })
})
