import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CameraZoomControl from '../../src/components/common/CameraZoomControl.vue'

describe('CameraZoomControl', () => {
  it('renders vertical plus-slider-minus controls and emits stepped zoom values', async () => {
    const wrapper = mount(CameraZoomControl, { props: { modelValue: 1.4 } })
    const buttons = wrapper.findAll('button')

    expect(buttons.map((button) => button.text())).toEqual(['+', '−'])
    expect(wrapper.find('.camera-zoom-slider input').attributes('type')).toBe('range')

    await buttons[0].trigger('click')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[1.5], [1.3]])
  })
})
