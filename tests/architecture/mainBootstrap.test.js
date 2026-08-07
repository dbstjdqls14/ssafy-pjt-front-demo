import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const mainPath = resolve(process.cwd(), 'src/main.js')

describe('application profile bootstrap', () => {
  test('refreshes a persisted authenticated profile when the app starts', () => {
    const source = readFileSync(mainPath, 'utf8')

    expect(source).toMatch(/const auth = useAuthStore\(pinia\)/)
    expect(source).toMatch(/if \(auth\.isAuthenticated\)[\s\S]*auth\.loadMe\(\)\.catch/)
  })
})
