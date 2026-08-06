import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { portfolioApi } from '../../src/api/portfolioApi.js'
import { resumeApi } from '../../src/api/resumeApi.js'

const jsonResponse = (payload = {}) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const latestRequest = () => {
  const [url, options] = globalThis.fetch.mock.calls.at(-1)
  return { url, options }
}

describe('support document API contracts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse())))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test.each([
    ['resume', resumeApi, '/api/v1/resumes', '/api/v1/resumes/7', '/api/v1/resumes/upload'],
    ['portfolio', portfolioApi, '/api/v1/portfolios', '/api/v1/portfolios/7', '/api/v1/portfolios/upload'],
  ])('uses the Spring %s list, detail, and multipart upload routes', async (_type, api, listUrl, detailUrl, uploadUrl) => {
    await api.list()
    expect(latestRequest()).toMatchObject({ url: listUrl, options: { method: 'GET' } })

    await api.get(7)
    expect(latestRequest()).toMatchObject({ url: detailUrl, options: { method: 'GET' } })

    const file = new File(['pdf'], 'document.pdf', { type: 'application/pdf' })
    await api.upload({ title: '지원 자료', file })
    const upload = latestRequest()
    expect(upload.url).toBe(uploadUrl)
    expect(upload.options.method).toBe('POST')
    expect(upload.options.body).toBeInstanceOf(FormData)
    expect(upload.options.body.get('title')).toBe('지원 자료')
    expect(upload.options.body.get('file')).toBe(file)
  })
})
