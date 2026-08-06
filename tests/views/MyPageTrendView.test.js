import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import MyPageTrendView from '../../src/views/mypage/MyPageTrendView.vue'
import { userApi } from '../../src/api/userApi.js'

vi.mock('../../src/api/userApi.js', () => ({
  userApi: {
    getPracticeTrends: vi.fn(),
  },
}))

const trendsResponse = {
  earlyTrend: {
    content: 82,
    stability: 71,
    glance: 2,
    filler: 1.4,
    speed: 11.2,
    totalTime: 5.2,
  },
  lateTrend: {
    content: 91,
    stability: 68,
    glance: 1.3,
    filler: 0.8,
    speed: 14.8,
    totalTime: 3.4,
  },
  practices: [
    { contentScore: 79, videoScore: 72, voiceScore: 81 },
    { contentScore: 82, videoScore: 70, voiceScore: 84 },
    { contentScore: 84, videoScore: 71, voiceScore: 83 },
    { contentScore: 88, videoScore: 68, voiceScore: 87 },
    { contentScore: 91, videoScore: 67, voiceScore: 89 },
    { contentScore: 94, videoScore: 69, voiceScore: 92 },
  ],
  speech: {
    averageSpeechSpeed: 137,
    earlySpeechSpeed: 122,
    lateSpeechSpeed: 152,
    silenceLate: 4.2,
  },
}

