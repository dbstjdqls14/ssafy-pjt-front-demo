<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/authStore.js'
import logo from '../../assets/images/aivo-logo.png'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const profileImageVisible = ref(Boolean(auth.user?.profileImageUrl))
const failedProfileImageIdentities = new Set()
const profileImageUrl = computed(() => String(auth.user?.profileImageUrl ?? ''))
const profileImageIdentity = computed(() => auth.profileImageIdentity)

watch(profileImageIdentity, (next, previous) => {
  if (!profileImageUrl.value) {
    profileImageVisible.value = false
    return
  }
  if (next !== previous) profileImageVisible.value = true
}, { immediate: true })

const onProfileImageError = async () => {
  const failedUrl = profileImageUrl.value
  const failedIdentity = profileImageIdentity.value
  profileImageVisible.value = false
  if (!failedUrl || failedProfileImageIdentities.has(failedIdentity)) return
  failedProfileImageIdentities.add(failedIdentity)
  try {
    const refreshed = await auth.refreshProfileImage()
    const renewedUrl = String(refreshed?.profileImageUrl ?? '')
    profileImageVisible.value = Boolean(
      renewedUrl && profileImageIdentity.value !== failedIdentity,
    )
  } catch {
    profileImageVisible.value = false
  }
}

const links = [
  { key: 'practice', label: '새 연습', to: '/practice' },
  { key: 'archive', label: '내 기록', to: '/archive' },
  { key: 'faq', label: 'FAQ', to: '/faq' },
]

// Active nav key: route.meta.area wins, else infer from the path.
const activeKey = computed(() => {
  if (route.meta.area) return route.meta.area
  if (route.path.startsWith('/archive')) return 'archive'
  if (route.path.startsWith('/faq')) return 'faq'
  return 'practice'
})

// Sliding underline: a single indicator that animates to the active link's
// label, instead of a per-item ::after that would jump between items.
const navLinksEl = ref(null)
const underlineStyle = ref({ opacity: 0 })
const underlineReady = ref(false)

const measureUnderline = () => {
  const container = navLinksEl.value
  if (!container) return
  const activeLink = container.querySelector('.nav-link.active')
  const target = activeLink?.querySelector('.nav-link-label') ?? activeLink
  if (!target) {
    underlineStyle.value = { ...underlineStyle.value, opacity: 0 }
    return
  }
  const c = container.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  underlineStyle.value = {
    width: `${t.width}px`,
    transform: `translateX(${t.left - c.left}px)`,
    opacity: 1,
  }
}

// Re-measure after the DOM reflects the new active class.
watch(activeKey, () => nextTick(measureUnderline))

onMounted(() => {
  nextTick(() => {
    measureUnderline()
    // Enable the transition only after the first placement so it doesn't slide
    // in from x=0 on initial load. (setTimeout, not rAF: fires reliably even
    // when the tab isn't compositing.)
    setTimeout(() => { underlineReady.value = true }, 60)
  })
  // Web fonts can change label width once loaded; re-place when they settle.
  document.fonts?.ready?.then(measureUnderline)
  window.addEventListener('resize', measureUnderline)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureUnderline)
})

const logout = async () => {
  await auth.logout()
  router.push('/')
}
</script>

<template>
  <header class="top-nav">
    <div class="nav-inner">
      <RouterLink to="/" class="nav-logo" aria-label="AIVO 홈">
        <span class="nav-logo-crop"><img :src="logo" alt="AIVO" /></span>
      </RouterLink>

      <nav class="nav-links" ref="navLinksEl">
        <RouterLink
          v-for="link in links"
          :key="link.key"
          :to="link.to"
          :class="['nav-link', `nav-link-${link.key}`, { active: activeKey === link.key }]"
          :aria-current="activeKey === link.key ? 'page' : undefined"
        >
          <span class="nav-link-label">{{ link.label }}</span>
        </RouterLink>
        <span
          class="nav-underline"
          :class="{ 'is-animated': underlineReady }"
          :style="underlineStyle"
          aria-hidden="true"
        ></span>
      </nav>

      <div class="nav-right">
        <template v-if="auth.isAuthenticated">
          <span class="nav-avatar">
            <img
              v-if="profileImageVisible && profileImageUrl"
              :key="profileImageIdentity"
              data-testid="nav-profile-image"
              :src="profileImageUrl"
              @error="onProfileImageError"
              :alt="`${auth.user.nickname} 프로필 이미지`"
            />
            <template v-else>{{ auth.user.nickname.slice(0, 1) }}</template>
          </span>
          <span class="nav-name" :title="`${auth.user.nickname}님`">
            <span class="nav-profile-label">
              <span class="nav-profile-nickname">{{ auth.user.nickname }}</span>
              <span class="nav-profile-suffix">님</span>
            </span>
          </span>
          <RouterLink to="/mypage" class="nav-link-small nav-mypage-link">
            <span class="nav-link-label">마이페이지</span>
          </RouterLink>
          <button type="button" class="nav-link-small" @click="logout">로그아웃</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="nav-link-small">로그인</RouterLink>
          <RouterLink to="/register" class="nav-login-btn">회원가입</RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>
