import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('../../src/composables/useHomeMotion.js', () => ({ useHomeMotion: vi.fn() }))
vi.mock('../../src/composables/useDotField.js', () => ({ useDotField: vi.fn() }))

import HomeView from '../../src/views/HomeView.vue'

const mountHome = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/practice', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  return mount(HomeView, {
    global: {
      plugins: [createPinia(), router],
    },
  })
}

describe('home report previews', () => {
  test('changes the presentation transcript when a slide thumbnail is selected', async () => {
    const wrapper = await mountHome()

    expect(wrapper.get('.home-script-question-row h4').text()).toBe('슬라이드 1. 서비스 소개')
    expect(wrapper.get('.home-script-line.is-current').text()).toContain('발표 자료와 실제 발화를 함께 분석')

    await wrapper.findAll('.home-review-thumb')[1].trigger('click')

    expect(wrapper.get('.home-script-question-row h4').text()).toBe('슬라이드 2. 실시간 분석')
    expect(wrapper.get('.home-script-line.is-current').text()).toContain('말하기 속도와 시선, 자세를 실시간으로 확인')
    expect(wrapper.get('.home-review-slide .home-review-col-head span').text()).toBe('슬라이드 2 · 실시간 분석')
  })

  test('shows the simplified gesture preview without tabs or summary chips', async () => {
    const wrapper = await mountHome()

    expect(wrapper.get('.home-gesture-graph-head h3').text()).toBe('몸짓도 확인 가능해요')
    expect(wrapper.find('.home-gesture-tabs').exists()).toBe(false)
    expect(wrapper.find('.home-gesture-plot-card').exists()).toBe(false)
    expect(wrapper.find('.home-gesture-chart').exists()).toBe(true)
    expect(wrapper.get('.home-gesture-plot > svg path').attributes('d')).toContain('C')
    expect(wrapper.findAll('.home-gesture-eye-marker')).toHaveLength(4)
    expect(wrapper.get('.home-gesture-marker-layer').findAll('.home-gesture-eye-marker')).toHaveLength(4)
    expect(wrapper.find('.home-gesture-summary').exists()).toBe(false)
  })

  test('keeps the fastest and slowest markers in a lane below the voice graph', async () => {
    const wrapper = await mountHome()
    const chart = wrapper.get('.home-pace-chart')

    expect(chart.get('.home-pace-plot').findAll('.iv-pace-range-mark')).toHaveLength(0)
    expect(chart.get('.home-pace-range-lane').findAll('.iv-pace-range-mark')).toHaveLength(2)
  })
})
