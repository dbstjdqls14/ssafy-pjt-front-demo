import { countGraphemes, sliceGraphemes } from '../utils/textInputPolicy.js'

const states = new WeakMap()

const readMaxLength = (value) => (
  Number.isInteger(value) && value >= 0 ? value : null
)

const dispatchModelInput = (element) => {
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

const replaceElementValue = (element, value, cursor = value.length) => {
  if (element.value === value) return false
  element.value = value
  dispatchModelInput(element)
  if (typeof element.setSelectionRange === 'function') {
    const safeCursor = Math.min(cursor, value.length)
    element.setSelectionRange(safeCursor, safeCursor)
  }
  return true
}

const enforceCurrentValue = (element, state) => {
  if (state.maxLength === null) return
  const limited = sliceGraphemes(element.value, state.maxLength)
  replaceElementValue(element, limited)
}

const buildReplacement = (element, insertedText) => {
  const start = element.selectionStart ?? element.value.length
  const end = element.selectionEnd ?? start
  return {
    start,
    end,
    before: element.value.slice(0, start),
    after: element.value.slice(end),
    insertedText,
  }
}

const mountDirective = (element, binding) => {
  const state = {
    composing: false,
    maxLength: readMaxLength(binding.value),
  }

  state.onBeforeInput = (event) => {
    if (state.composing || event.isComposing || state.maxLength === null) return
    if (!String(event.inputType ?? '').startsWith('insert') || event.inputType === 'insertFromPaste') return
    if (typeof event.data !== 'string') return

    const replacement = buildReplacement(element, event.data)
    const nextValue = `${replacement.before}${replacement.insertedText}${replacement.after}`
    if (countGraphemes(nextValue) > state.maxLength) event.preventDefault()
  }

  state.onPaste = (event) => {
    if (state.composing || state.maxLength === null) return
    const pastedText = event.clipboardData?.getData('text')
    if (typeof pastedText !== 'string') return

    event.preventDefault()
    const replacement = buildReplacement(element, pastedText)
    const retainedLength = countGraphemes(`${replacement.before}${replacement.after}`)
    const availableLength = Math.max(0, state.maxLength - retainedLength)
    const insertedText = sliceGraphemes(pastedText, availableLength)
    const nextValue = `${replacement.before}${insertedText}${replacement.after}`
    replaceElementValue(element, nextValue, replacement.before.length + insertedText.length)
  }

  state.onInput = (event) => {
    if (state.composing || event.isComposing) return
    enforceCurrentValue(element, state)
  }
  state.onCompositionStart = () => { state.composing = true }
  state.onCompositionEnd = () => {
    state.composing = false
    enforceCurrentValue(element, state)
  }

  element.addEventListener('beforeinput', state.onBeforeInput)
  element.addEventListener('paste', state.onPaste)
  element.addEventListener('input', state.onInput)
  element.addEventListener('compositionstart', state.onCompositionStart)
  element.addEventListener('compositionend', state.onCompositionEnd)
  states.set(element, state)
}

const updateDirective = (element, binding) => {
  const state = states.get(element)
  if (state) state.maxLength = readMaxLength(binding.value)
}

const unmountDirective = (element) => {
  const state = states.get(element)
  if (!state) return
  element.removeEventListener('beforeinput', state.onBeforeInput)
  element.removeEventListener('paste', state.onPaste)
  element.removeEventListener('input', state.onInput)
  element.removeEventListener('compositionstart', state.onCompositionStart)
  element.removeEventListener('compositionend', state.onCompositionEnd)
  states.delete(element)
}

export const vGraphemeMax = {
  mounted: mountDirective,
  updated: updateDirective,
  unmounted: unmountDirective,
}
