import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/assets/styles/views/home.css'), 'utf8')

describe('home Script controls', () => {
  test('keeps both navigation buttons visibly interactive', () => {
    const baseRule = css.match(/\.home-script-nav\s*\{([^}]+)\}/)?.[1] ?? ''
    const nextRule = css.match(/\.home-script-nav\.is-next\s*\{([^}]+)\}/)?.[1] ?? ''

    expect(baseRule).not.toContain('pointer-events: none')
    expect(baseRule).toContain('cursor: pointer')
    expect(nextRule).not.toContain('opacity: .35')
  })
})
