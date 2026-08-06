import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PresentationReportAnalysis from '../../../src/components/presentation-report/PresentationReportAnalysis.vue'

// 그래프는 면접 리포트와 같은 엔진·마크업(.iv-pace-*)을 쓴다. 구간별 투명 클릭
// 영역(data-speech-bucket) 대신 느린/빠른 구간 마크와 추임새 점, 침묵 배경을 눌러
// 해당 시각으로 이동한다.
describe('PresentationReportAnalysis', () => {
  it('emits a slide-local seek time from the measured pace marks', async () => {
    const wrapper = mount(PresentationReportAnalysis, {
      props: {
        slide: {
          slideNumber: 2,
          durationSec: 20,
          speech: {
            averageWpm: 125,
            totalFillerCount: 3,
            fillerBreakdown: [
              { word: '음', count: 1 },
              { word: '아', count: 1 },
              { word: '어', count: 1 },
            ],
            buckets: [
              {
                startSec: 0,
                endSec: 10,
                averageWpm: 120,
                fillerCount: 1,
                fillerEvents: [{ word: '음', atSec: 4, absoluteAtSec: 4 }],
              },
              { startSec: 10, endSec: 20, averageWpm: 130, fillerCount: 0 },
            ],
          },
          gesture: null,
        },
        activeMetric: 'voice',
        activeLocalSec: 0,
      },
    })

    // 가장 빠른 구간(10~20초) 마크를 누르면 그 구간 시작으로 이동한다.
    const rangeMarks = wrapper.findAll('.iv-pace-range-mark')
    expect(rangeMarks).toHaveLength(2)
    await rangeMarks[1].trigger('click')
    expect(wrapper.emitted('seek-local')[0]).toEqual([10])

    expect(wrapper.get('[data-filler-breakdown]').text()).toContain('음 1회')
    expect(wrapper.get('[data-filler-breakdown]').text()).toContain('아 1회')
    expect(wrapper.get('[data-filler-breakdown]').text()).toContain('어 1회')
    expect(wrapper.get('.iv-pace-legend-item.is-filler').text()).toContain('추임새')
    expect(wrapper.get('.iv-pace-chip.is-filler').text()).toContain('추임새')

    const fillerDot = wrapper.get('[data-filler-event="0"]')
    expect(fillerDot.attributes('aria-label')).toContain('추임새')
    expect(fillerDot.attributes('style')).toContain('left: 20%')
    await fillerDot.trigger('click')
    expect(wrapper.emitted('seek-local')[1]).toEqual([4])

    await wrapper.get('[data-metric="gesture"]').trigger('click')
    await wrapper.setProps({ activeMetric: 'gesture' })
    expect(wrapper.get('[data-gesture-empty]').text()).toContain('데이터가 없습니다')
  })

  it('formats measured decimals and counts before displaying them', () => {
    const wrapper = mount(PresentationReportAnalysis, {
      props: {
        slide: {
          slideNumber: 1,
          durationSec: 20.7,
          speech: {
            totalFillerCount: 2.9,
            silenceDetectedWindowCount: 1.8,
            totalSilenceDurationMs: 2333.333,
            fillerBreakdown: [{ word: '음', count: 1.9 }],
            buckets: [
              { startSec: 0, endSec: 10, averageWpm: 118.333333333 },
              { startSec: 10, endSec: 20, averageWpm: 139.666666666 },
            ],
          },
          gesture: null,
        },
        activeMetric: 'voice',
      },
    })

    // averageWpm이 없어도 구간 길이로 가중 평균해 표시한다.
    expect(wrapper.text()).toContain('평균 속도 · 초당 2.15어절')
    // 추임새 칩은 용어 설명 말풍선을 품고 있어 텍스트가 붙지 않는다 → 칩 안에서 확인.
    expect(wrapper.get('.iv-pace-chip.is-filler').text()).toContain('3회')
    expect(wrapper.get('.iv-pace-chip.is-filler').text()).toContain('음 2회')
    expect(wrapper.text()).toContain('1초 이상 정적 2회')
    expect(wrapper.text()).not.toContain('118.333333333')
    // 측정 범위는 구간 최저·최고와 평균을 모두 감싼다(여유 ±5 WPM).
    expect(wrapper.get('.iv-pace-meta-range').text()).toBe('초당 1.89어절–2.41어절 측정 범위')
  })

  // 0 WPM 구간이 섞여도 y축 하한이 음수로 내려가면 안 된다.
  it('shows every visible presentation pace label as words per second', () => {
    const wrapper = mount(PresentationReportAnalysis, {
      props: {
        slide: {
          slideNumber: 1,
          durationSec: 20,
          speech: {
            averageWpm: 129,
            totalFillerCount: 0,
            fillerBreakdown: [],
            buckets: [
              { startSec: 0, endSec: 10, averageWpm: 42 },
              { startSec: 10, endSec: 20, averageWpm: 672 },
            ],
          },
          gesture: null,
        },
        activeMetric: 'voice',
      },
    })

    expect(wrapper.get('.iv-pace-avg-label').text()).toContain('\uCD08\uB2F9 2.15\uC5B4\uC808')
    expect(wrapper.get('.iv-pace-chip.is-slow').text()).toContain('\uCD08\uB2F9 0.70\uC5B4\uC808')
    expect(wrapper.get('.iv-pace-chip.is-fast').text()).toContain('\uCD08\uB2F9 11.20\uC5B4\uC808')
    expect(wrapper.get('.iv-pace-meta-range').text()).toContain('\uC5B4\uC808')
    expect(wrapper.text()).not.toContain('WPM')
  })

  it('never shows a negative measured range', () => {
    const wrapper = mount(PresentationReportAnalysis, {
      props: {
        slide: {
          slideNumber: 1,
          durationSec: 20,
          speech: {
            averageWpm: 60,
            totalFillerCount: 0,
            fillerBreakdown: [],
            buckets: [
              { startSec: 0, endSec: 10, averageWpm: 0 },
              { startSec: 10, endSec: 20, averageWpm: 120 },
            ],
          },
          gesture: null,
        },
        activeMetric: 'voice',
      },
    })

    expect(wrapper.get('.iv-pace-meta-range').text()).toBe('초당 0.00어절–2.08어절 측정 범위')
  })

  it('renders the same pace chrome as the interview report', () => {
    const wrapper = mount(PresentationReportAnalysis, {
      props: {
        slide: {
          slideNumber: 1,
          durationSec: 20,
          speech: {
            averageWpm: 125,
            totalFillerCount: 0,
            fillerBreakdown: [],
            silenceDetectedWindowCount: 1,
            buckets: [
              { startSec: 0, endSec: 10, averageWpm: 120, silenceDetected: true },
              { startSec: 10, endSec: 20, averageWpm: 130 },
            ],
          },
          gesture: null,
        },
        activeMetric: 'voice',
      },
    })

    expect(wrapper.find('.iv-pace-legend').exists()).toBe(true)
    expect(wrapper.find('.iv-pace-avg-line').exists()).toBe(true)
    expect(wrapper.find('.iv-pace-step-line').exists()).toBe(true)
    expect(wrapper.findAll('.iv-pace-silence-bg')).toHaveLength(1)
    expect(wrapper.find('.iv-pace-chips').exists()).toBe(true)
  })
})
