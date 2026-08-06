import { getCurrentScope, onScopeDispose, ref, toValue } from 'vue'

export const useCountUp = (target, { initialValue = 0, step = 1, interval = 24 } = {}) => {
  const value = ref(initialValue)
  let timer = null

  const stop = () => {
    if (timer == null) return
    globalThis.clearInterval(timer)
    timer = null
  }

  const start = () => {
    stop()
    value.value = initialValue
    const targetValue = Number(toValue(target)) || 0

    if (value.value >= targetValue) {
      value.value = targetValue
      return
    }

    timer = globalThis.setInterval(() => {
      if (value.value >= targetValue) {
        value.value = targetValue
        stop()
        return
      }
      value.value += step
    }, interval)
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return { value, start, stop }
}
