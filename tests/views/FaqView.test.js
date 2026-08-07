import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'

import FaqView from '../../src/views/FaqView.vue'

describe('FaqView', () => {
  test('paginates to 15 items per page by default', () => {
    const wrapper = mount(FaqView)
    expect(wrapper.findAll('.faq-item')).toHaveLength(15)
  })

  test('category tab filters the list', async () => {
    const wrapper = mount(FaqView)
    const presentationTab = wrapper.findAll('.faq-tab-btn').find((btn) => btn.text() === '발표 연습')
    await presentationTab.trigger('click')
    const items = wrapper.findAll('.faq-item')
    expect(items.length).toBe(5)
    expect(items.every((item) => item.text().includes('발표 연습'))).toBe(true)
  })

  test('clicking a question toggles it open', async () => {
    const wrapper = mount(FaqView)
    const first = wrapper.find('.faq-item')
    expect(first.classes()).not.toContain('open')
    await first.trigger('click')
    expect(first.classes()).toContain('open')
  })
})
