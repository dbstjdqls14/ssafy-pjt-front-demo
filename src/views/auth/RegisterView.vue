<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { authApi } from '../../api/index.js'
import { isEmailAvailable } from '../../api/normalizers/auth.js'
import { withMock } from '../../api/withMock.js'
import { vGraphemeMax } from '../../directives/graphemeMax.js'
import { useAuthStore } from '../../stores/authStore.js'
import { countGraphemes } from '../../utils/textInputPolicy.js'
import {
  authMessages,
  isEmail,
  isStrongPassword,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  usernameValidationMessage,
} from '../../utils/validators.js'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const showPassword = ref(false)
const showPassword2 = ref(false)
const errors = ref({ username: '', email: '', password: '', password2: '', form: '' })

const submitting = ref(false)

const onUsernameInput = (event) => {
  errors.value.username = usernameValidationMessage(event.target.value)
}

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
  errors.value = { username: '', email: '', password: '', password2: '', form: '' }
  let valid = true
  const usernameError = usernameValidationMessage(username.value)
  if (usernameError) {
    errors.value.username = usernameError
    valid = false
  }
  if (email.value.trim().length > MAX_EMAIL_LENGTH) {
    errors.value.email = `이메일은 ${MAX_EMAIL_LENGTH}자 이하로 입력해주세요. (현재 ${email.value.trim().length}자)`
    valid = false
  } else if (!isEmail(email.value)) {
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
      nickname: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    router.push('/')
  } catch (caught) {
    const code = String(caught?.code ?? caught?.payload?.code ?? caught?.payload?.errorCode ?? '')
    if (code === '40901' || code === 'DUPLICATED_NICKNAME') {
      errors.value.username = '이미 사용 중인 닉네임이에요.'
    } else if (code === '40902' || code === 'DUPLICATED_EMAIL') {
      errors.value.email = '이미 사용 중인 이메일이에요.'
    } else {
      errors.value.form = caught?.message || caught?.payload?.message || '회원가입에 실패했어요. 입력 내용을 확인한 뒤 다시 시도해주세요.'
    }
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
        <div class="form-field" :class="{ 'field-invalid': errors.username }">
          <label for="username">닉네임</label>
          <div class="limited-field is-underline-field">
            <input
              id="username"
              v-model="username"
              v-grapheme-max="MAX_USERNAME_LENGTH"
              type="text"
              placeholder="한글, 영문, 숫자, 밑줄 4~20자"
              autocomplete="username"
              spellcheck="false"
              @input="onUsernameInput"
            />
            <small class="field-counter" aria-live="polite">{{ countGraphemes(username) }}/{{ MAX_USERNAME_LENGTH }}</small>
          </div>
          <small v-if="errors.username" class="field-error" data-testid="username-error" role="alert">{{ errors.username }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.email }">
          <label for="email">이메일</label>
          <input id="email" v-model="email" type="email" placeholder="aivo@example.com" autocomplete="email" :maxlength="MAX_EMAIL_LENGTH" @input="errors.email = ''" @blur="checkEmailDuplicate" />
          <small v-if="errors.email" class="field-error">{{ errors.email }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.password }">
          <label for="password">비밀번호</label>
          <div class="password-control">
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="영문·숫자 포함 8~20자" autocomplete="new-password" :maxlength="MAX_PASSWORD_LENGTH" @input="errors.password = ''" />
            <button type="button" class="password-toggle" :class="{ 'is-visible': showPassword }" :aria-pressed="showPassword" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" @click="showPassword = !showPassword"><span>{{ showPassword ? '숨기기' : '보기' }}</span></button>
          </div>
          <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.password2 }">
          <label for="password2">비밀번호 확인</label>
          <div class="password-control">
            <input id="password2" v-model="password2" :type="showPassword2 ? 'text' : 'password'" placeholder="비밀번호를 다시 입력하세요" autocomplete="new-password" :maxlength="MAX_PASSWORD_LENGTH" @input="errors.password2 = ''" />
            <button type="button" class="password-toggle" :class="{ 'is-visible': showPassword2 }" :aria-pressed="showPassword2" :aria-label="showPassword2 ? '비밀번호 숨기기' : '비밀번호 보기'" @click="showPassword2 = !showPassword2"><span>{{ showPassword2 ? '숨기기' : '보기' }}</span></button>
          </div>
          <small v-if="errors.password2" class="field-error">{{ errors.password2 }}</small>
        </div>

        <small v-if="errors.form" class="field-error" role="alert">{{ errors.form }}</small>
        <button type="submit" class="auth-submit solid" :disabled="submitting">{{ submitting ? '가입 중…' : '회원가입' }}</button>
      </form>

      <p class="auth-switch">이미 계정이 있나요? <RouterLink to="/login">로그인</RouterLink></p>
    </section>
  </main>
</template>
