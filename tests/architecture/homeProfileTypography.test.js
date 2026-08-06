import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const homeCss = readFileSync(resolve(projectRoot, 'src/assets/styles/views/home.css'), 'utf8')
const homeView = readFileSync(resolve(projectRoot, 'src/views/HomeView.vue'), 'utf8')

const ruleFor = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return homeCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('home profile nickname typography', () => {
  test('keeps a long nickname on one line and truncates it with an ellipsis', () => {
    const labelRule = ruleFor('.home-auth-links .home-profile-label')
    const nicknameRule = ruleFor('.home-profile-nickname')

    expect(labelRule).toMatch(/max-width:\s*[^;]+;/)
    expect(labelRule).toMatch(/width:\s*[^;]+;/)
    expect(labelRule).toMatch(/white-space:\s*nowrap;/)
    expect(labelRule).toMatch(/overflow:\s*hidden;/)
    expect(nicknameRule).toMatch(/overflow:\s*hidden;/)
    expect(nicknameRule).toMatch(/text-overflow:\s*ellipsis;/)
  })

  test('exposes the complete nickname as a tooltip', () => {
    expect(homeView).toContain(':title="`${displayName}님`"')
  })
})
