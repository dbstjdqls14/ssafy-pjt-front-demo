import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('production social metadata', () => {
  test('uses the AIVO production URL and an absolute preview image', () => {
    expect(html).toContain('<title>AIVO | AI 발표·면접 연습</title>')
    expect(html).toContain('<link rel="canonical" href="https://aivo.ai.kr/"')
    expect(html).toContain('property="og:url" content="https://aivo.ai.kr/"')
    expect(html).toContain('property="og:image" content="https://aivo.ai.kr/home-presenter.png"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain('name="twitter:image" content="https://aivo.ai.kr/home-presenter.png"')
  })

  test('provides consistent descriptive metadata for search and sharing', () => {
    expect(html).toContain('name="description" content="AI와 함께 발표와 면접을 연습하고 맞춤 피드백을 받아보세요."')
    expect(html).toContain('property="og:title" content="AIVO | AI 발표·면접 연습"')
    expect(html).toContain('property="og:description" content="AI와 함께 발표와 면접을 연습하고 맞춤 피드백을 받아보세요."')
    expect(html).toContain('property="og:site_name" content="AIVO"')
    expect(html).toContain('property="og:locale" content="ko_KR"')
    expect(html).toContain('name="twitter:title" content="AIVO | AI 발표·면접 연습"')
  })
})
