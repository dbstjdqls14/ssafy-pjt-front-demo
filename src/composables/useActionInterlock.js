import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

export const useActionInterlock = ({ cooldownMs = 1_000 } = {}) => {
  const pendingAction = ref(null)
  const isCoolingDown = ref(false)
  let cooldownTimer = null

  const isLocked = computed(() => Boolean(pendingAction.value) || isCoolingDown.value)

  const clearCooldown = () => {
    if (cooldownTimer !== null) window.clearTimeout(cooldownTimer)
    cooldownTimer = null
    isCoolingDown.value = false
  }

  const startCooldown = () => {
    clearCooldown()
    if (!(cooldownMs > 0)) return

    isCoolingDown.value = true
    cooldownTimer = window.setTimeout(clearCooldown, cooldownMs)
  }

  const runExclusive = async (name, action) => {
    if (isLocked.value) return undefined

    pendingAction.value = name
    try {
      return await action()
    } finally {
      pendingAction.value = null
      startCooldown()
    }
  }

  const dispose = () => {
    clearCooldown()
    pendingAction.value = null
  }

  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    pendingAction,
    isCoolingDown,
    isLocked,
    runExclusive,
    clearCooldown,
    dispose,
  }
}
