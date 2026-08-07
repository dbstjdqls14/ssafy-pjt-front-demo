<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/authStore.js'
import { isStrongPassword, authMessages } from '../../utils/validators.js'

const router = useRouter()
const auth = useAuthStore()

const current = ref('')
const newPw = ref('')
const confirmPw = ref('')
const errors = ref({ current: '', newPw: '', confirmPw: '' })
const notice = ref('')
const submitting = ref(false)

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
    await auth.changePassword({ currentPassword: current.value, newPassword: newPw.value })
    router.push('/mypage?edit=1')
  } catch (caught) {
    errors.value.current = caught?.payload?.message || '비밀번호 변경에 실패했어요. 현재 비밀번호를 확인해주세요.'
  } finally {
    submitting.value = false
  }
}

const logoutOthers = () => {
  notice.value = '다른 모든 기기에서 로그아웃되었어요. (데모)'
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
            <input id="current" v-model="current" type="password" placeholder="현재 비밀번호 입력" @input="errors.current = ''" />
            <small v-if="errors.current" class="field-error">{{ errors.current }}</small>
          </div>
          <div class="form-field" :class="{ 'field-invalid': errors.newPw }">
            <label for="newPw">새 비밀번호</label>
            <input id="newPw" v-model="newPw" type="password" placeholder="새 비밀번호 입력" @input="errors.newPw = ''" />
            <small v-if="errors.newPw" class="field-error">{{ errors.newPw }}</small>
          </div>
          <div class="form-field" :class="{ 'field-invalid': errors.confirmPw }">
            <label for="confirmPw">새 비밀번호 확인</label>
            <input id="confirmPw" v-model="confirmPw" type="password" placeholder="새 비밀번호 다시 입력" @input="errors.confirmPw = ''" />
            <small v-if="errors.confirmPw" class="field-error">{{ errors.confirmPw }}</small>
          </div>

          <div class="mypage-security-actions">
            <RouterLink to="/mypage?edit=1" class="btn-secondary">취소</RouterLink>
            <button type="submit" class="btn-primary" :disabled="submitting">{{ submitting ? '변경 중…' : '비밀번호 변경' }}</button>
          </div>
        </form>

        <div class="mypage-session-row">
          <div>
            <strong>최근 로그인</strong>
            <small>Windows · Chrome · 대전광역시 · 2026.07.16 14:22</small>
          </div>
          <button type="button" class="btn-ghost-sm" @click="logoutOthers">다른 기기 로그아웃</button>
        </div>

        <p v-if="notice" class="mypage-session-notice">{{ notice }}</p>
  </section>
</template>
