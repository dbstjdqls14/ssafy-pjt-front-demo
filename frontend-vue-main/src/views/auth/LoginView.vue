<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/authStore.js'
import { authMessages, isEmail, MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from '../../utils/validators.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errors = ref({ email: '', password: '', form: '' })

const redirect = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' ? target : ''
})
const redirectNote = computed(() => {
  if (route.query.notice === 'login-required') return '로그인이 필요한 서비스입니다.'
  return redirect.value && redirect.value !== '/' ? '계속하려면 먼저 로그인해주세요.' : ''
})

const completeLogin = async (mail, pass) => {
  await auth.login({ email: mail, password: pass })
  router.push(redirect.value && redirect.value !== '/login' ? redirect.value : '/')
}

const onSubmit = async () => {
  errors.value = { email: '', password: '', form: '' }
  let valid = true
  if (!isEmail(email.value)) {
    errors.value.email = authMessages.email
    valid = false
  }
  if (password.value.length < 4) {
    errors.value.password = authMessages.passwordRequired
    valid = false
  }
  if (!valid) return
  try {
    await completeLogin(email.value.trim(), password.value)
  } catch (caught) {
    // 40004(형식), 40401(사용자 없음) 등 → 자격 증명 문제로 안내.
    errors.value.form = [400, 401, 404].includes(caught?.status)
      ? '이메일 또는 비밀번호를 확인해주세요.'
      : (caught?.message || '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }
}
</script>

<template>
  <main class="auth-wrap auth-editorial">
    <section class="auth-card" aria-labelledby="loginTitle">
      <h1 id="loginTitle">로그인</h1>

      <div class="form-success" :class="{ show: redirectNote }">{{ redirectNote }}</div>

      <form novalidate @submit.prevent="onSubmit">
        <div class="form-field" :class="{ 'field-invalid': errors.email }">
          <label for="email">이메일</label>
          <input id="email" v-model="email" type="email" placeholder="aivo@example.com" autocomplete="email" :maxlength="MAX_EMAIL_LENGTH" @input="errors.email = ''" />
          <small v-if="errors.email" class="field-error">{{ errors.email }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.password }">
          <label for="password">비밀번호</label>
          <div class="password-control">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="비밀번호를 입력하세요"
              autocomplete="current-password"
              :maxlength="MAX_PASSWORD_LENGTH"
              @input="errors.password = ''"
            />
            <button
              type="button"
              class="password-toggle"
              :class="{ 'is-visible': showPassword }"
              :aria-pressed="showPassword"
              :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'"
              @click="showPassword = !showPassword"
            ><span>{{ showPassword ? '숨기기' : '보기' }}</span></button>
          </div>
          <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
        </div>

        <small v-if="errors.form" class="field-error" role="alert">{{ errors.form }}</small>
        <button type="submit" class="auth-submit solid" :disabled="auth.isLoading">
          {{ auth.isLoading ? '로그인 중…' : '로그인' }}
        </button>
      </form>

      <p class="auth-switch">계정이 없나요? <RouterLink to="/register">회원가입</RouterLink></p>
    </section>
  </main>
</template>
