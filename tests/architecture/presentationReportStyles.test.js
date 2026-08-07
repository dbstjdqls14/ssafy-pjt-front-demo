import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const reportCss = readFileSync(
  resolve(projectRoot, 'src/assets/styles/views/presentation-report.css'),
  'utf8',
)

const ruleFor = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return reportCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('presentation report feedback styles', () => {
  test('does not nest a gray Q&A surface inside the red AI feedback card', () => {
    const declarations = ruleFor('.pr-feedback-block .pr-qna-feedback')

    expect(declarations).toMatch(/padding:\s*0\s*;/)
    expect(declarations).toMatch(/background:\s*transparent\s*;/)
  })
})
