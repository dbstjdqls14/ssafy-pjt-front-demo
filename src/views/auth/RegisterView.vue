<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { authApi } from '../../api/index.js'
import { isEmailAvailable } from '../../api/normalizers/auth.js'
import { withMock } from '../../api/withMock.js'
import { useAuthStore } from '../../stores/authStore.js'
import { authMessages, isEmail, isStrongPassword } from '../../utils/validators.js'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const showPassword = ref(false)
const showPassword2 = ref(false)
const errors = ref({ name: '', email: '', password: '', password2: '' })

const submitting = ref(false)

// check-email 응답을 사용 가능 여부(boolean)로 정규화. 백엔드가 available/isAvailable/
// duplicated 등 어떤 키를 쓰더라도 "사용 가능"으로 수렴시킨다.
// 이메일 필드를 벗어날 때 중복확인. 데모(목업)에서는 항상 사용 가능으로 통과한다.
const checkEmailDuplicate = async () => {
  if (!isEmail(email.value)) return
  const result = await withMock(
    () => authApi.checkEmail(email.value.trim()),
    () => ({ available: true }),
  )
  if (!isEmailAvailable(result)) {
    errors.value.email = '이미 사용 중인 이메일이에요.'
  }
}

const onSubmit = async () => {
  errors.value = { name: '', email: '', password: '', password2: '' }
  let valid = true
  if (!name.value.trim()) {
    errors.value.name = authMessages.name
    valid = false
  }
  if (!isEmail(email.value)) {
    errors.value.email = authMessages.email
    valid = false
  }
  if (!isStrongPassword(password.value)) {
    errors.value.password = authMessages.password
    valid = false
  }
  if (password2.value !== password.value || !password2.value) {
    errors.value.password2 = authMessages.passwordMismatch
    valid = false
  }
  if (!valid) return

  submitting.value = true
  try {
    await auth.register({
      nickname: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    router.push('/')
  } catch (caught) {
    errors.value.email = caught?.payload?.message || '회원가입에 실패했어요. 잠시 후 다시 시도해주세요.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="auth-wrap auth-editorial">
    <section class="auth-card auth-card-register" aria-labelledby="registerTitle">
      <h1 id="registerTitle">회원가입</h1>

      <form novalidate @submit.prevent="onSubmit">
        <div class="form-field" :class="{ 'field-invalid': errors.name }">
          <label for="name">이름</label>
          <input id="name" v-model="name" type="text" placeholder="이름을 입력하세요" autocomplete="name" @input="errors.name = ''" />
          <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.email }">
          <label for="email">이메일</label>
          <input id="email" v-model="email" type="email" placeholder="aivo@example.com" autocomplete="email" @input="errors.email = ''" @blur="checkEmailDuplicate" />
          <small v-if="errors.email" class="field-error">{{ errors.email }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.password }">
          <label for="password">비밀번호</label>
          <div class="password-control">
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="8자 이상 입력하세요" autocomplete="new-password" @input="errors.password = ''" />
            <button type="button" class="password-toggle" :class="{ 'is-visible': showPassword }" :aria-pressed="showPassword" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" @click="showPassword = !showPassword"><span>{{ showPassword ? '숨기기' : '보기' }}</span></button>
          </div>
          <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.password2 }">
          <label for="password2">비밀번호 확인</label>
          <div class="password-control">
            <input id="password2" v-model="password2" :type="showPassword2 ? 'text' : 'password'" placeholder="비밀번호를 다시 입력하세요" autocomplete="new-password" @input="errors.password2 = ''" />
            <button type="button" class="password-toggle" :class="{ 'is-visible': showPassword2 }" :aria-pressed="showPassword2" :aria-label="showPassword2 ? '비밀번호 숨기기' : '비밀번호 보기'" @click="showPassword2 = !showPassword2"><span>{{ showPassword2 ? '숨기기' : '보기' }}</span></button>
          </div>
          <small v-if="errors.password2" class="field-error">{{ errors.password2 }}</small>
        </div>

        <button type="submit" class="auth-submit solid" :disabled="submitting">{{ submitting ? '가입 중…' : '회원가입' }}</button>
      </form>

      <p class="auth-switch">이미 계정이 있나요? <RouterLink to="/login">로그인</RouterLink></p>
    </section>
  </main>
</template>
