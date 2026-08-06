import { getCurrentScope, onScopeDispose } from 'vue'

export const useDebouncedCallback = (callback, delay = 250) => {
  let timer = null

  const cancel = () => {
    if (timer == null) return
    globalThis.clearTimeout(timer)
    timer = null
  }

  const schedule = (...args) => {
    cancel()
    timer = globalThis.setTimeout(() => {
      timer = null
      callback(...args)
    }, delay)
  }

  if (getCurrentScope()) onScopeDispose(cancel)

  return { schedule, cancel }
}