describe('MyPageTrendView', () => {
  beforeEach(() => {
    userApi.getPracticeTrends.mockReset()
    userApi.getPracticeTrends.mockResolvedValue(trendsResponse)
  })

  test('loads the unified trends API and renders six comparison metrics', async () => {
    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(userApi.getPracticeTrends).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-testid="core-metric-card"]')).toHaveLength(6)
    expect(wrapper.get('h2').text()).toBe('\uB0B4 \uD559\uC2B5 \uCD94\uC774')
    expect(wrapper.text()).toContain('\uCD5C\uADFC 3\uD68C\uC640 \uC774\uC804 3\uD68C\uB97C \uBE44\uAD50\uD588\uC5B4\uC694')
    expect(wrapper.findAll('[data-testid="type-tab"]')).toHaveLength(0)
  })

  test('limits the score trend selectors to content, body, and voice', async () => {
    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    const buttons = wrapper.findAll('[data-testid="score-series-button"]')
    expect(buttons.map((button) => button.text())).toEqual(['\uB0B4\uC6A9', '\uBAB8\uC9D3', '\uC74C\uC131'])

    await buttons[1].trigger('click')
    expect(wrapper.findAll('[data-testid="chart-point-value"]').map((point) => point.text())).toEqual([
      '72\uC810',
      '70\uC810',
      '71\uC810',
      '68\uC810',
      '67\uC810',
      '69\uC810',
    ])
  })

  test('uses natural recommendation copy without composing 전달를', async () => {
    userApi.getPracticeTrends.mockResolvedValue({
      ...trendsResponse,
      earlyTrend: { ...trendsResponse.earlyTrend, content: 92 },
      lateTrend: { ...trendsResponse.lateTrend, content: 71 },
    })

    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.get('.trend-next-goal h3').text()).toContain('지표를 먼저 개선해 보세요.')
    expect(wrapper.text()).not.toContain('전달를')
  })

  test('plots scores against a fixed 0 to 100 vertical axis', async () => {
    userApi.getPracticeTrends.mockResolvedValue({
      ...trendsResponse,
      practices: [
        { contentScore: 0, videoScore: 0, voiceScore: 0 },
        { contentScore: 50, videoScore: 50, voiceScore: 50 },
        { contentScore: 100, videoScore: 100, voiceScore: 100 },
        { contentScore: 0, videoScore: 0, voiceScore: 0 },
        { contentScore: 50, videoScore: 50, voiceScore: 50 },
        { contentScore: 100, videoScore: 100, voiceScore: 100 },
      ],
    })

    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="chart-axis-label"]').map((label) => label.text())).toEqual([
      '100',
      '75',
      '50',
      '25',
      '0',
    ])
    expect(wrapper.findAll('.trend-chart-dot').map((point) => Number(point.attributes('cy')))).toEqual([
      180,
      105,
      30,
      180,
      105,
      30,
    ])
    expect(wrapper.get('.trend-history-chart svg').attributes('viewBox')).toBe('0 0 600 210')
  })

  test('rounds long score decimals in graph labels', async () => {
    userApi.getPracticeTrends.mockResolvedValue({
      ...trendsResponse,
      practices: [{ contentScore: 91.49999999, videoScore: 70, voiceScore: 80 }],
    })

    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.get('[data-testid="chart-point-value"]').text()).toBe('91점')
    expect(wrapper.text()).not.toContain('91.49999999')
  })

  test('renders the speech reference values from the response', async () => {
    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.get('[data-testid="average-wpm"]').text()).toContain('137 WPM')
    expect(wrapper.text()).toContain('122 WPM')
    expect(wrapper.text()).toContain('152 WPM')
    expect(wrapper.text()).toContain('+24.6%')
    expect(wrapper.text()).toContain('4.2%')
  })

  test('shows insufficient history without replacing missing values with zero', async () => {
    userApi.getPracticeTrends.mockResolvedValue({
      earlyTrend: null,
      lateTrend: { content: 88 },
      practices: [
        { contentScore: 84, videoScore: 70, voiceScore: 80 },
        { contentScore: 86, videoScore: 72, voiceScore: 82 },
        { contentScore: 88, videoScore: 74, voiceScore: 84 },
      ],
      speech: {},
    })

    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.text()).toContain('88\uC810')
    expect(wrapper.text()).toContain('\uC774\uC804 \uAE30\uB85D\uC774 \uBD80\uC871\uD574\uC694')
    expect(wrapper.text()).not.toContain('0 WPM')
  })

  // "왜 지표가 안 뜨지?"로 읽히던 상태 → 남은 횟수·현재 기록·다음 행동을 안내한다.
  describe('비교 지표가 열리기 전 상태', () => {
    test('tells the user how many practices are left and lists what exists', async () => {
      userApi.getPracticeTrends.mockResolvedValue({
        earlyTrend: null,
        lateTrend: null,
        practices: [
          { contentScore: 70, videoScore: 60, voiceScore: 80 },
        ],
        speech: {},
      })

      // 이 파일의 다른 테스트는 라우터 없이 마운트하므로 CTA만 앵커로 스텁한다.
      const wrapper = mount(MyPageTrendView, {
        global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
      })
      await flushPromises()

      const onboarding = wrapper.get('[data-testid="trend-onboarding"]')
      expect(onboarding.text()).toContain('추이 비교까지 1회 남았어요')
      // 지표는 지우지 않고 흐리게 깔아 두고, 안내 + 연습하러 가기만 위에 띄운다.
      expect(wrapper.get('.trend-body').classes()).toContain('is-locked')
      expect(onboarding.get('a').attributes('href')).toBe('/practice')
      expect(wrapper.text()).toContain('연습 2회부터 비교 지표가 열려요')
      expect(wrapper.text()).not.toContain('최근 3회와 이전 3회를 비교했어요')
    })

    // 안내 문구가 약속하는 2회를 채웠는데 서버가 아직 이전 구간을 못 내려주면,
    // 남은 횟수를 세는 대신 "집계하는 중"으로 안내한다.
    test('switches to the aggregating notice once the promised count is reached', async () => {
      userApi.getPracticeTrends.mockResolvedValue({
        earlyTrend: null,
        lateTrend: null,
        practices: [
          { contentScore: 70, videoScore: 60, voiceScore: 80 },
          { contentScore: 90, videoScore: 80, voiceScore: 82 },
        ],
        speech: {},
      })

      const wrapper = mount(MyPageTrendView, {
        global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
      })
      await flushPromises()

      expect(wrapper.get('[data-testid="trend-onboarding"]').text()).toContain('이전 기록을 집계하는 중이에요')
      expect(wrapper.get('.trend-body').classes()).toContain('is-locked')
    })
    test('explains an empty history instead of showing a remaining count', async () => {
      userApi.getPracticeTrends.mockResolvedValue({
        earlyTrend: null,
        lateTrend: null,
        practices: [],
        speech: {},
      })

      const wrapper = mount(MyPageTrendView)
      await flushPromises()

      expect(wrapper.get('[data-testid="trend-onboarding"]').text()).toContain('아직 분석할 연습 기록이 없어요')
      expect(wrapper.find('[data-testid="trend-progress-label"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid="trend-onboarding-practice"]')).toHaveLength(0)
    })

    test('says the earlier group is still being aggregated when the count is already enough', async () => {
      userApi.getPracticeTrends.mockResolvedValue({
        earlyTrend: null,
        lateTrend: { content: 88 },
        practices: [
          { contentScore: 70, videoScore: 60, voiceScore: 80 },
          { contentScore: 72, videoScore: 62, voiceScore: 82 },
          { contentScore: 74, videoScore: 64, voiceScore: 84 },
          { contentScore: 76, videoScore: 66, voiceScore: 86 },
        ],
        speech: {},
      })

      const wrapper = mount(MyPageTrendView)
      await flushPromises()

      expect(wrapper.get('[data-testid="trend-onboarding"]').text()).toContain('이전 기록을 집계하는 중이에요')
    })

    test('hides the onboarding panel once the comparison is available', async () => {
      const wrapper = mount(MyPageTrendView)
      await flushPromises()

      expect(wrapper.find('[data-testid="trend-onboarding"]').exists()).toBe(false)
    })
  })

  test('uses the available earlier record when four practices exist', async () => {
    userApi.getPracticeTrends.mockResolvedValue({
      ...trendsResponse,
      practices: trendsResponse.practices.slice(0, 4),
    })

    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.text()).toContain('이전 1회')
    expect(wrapper.find('.trend-history-missing').exists()).toBe(false)
  })

  test('keeps the dashboard visible with per-section unavailable states when the API fails', async () => {
    userApi.getPracticeTrends.mockRejectedValueOnce(new Error('network'))

    const wrapper = mount(MyPageTrendView)
    await flushPromises()

    expect(wrapper.get('[data-testid="trend-warning"]').text()).toContain('\uD559\uC2B5 \uCD94\uC774\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694')
    expect(wrapper.findAll('[data-testid="core-metric-card"]')).toHaveLength(6)
    expect(wrapper.findAll('[data-testid="core-metric-card"].is-unavailable')).toHaveLength(6)
    expect(wrapper.findAll('[data-testid="speech-reference-card"]')).toHaveLength(4)
    expect(wrapper.findAll('[data-testid="speech-reference-card"].is-unavailable')).toHaveLength(4)
    expect(wrapper.get('[data-testid="score-history-unavailable"]').text()).toContain('\uC544\uC9C1 \uD45C\uC2DC\uD560 \uC5F0\uC2B5 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694')

    await wrapper.get('[data-testid="trend-retry"]').trigger('click')
    await flushPromises()

    expect(userApi.getPracticeTrends).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('[data-testid="core-metric-card"]')).toHaveLength(6)
    expect(wrapper.find('[data-testid="trend-warning"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="core-metric-card"].is-unavailable')).toHaveLength(0)
  })
})
