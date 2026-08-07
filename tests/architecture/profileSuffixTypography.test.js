import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const appHeader = readFileSync(resolve(projectRoot, 'src/components/common/AppHeader.vue'), 'utf8')
const homeView = readFileSync(resolve(projectRoot, 'src/views/HomeView.vue'), 'utf8')
const appShellCss = readFileSync(resolve(projectRoot, 'src/assets/styles/app-shell.css'), 'utf8')
const homeCss = readFileSync(resolve(projectRoot, 'src/assets/styles/views/home.css'), 'utf8')

describe('profile nickname suffix', () => {
  test('keeps the common-header honorific outside the ellipsis region', () => {
    expect(appHeader).toContain('class="nav-profile-nickname"')
    expect(appHeader).toContain('class="nav-profile-suffix"')
    expect(appShellCss).toMatch(/\.nav-profile-nickname\s*\{[\s\S]*?text-overflow:\s*ellipsis;/)
    expect(appShellCss).toMatch(/\.nav-profile-suffix\s*\{[\s\S]*?flex:\s*0 0 auto;/)
    expect(appShellCss).toMatch(/\.nav-profile-label\s*\{[\s\S]*?width:\s*fit-content;/)
    expect(appShellCss).toMatch(/\.nav-profile-nickname\s*\{[\s\S]*?flex:\s*0 1 auto;/)
  })

  test('uses the MyPage nickname size consistently in the shared header', () => {
    const navNameRule = appShellCss.match(/\.top-nav \.nav-right \.nav-name\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(navNameRule).toMatch(/font-size:\s*13px;/)
  })

  test('keeps the home-menu honorific outside the ellipsis region', () => {
    expect(homeView).toContain('class="home-profile-nickname"')
    expect(homeView).toContain('class="home-profile-suffix"')
    expect(homeCss).toMatch(/\.home-profile-nickname\s*\{[\s\S]*?text-overflow:\s*ellipsis;/)
    expect(homeCss).toMatch(/\.home-profile-suffix\s*\{[\s\S]*?flex:\s*0 0 auto;/)
    expect(homeCss).toMatch(/\.home-auth-links \.home-profile-label\s*\{[\s\S]*?width:\s*fit-content;/)
    expect(homeCss).toMatch(/\.home-profile-nickname\s*\{[\s\S]*?flex:\s*0 1 auto;/)
  })
})
