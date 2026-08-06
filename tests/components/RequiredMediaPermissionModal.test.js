import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'

import RequiredMediaPermissionModal from '../../src/components/common/RequiredMediaPermissionModal.vue'

test('renders fixed permission guidance and emits confirm from one button', async () => {
  const wrapper = mount(RequiredMediaPermissionModal)

  expect(wrapper.text()).toContain('카메라와 마이크 권한이 필요합니다.')
  expect(wrapper.text()).toContain('주소창 왼쪽의 사이트 설정에서 권한을 허용한 뒤 다시 요청해 주세요.')
  expect(wrapper.findAll('button')).toHaveLength(1)

  await wrapper.get('[data-testid="required-media-permission-confirm"]').trigger('click')

  expect(wrapper.emitted('confirm')).toHaveLength(1)
})

test('disables the button and shows progress while checking permissions', () => {
  const wrapper = mount(RequiredMediaPermissionModal, { props: { busy: true } })
  const button = wrapper.get('[data-testid="required-media-permission-confirm"]')

  expect(button.text()).toBe('확인 중…')
  expect(button.attributes('disabled')).toBeDefined()
})
