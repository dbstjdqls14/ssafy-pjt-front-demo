<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/authStore.js'
import { isStrongPassword, authMessages, MAX_PASSWORD_LENGTH } from '../../utils/validators.js'

const router = useRouter()
const auth = useAuthStore()

const current = ref('')
const newPw = ref('')
const confirmPw = ref('')
const errors = ref({ current: '', newPw: '', confirmPw: '' })
const submitting = ref(false)

// 입력한 비밀번호를 눈으로 확인할 수 있게 칸마다 '보기' 토글을 둔다(칸별로 독립).
const revealed = ref({ current: false, newPw: false, confirmPw: false })
const toggleReveal = (field) => { revealed.value[field] = !revealed.value[field] }

const onSubmit = async () => {
  errors.value = { current: '', newPw: '', confirmPw: '' }
  let valid = true
  if (!current.value) {
    errors.value.current = '현재 비밀번호를 입력해주세요.'
    valid = false
  }
  if (!isStrongPassword(newPw.value)) {
    errors.value.newPw = newPw.value ? authMessages.password : '새 비밀번호를 입력해주세요.'
    valid = false
  }
  if (confirmPw.value !== newPw.value || !confirmPw.value) {
    errors.value.confirmPw = '비밀번호가 일치하지 않아요.'
    valid = false
  }
  if (!valid) return

  submitting.value = true
  try {
    await auth.changePassword({
      currentPassword: current.value,
      newPassword: newPw.value,
      newPasswordConfirm: confirmPw.value,
    })
    router.push('/mypage?edit=1')
  } catch (caught) {
    errors.value.current = caught?.payload?.message || '비밀번호 변경에 실패했어요. 현재 비밀번호를 확인해주세요.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mypage-panel">
    <header class="mypage-content-head">
      <div>
        <h2>비밀번호 변경</h2>
        <p>안전한 계정을 위해 주기적으로 비밀번호를 변경해주세요.</p>
      </div>
    </header>

        <form class="mypage-security-form" novalidate @submit.prevent="onSubmit">
          <div class="form-field" :class="{ 'field-invalid': errors.current }">
            <label for="current">현재 비밀번호</label>
            <div class="password-field">
              <input
                id="current"
                v-model="current"
                :type="revealed.current ? 'text' : 'password'"
                :maxlength="MAX_PASSWORD_LENGTH"
                placeholder="현재 비밀번호 입력"
                @input="errors.current = ''"
              />
              <button
                type="button"
                class="password-reveal-btn"
                data-testid="toggle-current-password"
                :aria-pressed="revealed.current"
                :aria-label="`현재 비밀번호 ${revealed.current ? '숨기기' : '보기'}`"
                @click="toggleReveal('current')"
              >{{ revealed.current ? '숨기기' : '보기' }}</button>
            </div>
            <small v-if="errors.current" class="field-error">{{ errors.current }}</small>
          </div>
          <div class="form-field" :class="{ 'field-invalid': errors.newPw }">
            <label for="newPw">새 비밀번호</label>
            <div class="password-field">
              <input
                id="newPw"
                v-model="newPw"
                :type="revealed.newPw ? 'text' : 'password'"
                :maxlength="MAX_PASSWORD_LENGTH"
                placeholder="영문·숫자 포함 8~20자"
                @input="errors.newPw = ''"
              />
              <button
                type="button"
                class="password-reveal-btn"
                data-testid="toggle-new-password"
                :aria-pressed="revealed.newPw"
                :aria-label="`새 비밀번호 ${revealed.newPw ? '숨기기' : '보기'}`"
                @click="toggleReveal('newPw')"
              >{{ revealed.newPw ? '숨기기' : '보기' }}</button>
            </div>
            <small v-if="errors.newPw" class="field-error">{{ errors.newPw }}</small>
          </div>
          <div class="form-field" :class="{ 'field-invalid': errors.confirmPw }">
            <label for="confirmPw">새 비밀번호 확인</label>
            <div class="password-field">
              <input
                id="confirmPw"
                v-model="confirmPw"
                :type="revealed.confirmPw ? 'text' : 'password'"
                :maxlength="MAX_PASSWORD_LENGTH"
                placeholder="새 비밀번호 다시 입력"
                @input="errors.confirmPw = ''"
              />
              <button
                type="button"
                class="password-reveal-btn"
                data-testid="toggle-confirm-password"
                :aria-pressed="revealed.confirmPw"
                :aria-label="`새 비밀번호 확인 ${revealed.confirmPw ? '숨기기' : '보기'}`"
                @click="toggleReveal('confirmPw')"
              >{{ revealed.confirmPw ? '숨기기' : '보기' }}</button>
            </div>
            <small v-if="errors.confirmPw" class="field-error">{{ errors.confirmPw }}</small>
          </div>

          <div class="mypage-security-actions">
            <RouterLink to="/mypage?edit=1" class="btn-secondary">취소</RouterLink>
            <button type="submit" class="btn-primary" :disabled="submitting">{{ submitting ? '변경 중…' : '비밀번호 변경' }}</button>
          </div>
        </form>
  </section>
</template>
