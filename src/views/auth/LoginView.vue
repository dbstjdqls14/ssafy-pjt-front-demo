<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/authStore.js'
import { authMessages, isEmail } from '../../utils/validators.js'
import kakaoIcon from '../../assets/images/kakao-login-symbol.svg'
import googleIcon from '../../assets/images/google-g-logo.svg'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errors = ref({ email: '', password: '' })

const redirect = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' ? target : ''
})
const redirectNote = computed(() =>
  redirect.value && redirect.value !== '/' ? '계속하려면 먼저 로그인해주세요.' : '',
)

const completeLogin = async (nickname, mail) => {
  await auth.login({ nickname, email: mail })
  router.push(redirect.value && redirect.value !== '/login' ? redirect.value : '/')
}

const onSubmit = () => {
  errors.value = { email: '', password: '' }
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
  completeLogin(email.value.split('@')[0], email.value.trim())
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
          <input id="email" v-model="email" type="email" placeholder="aivo@example.com" autocomplete="email" @input="errors.email = ''" />
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
          <div class="auth-help-link">
            <RouterLink to="/find-account?tab=password">비밀번호 찾기</RouterLink>
          </div>
        </div>

        <button type="submit" class="auth-submit solid">로그인</button>
      </form>

      <div class="auth-divider">또는</div>

      <button type="button" class="social-btn kakao" @click="completeLogin('서가은', 'seogaeun@kakao.com')">
        <img class="social-icon" :src="kakaoIcon" alt="" aria-hidden="true" />
        <span>카카오로 계속하기</span>
      </button>
      <button type="button" class="social-btn google" @click="completeLogin('서가은', 'seogaeun@gmail.com')">
        <img class="social-icon" :src="googleIcon" alt="" aria-hidden="true" />
        <span>구글로 계속하기</span>
      </button>

      <p class="auth-switch">계정이 없나요? <RouterLink to="/register">회원가입</RouterLink></p>
    </section>
  </main>
</template>
