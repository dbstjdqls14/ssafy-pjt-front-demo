import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installInputLengthGuard } from '../../src/utils/inputLengthGuard.js'

let uninstall

const mountField = (attributes = {}, tag = 'input') => {
  const field = document.createElement(tag)
  Object.entries(attributes).forEach(([name, value]) => field.setAttribute(name, value))
  document.body.append(field)
  return field
}

// 커서를 끝에 둔 상태로 값을 채운다(= 사용자가 끝까지 입력한 상황).
const fillToCaretEnd = (field, value) => {
  field.value = value
  field.setSelectionRange(value.length, value.length)
}

const pressKey = (field, init) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  field.dispatchEvent(event)
  return event.defaultPrevented
}

const startComposition = (field) => {
  field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
}

// 조합 중 한 글자가 들어오는 상황. 브라우저는 값을 먼저 바꾸고 input을 쏜다.
const composeInto = (field, nextValue) => {
  field.value = nextValue
  field.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    isComposing: true,
    inputType: 'insertCompositionText',
  }))
}

const endComposition = (field) => {
  field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
}

const CHARACTER_KEY = { key: 'a', code: 'KeyA' }

describe('입력 길이 가드', () => {
  beforeEach(() => {
    uninstall = installInputLengthGuard(document)
  })

  afterEach(() => {
    uninstall()
    document.body.innerHTML = ''
  })

  describe('한글 조합 입력', () => {
    // 이 프로젝트의 핵심 버그: 상한에서 자모를 더 누르면 확정된 마지막 글자가 바뀌었다.
    it('상한에서 조합을 더 이어가도 확정된 글자를 덮어쓰지 않는다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      fillToCaretEnd(field, '가나다라마')

      startComposition(field)
      // maxlength를 떼어 두므로 브라우저가 조합 문자열을 잘라 망가뜨릴 수 없다.
      expect(field.hasAttribute('maxlength')).toBe(false)

      // 6번째 글자가 들어오려 하면 상한까지 되돌린다.
      composeInto(field, '가나다라마바')
      expect(field.value).toBe('가나다라마')

      endComposition(field)
      expect(field.value).toBe('가나다라마')
      expect(field.getAttribute('maxlength')).toBe('5')
    })

    // "가"에 ㄱ을 더해 "각"이 되는 입력은 글자 수가 늘지 않으므로 허용해야 한다.
    it('상한에서도 글자 수가 늘지 않는 조합은 그대로 반영한다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      fillToCaretEnd(field, '가나다라가')

      startComposition(field)
      composeInto(field, '가나다라각')
      expect(field.value).toBe('가나다라각')

      endComposition(field)
      expect(field.value).toBe('가나다라각')
    })

    it('조합 중에는 키를 막지 않는다(조합이 끊기면 안 된다)', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      fillToCaretEnd(field, '가나다라마')
      startComposition(field)

      expect(pressKey(field, { key: 'Process', code: 'KeyR', keyCode: 229 })).toBe(false)
    })

    it('조합 중 포커스가 빠져도 상한과 maxlength를 복구한다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      fillToCaretEnd(field, '가나다라마')
      startComposition(field)
      field.value = '가나다라마바'

      field.dispatchEvent(new FocusEvent('blur', { bubbles: false }))

      expect(field.value).toBe('가나다라마')
      expect(field.getAttribute('maxlength')).toBe('5')
    })

    it('textarea에도 같은 규칙을 적용한다', () => {
      const field = mountField({ maxlength: '3' }, 'textarea')
      fillToCaretEnd(field, '가나다')

      startComposition(field)
      composeInto(field, '가나다라')
      expect(field.value).toBe('가나다')
      endComposition(field)
      expect(field.getAttribute('maxlength')).toBe('3')
    })
  })

  describe('조합이 아닌 입력', () => {
    it('상한에서 문자 키를 막는다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      fillToCaretEnd(field, '가나다라마')

      expect(pressKey(field, CHARACTER_KEY)).toBe(true)
      expect(pressKey(field, { key: ' ', code: 'Space' })).toBe(true)
    })

    it('상한에서도 지우기·이동·확정 키는 그대로 동작한다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      fillToCaretEnd(field, '가나다라마')

      expect(pressKey(field, { key: 'Backspace', code: 'Backspace' })).toBe(false)
      expect(pressKey(field, { key: 'Delete', code: 'Delete' })).toBe(false)
      expect(pressKey(field, { key: 'ArrowLeft', code: 'ArrowLeft' })).toBe(false)
      expect(pressKey(field, { key: 'Tab', code: 'Tab' })).toBe(false)
      expect(pressKey(field, { key: 'Enter', code: 'Enter' })).toBe(false)
      expect(pressKey(field, { ...CHARACTER_KEY, ctrlKey: true })).toBe(false)
    })

    it('상한 미달이거나 선택 영역을 덮어쓸 때는 막지 않는다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })

      fillToCaretEnd(field, '가나다라')
      expect(pressKey(field, CHARACTER_KEY)).toBe(false)

      fillToCaretEnd(field, '가나다라마')
      field.setSelectionRange(0, 2)
      expect(pressKey(field, CHARACTER_KEY)).toBe(false)
    })

    it('붙여넣기처럼 keydown을 거치지 않은 초과 값은 상한까지 잘라낸다', () => {
      const field = mountField({ type: 'text', maxlength: '5' })
      field.value = '가나다라마바사아'
      field.dispatchEvent(new Event('input', { bubbles: true }))

      expect(field.value).toBe('가나다라마')
    })

    it('maxlength가 없는 입력칸은 건드리지 않는다', () => {
      const field = mountField({ type: 'text' })
      fillToCaretEnd(field, '아무리 길게 적어도 상한이 없다')

      expect(pressKey(field, CHARACTER_KEY)).toBe(false)

      startComposition(field)
      expect(field.hasAttribute('maxlength')).toBe(false)
      composeInto(field, '아무리 길게 적어도 상한이 없다요')
      expect(field.value).toBe('아무리 길게 적어도 상한이 없다요')
    })
  })
})
