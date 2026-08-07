import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const appShellCss = readFileSync(resolve(projectRoot, 'src/assets/styles/app-shell.css'), 'utf8')
const mypageCss = readFileSync(resolve(projectRoot, 'src/assets/styles/views/mypage-refresh.css'), 'utf8')

describe('responsive navigation safeguards', () => {
  test('moves the shared header navigation to a second row on narrow screens', () => {
    expect(appShellCss).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.top-nav \.nav-inner\s*\{[\s\S]*?grid-template-rows:\s*58px 44px\s*!important;/)
    expect(appShellCss).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.top-nav \.nav-links\s*\{[\s\S]*?grid-column:\s*1 \/ -1\s*!important;/)
  })

  test('lets narrow mypage tabs keep their content width and scroll instead of overlap', () => {
    expect(mypageCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?body\.mypage-page \.mypage-nav\s*\{[\s\S]*?display:\s*flex;/)
    expect(mypageCss).toMatch(/body\.mypage-page \.mypage-nav > a\s*\{[\s\S]*?flex:\s*0 0 auto;/)
  })

  test('allows profile names to shrink before applying an ellipsis', () => {
    expect(mypageCss).toMatch(/body\.mypage-page \.mypage-profile-surface \.name-block\s*\{[\s\S]*?min-width:\s*0;/)
  })
})
