<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { authApi } from '../../api/index.js'
import { withMock } from '../../api/withMock.js'
import { INPUT_LIMITS } from '../../constants/inputLimits.js'
import { authMessages, isEmail } from '../../utils/validators.js'

const route = useRoute()

const activeTab = ref('id') // 'id' | 'password'
const success = ref('')
const submitting = ref(false)

const findName = ref('')
const findEmail = ref('')
const resetEmail = ref('')
const errors = ref({ findName: '', findEmail: '', resetEmail: '' })

const maskEmail = (value) => value.trim().replace(/^(.{2}).+(@.+)$/, '$1***$2')

const setTab = (tab) => {
  activeTab.value = tab
  success.value = ''
}

const submitFindId = async () => {
  errors.value.findName = ''
  errors.value.findEmail = ''
  let valid = true
  if (!findName.value.trim()) {
    errors.value.findName = authMessages.name
    valid = false
  } else if (findName.value.trim().length > INPUT_LIMITS.USERNAME) {
    errors.value.findName = `이름은 ${INPUT_LIMITS.USERNAME}자 이하로 입력해 주세요.`
    valid = false
  }
  if (!isEmail(findEmail.value)) {
    errors.value.findEmail = authMessages.email
    valid = false
  }
  if (!valid) return

  submitting.value = true
  try {
    const result = await withMock(
      () => authApi.findId({ nickname: findName.value.trim(), email: findEmail.value.trim() }),
      () => ({ email: findEmail.value.trim() }),
    )
    const found = result?.data?.email ?? result?.email ?? findEmail.value.trim()
    success.value = `가입하신 아이디는 ${maskEmail(found)} 입니다.`
  } catch (caught) {
    errors.value.findEmail = caught?.payload?.message || '일치하는 계정을 찾을 수 없어요.'
  } finally {
    submitting.value = false
  }
}

const submitResetPw = async () => {
  errors.value.resetEmail = ''
  if (!isEmail(resetEmail.value)) {
    errors.value.resetEmail = authMessages.email
    return
  }

  submitting.value = true
  try {
    await withMock(
      () => authApi.requestPasswordReset({ email: resetEmail.value.trim() }),
      () => ({ success: true }),
    )
    success.value = `${resetEmail.value.trim()} 주소로 재설정 링크를 보냈어요.`
  } catch (caught) {
    errors.value.resetEmail = caught?.payload?.message || '메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (route.query.tab === 'password') activeTab.value = 'password'
})
</script>

<template>
  <main class="auth-wrap auth-editorial">
    <section class="auth-card auth-card-recovery" aria-labelledby="recoveryTitle">
      <h1 id="recoveryTitle">계정 찾기</h1>

      <div class="auth-tabs">
        <button type="button" :class="{ active: activeTab === 'id' }" @click="setTab('id')">아이디 찾기</button>
        <button type="button" :class="{ active: activeTab === 'password' }" @click="setTab('password')">비밀번호 재설정</button>
      </div>

      <div class="form-success" :class="{ show: success }">{{ success }}</div>

      <form v-show="activeTab === 'id'" novalidate @submit.prevent="submitFindId">
        <div class="form-field" :class="{ 'field-invalid': errors.findName }">
          <label for="name">이름</label>
          <input id="name" v-model="findName" type="text" :maxlength="INPUT_LIMITS.USERNAME" placeholder="가입 시 입력한 이름" @input="errors.findName = ''" />
          <small v-if="errors.findName" class="field-error">{{ errors.findName }}</small>
        </div>
        <div class="form-field" :class="{ 'field-invalid': errors.findEmail }">
          <label for="idEmail">가입한 이메일</label>
          <input id="idEmail" v-model="findEmail" type="email" :maxlength="INPUT_LIMITS.EMAIL" placeholder="you@example.com" @input="errors.findEmail = ''" />
          <small v-if="errors.findEmail" class="field-error">{{ errors.findEmail }}</small>
        </div>
        <button type="submit" class="auth-submit" :disabled="submitting">{{ submitting ? '조회 중…' : '아이디 찾기' }}</button>
      </form>

      <form v-show="activeTab === 'password'" novalidate @submit.prevent="submitResetPw">
        <div class="form-field" :class="{ 'field-invalid': errors.resetEmail }">
          <label for="pwEmail">가입한 이메일</label>
          <input id="pwEmail" v-model="resetEmail" type="email" :maxlength="INPUT_LIMITS.EMAIL" placeholder="you@example.com" @input="errors.resetEmail = ''" />
          <small v-if="errors.resetEmail" class="field-error">{{ errors.resetEmail }}</small>
        </div>
        <button type="submit" class="auth-submit" :disabled="submitting">{{ submitting ? '보내는 중…' : '재설정 링크 보내기' }}</button>
      </form>

      <p class="auth-switch"><RouterLink to="/login">로그인으로 돌아가기</RouterLink></p>
    </section>
  </main>
</template>
