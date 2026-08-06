import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const archiveCss = readFileSync(
  resolve(projectRoot, 'src/assets/styles/views/archive-followup.css'),
  'utf8',
)

const ruleFor = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return archiveCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

const lineHeightOf = (selector) => {
  const declaration = ruleFor(selector).match(/line-height:\s*([\d.]+)/)
  return declaration ? Number(declaration[1]) : null
}

describe('archive list typography', () => {
  test('keeps enough line box height for Korean glyphs and Latin descenders', () => {
    expect(lineHeightOf('body.archive-page .archive-row strong')).toBeGreaterThanOrEqual(1.25)
    expect(lineHeightOf('body.archive-page .archive-row b')).toBeGreaterThanOrEqual(1.25)
  })
})
