import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import PresentationReportSummary from '../../../src/components/presentation-report/PresentationReportSummary.vue'

describe('PresentationReportSummary display defense', () => {
  test('formats scores, count, and folder delta without leaking long decimals', () => {
    const wrapper = mount(PresentationReportSummary, {
      props: {
        practice: {
          title: '발표 제목',
          durationSec: 40.49,
          practicedAt: '2026-08-03T12:00:00',
        },
        presentation: { slideCount: 3.8 },
        slides: [{
          speech: {
            totalFillerCount: 3,
            silenceDetectedWindowCount: 0,
            buckets: [],
          },
        }],
        score: {
          overallScore: 58.499999999,
          folderAverageDelta: 6.733333333,
          voiceScore: 88.49,
          videoScore: 101,
          contentScore: Number.POSITIVE_INFINITY,
        },
      },
    })

    expect(wrapper.text()).toContain('58점')
    expect(wrapper.text()).toContain('2026.08.03')
    expect(wrapper.text()).not.toContain('2026.08.03.')
    expect(wrapper.text()).toContain('+6.7점')
    expect(wrapper.text()).toContain('4개')
    expect(wrapper.text()).toContain('88점')
    expect(wrapper.text()).toContain('추임새')
    expect(wrapper.text()).not.toContain('필러')
    expect(wrapper.text()).not.toContain('58.499999999')
    expect(wrapper.text()).not.toContain('101점')
  })

  test('replaces all scores when the total presentation duration is shorter than 30 seconds', () => {
    const wrapper = mount(PresentationReportSummary, {
      props: {
        practice: {
          title: '짧은 발표',
          durationSec: 29,
          practicedAt: '2026-08-04T12:00:00',
        },
        presentation: { slideCount: 2 },
        score: {
          overallScore: 47,
          folderAverageDelta: -5.8,
          voiceScore: 78,
          videoScore: 96,
          contentScore: 0,
        },
      },
    })

    expect(wrapper.text()).toContain('발표 시간이 너무 짧아요')
    expect(wrapper.text()).toContain(':(')
    expect(wrapper.find('.archive-report-metrics header.is-short-presentation > small').exists()).toBe(false)
    expect(wrapper.text()).toContain('전체 발표 시간이 30초 미만이에요.')
    expect(wrapper.text()).toContain('정확한 지표를 생성하기 어려워요.')
    expect(wrapper.text()).not.toContain('폴더 평균 대비')
    expect(wrapper.text()).not.toContain('47점')
    expect(wrapper.text()).not.toContain('78점')
    expect(wrapper.text()).not.toContain('96점')
    expect(wrapper.find('.archive-report-metrics > dl').exists()).toBe(false)
    expect(wrapper.find('.archive-short-presentation-state').exists()).toBe(true)
    expect(wrapper.find('.archive-short-presentation-message').exists()).toBe(true)
    expect(wrapper.findAll('.archive-short-presentation-message li').map((item) => item.text())).toEqual([
      '정확한 지표를 생성하기 어려워요.',
      '전체 발표 시간이 30초 미만이에요.',
    ])
  })

  test('keeps the normal result card from exactly 30 seconds of total presentation duration', () => {
    const wrapper = mount(PresentationReportSummary, {
      props: {
        practice: {
          title: '정상 발표',
          durationSec: 30,
          practicedAt: '2026-08-04T12:00:00',
        },
        presentation: { slideCount: 2 },
        score: {
          overallScore: 47,
          folderAverageDelta: -5.8,
          voiceScore: 78,
          videoScore: 96,
          contentScore: 0,
        },
      },
    })

    expect(wrapper.text()).toContain('연습 결과')
    expect(wrapper.text()).toContain('47점')
    expect(wrapper.text()).toContain('폴더 평균 대비 -5.8점')
    expect(wrapper.text()).not.toContain('평가가 어려워요')
  })

  test('formats presentation speech speed as words per second like the interview report', () => {
    const wrapper = mount(PresentationReportSummary, {
      props: {
        practice: {
          title: '발표 속도 단위',
          durationSec: 40,
          practicedAt: '2026-08-04T12:00:00',
        },
        presentation: { slideCount: 1 },
        score: {
          overallScore: 80,
          voiceScore: 80,
          videoScore: 80,
          contentScore: 80,
        },
        slides: [{
          speech: {
            totalFillerCount: 0,
            silenceDetectedWindowCount: 0,
            buckets: [
              { startSec: 0, endSec: 10, averageWpm: 120 },
              { startSec: 10, endSec: 20, averageWpm: 180 },
            ],
          },
        }],
      },
    })

    const voiceDetail = wrapper.get('[data-score-metric="음성"] .archive-score-detail').text()
    expect(voiceDetail).toContain('말 속도 평균초당 2.50어절')
    expect(voiceDetail).toContain('최저 속도초당 2.00어절')
    expect(voiceDetail).toContain('최고 속도초당 3.00어절')
    expect(voiceDetail).not.toContain('WPM')
  })
})
