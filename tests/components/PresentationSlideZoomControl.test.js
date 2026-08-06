import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import PresentationSlideZoomControl from '../../src/components/presentation/PresentationSlideZoomControl.vue'

describe('PresentationSlideZoomControl', () => {
  test('allows zooming out to 60 percent and resets to 100 percent', async () => {
    const wrapper = mount(PresentationSlideZoomControl, {
      props: { modelValue: 0.8 },
    })
    const buttons = wrapper.findAll('button')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([0.6])

    await buttons[2].trigger('click')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([1])
    expect(wrapper.get('input[type="range"]').attributes('min')).toBe('0.6')
  })
})
