import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'

import FaqView from '../../src/views/FaqView.vue'

describe('FaqView', () => {
  test('paginates to 15 items per page by default', () => {
    const wrapper = mount(FaqView)
    expect(wrapper.findAll('.faq-item')).toHaveLength(15)
    expect(wrapper.get('.faq-search-box input').attributes('maxlength')).toBe('50')
  })

  test('category tab filters the list', async () => {
    const wrapper = mount(FaqView)
    const presentationTab = wrapper.findAll('.faq-tab-btn').find((btn) => btn.text() === '발표 연습')
    await presentationTab.trigger('click')
    const items = wrapper.findAll('.faq-item')
    expect(items.length).toBe(5)
    expect(items.every((item) => item.text().includes('발표 연습'))).toBe(true)
  })

  // v-model이면 한글 조합이 끝날 때까지 값이 갱신되지 않아 검색이 늦게 반응한다.
  // 조합 중(isComposing) input 이벤트만으로도 목록이 걸러져야 한다.
  test('filters while a Korean composition is still in progress', async () => {
    const wrapper = mount(FaqView)
    const input = wrapper.get('.faq-search-box input')

    input.element.dispatchEvent(new CompositionEvent('compositionstart'))
    input.element.value = '카메라'
    input.element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      isComposing: true,
      inputType: 'insertCompositionText',
      data: '카메라',
    }))
    await wrapper.vm.$nextTick()

    const items = wrapper.findAll('.faq-item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('카메라 없이도 연습할 수 있나요?')
  })

  test('clicking a question toggles it open', async () => {
    const wrapper = mount(FaqView)
    const first = wrapper.find('.faq-item')
    expect(first.classes()).not.toContain('open')
    await first.trigger('click')
    expect(first.classes()).toContain('open')
  })
})
