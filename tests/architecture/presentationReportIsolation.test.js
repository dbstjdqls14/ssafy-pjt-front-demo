import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8')

const presentationSources = [
  'src/views/presentation/PresentationReportDetailView.vue',
  'src/components/presentation-report/PresentationReportSummary.vue',
  'src/components/presentation-report/PresentationReportAnalysis.vue',
  'src/components/presentation-report/PresentationReportVideoPanel.vue',
  'src/composables/usePresentationReportVideo.js',
]

const protectedInterviewSources = [
  'src/views/interview/InterviewReportDetailView.vue',
  'src/stores/interviewStore.js',
  'src/api/interviewApi.js',
]

describe('presentation report isolation', () => {
  // 지켜야 하는 경계는 "면접 화면·스토어·API에 의존하지 않는다"다.
  // 음성·몸짓 그래프 엔진(useVoicePaceGraph / useGestureGraph)은 두 리포트의
  // 그래프 디자인과 상호작용을 똑같이 유지하려고 일부러 공용으로 뽑아낸 순수
  // 계산 로직이므로 공유를 허용한다(그래야 한쪽만 바뀌어 어긋나지 않는다).
  it('does not import interview views, stores, or APIs', () => {
    const forbidden = [
      '/components/report/',
      '/views/interview/',
      '/stores/interviewStore',
      '/api/interviewApi',
      'useReportVideoController',
    ]

    for (const path of presentationSources) {
      const source = read(path)
      for (const token of forbidden) expect(source).not.toContain(token)
    }
  })

  it('does not make protected interview sources depend on presentation report code', () => {
    for (const path of protectedInterviewSources) {
      const source = read(path)
      expect(source).not.toContain('/components/presentation-report/')
      expect(source).not.toContain('usePresentationReport')
    }
  })

  it('removes the obsolete shared presentation report entry points', () => {
    expect(existsSync(resolve(projectRoot, 'src/views/archive/ArchiveDetailView.vue'))).toBe(false)
    expect(existsSync(resolve(projectRoot, 'src/components/report/PresentationVideoPanel.vue'))).toBe(false)
  })
})
