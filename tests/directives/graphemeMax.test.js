import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, test } from 'vitest'

import { vGraphemeMax } from '../../src/directives/graphemeMax.js'

const mountInput = (initialValue = '') => {
  const value = ref(initialValue)
  const Host = defineComponent({
    directives: { graphemeMax: vGraphemeMax },
    setup: () => ({ value }),
    template: '<input v-model="value" v-grapheme-max="3" />',
  })
  const wrapper = mount(Host)
  return { wrapper, input: wrapper.get('input'), value }
}

const paste = async (input, text) => {
  await input.trigger('paste', {
    clipboardData: { getData: () => text },
  })
}

describe('vGraphemeMax', () => {
  test('caps programmatic input without breaking a grapheme', async () => {
    const { input, value } = mountInput()

    await input.setValue('가👨‍👩‍👧‍👦나다')

    expect(input.element.value).toBe('가👨‍👩‍👧‍👦나')
    expect(value.value).toBe('가👨‍👩‍👧‍👦나')
  })

  test('inserts only the pasted graphemes that fit', async () => {
    const { input, value } = mountInput()
    input.element.setSelectionRange(0, 0)

    await paste(input, '가👨‍👩‍👧‍👦나다')

    expect(input.element.value).toBe('가👨‍👩‍👧‍👦나')
    expect(value.value).toBe('가👨‍👩‍👧‍👦나')
  })

  test('allows selected text to be replaced at the limit', async () => {
    const { input, value } = mountInput('가나다')
    input.element.setSelectionRange(1, 2)

    await paste(input, '라')

    expect(input.element.value).toBe('가라다')
    expect(value.value).toBe('가라다')
  })

  test('waits for IME composition to finish before enforcing the limit', async () => {
    const { input, value } = mountInput()

    await input.trigger('compositionstart')
    input.element.value = '가나다라'
    await input.trigger('input')
    expect(input.element.value).toBe('가나다라')

    await input.trigger('compositionend')
    expect(input.element.value).toBe('가나다')
    expect(value.value).toBe('가나다')
  })
})
