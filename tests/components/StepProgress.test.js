import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Drive StepProgress from a fixed route (interview flow, step 3).
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/interview/style', meta: { flow: 'interview' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

import StepProgress from '../../src/components/common/StepProgress.vue'

describe('StepProgress', () => {
  test('renders the 5 interview steps with the current step active', () => {
    const wrapper = mount(StepProgress)
    const pills = wrapper.findAll('.step-pill')
    expect(pills).toHaveLength(5)

    const active = wrapper.findAll('.step-pill.active')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('면접관 선택')

    expect(wrapper.find('.presentation-progress').classes()).toContain('is-interview-progress')
  })
})
