import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const cssFiles = [
  'src/assets/styles/views/presentation-flow.css',
  'src/assets/styles/views/presentation-ready.css',
  'src/assets/styles/app-shell.css',
]

const readyPageCss = cssFiles
  .map((relativePath) => readFileSync(resolve(projectRoot, relativePath), 'utf8'))
  .join('\n')

describe('presentation ready review overflow', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.body.className = ''
    document.body.innerHTML = ''
  })

  test('keeps every review ancestor open so the bottom actions can scroll into view', () => {
    document.head.innerHTML = `<style>${readyPageCss}</style>`
    document.body.className = 'presentation-flow-page presentation-ready-page'
    document.body.innerHTML = `
      <div class="route-view">
        <main class="presentation-flow-shell">
          <div class="wizard-shell">
            <div class="workflow-stage">
              <div class="workflow-stage-content ready-flow-content">
                <section class="ready-slide-review is-visible">
                  <div class="ready-slide-panel"></div>
                  <div class="ready-review-actions">
                    <button class="ready-edit-button">다시 작성하러 가기</button>
                    <button class="ready-confirm-button">확인 완료</button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    `

    const clippingAncestors = [
      '.presentation-flow-shell',
      '.wizard-shell',
      '.workflow-stage-content.ready-flow-content',
    ]

    for (const selector of clippingAncestors) {
      const element = document.querySelector(selector)
      const styles = getComputedStyle(element)
      expect(styles.height, selector).toBe('auto')
      expect(styles.overflow, selector).toBe('visible')
    }

    const actions = document.querySelector('.ready-review-actions')
    expect(getComputedStyle(actions).marginBottom).toBe('72px')
  })
})
