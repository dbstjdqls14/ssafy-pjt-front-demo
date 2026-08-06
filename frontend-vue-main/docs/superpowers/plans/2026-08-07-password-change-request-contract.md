# Password Change Request Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the password confirmation value required by the Spring password-change DTO so valid password changes no longer fail request validation.

**Architecture:** Keep the existing view → Pinia auth Store → `userApi` → HTTP client flow. Add the missing `newPasswordConfirm` field at the view boundary, verify the complete JSON request through a component integration test with only `fetch` stubbed, and align the API contract document.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vue Router, Vitest, Vue Test Utils, Vite

## Global Constraints

- Send exactly `currentPassword`, `newPassword`, and `newPasswordConfirm` to `PATCH /api/v1/users/me/password`.
- Use the user-entered `confirmPw` value for `newPasswordConfirm`; do not copy `newPassword` inside the Store or API layer.
- Keep the existing validation, success navigation, and failure copy unchanged.
- Do not change backend code or add dependencies.
- Do not perform browser-based testing.
- Preserve unrelated unstaged interview report changes and exclude them from this task's commit.

---

## File Structure

- `src/views/mypage/MyPageSecurityView.vue`: validates the three form fields and constructs the password-change payload.
- `tests/views/MyPageSecurityView.test.js`: mounts the real view with real Pinia/API flow, stubs only `fetch`, and verifies the serialized backend request plus success navigation.
- `docs/api-specification.md`: records the actual three-field Spring request contract.

### Task 1: Send and verify the complete password-change request

**Files:**
- Create: `tests/views/MyPageSecurityView.test.js`
- Modify: `src/views/mypage/MyPageSecurityView.vue:40`
- Modify: `docs/api-specification.md:55`

**Interfaces:**
- Consumes: `auth.changePassword(payload): Promise<unknown>`, `PATCH /api/v1/users/me/password`
- Produces: JSON body `{ currentPassword: string, newPassword: string, newPasswordConfirm: string }`

- [ ] **Step 1: Write the failing component integration test**

Create `tests/views/MyPageSecurityView.test.js`:

```js
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import MyPageSecurityView from '../../src/views/mypage/MyPageSecurityView.vue'

describe('MyPageSecurityView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('sends the confirmation password required by the backend contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/mypage/security', component: MyPageSecurityView },
        { path: '/mypage', component: { template: '<div>mypage</div>' } },
      ],
    })
    await router.push('/mypage/security')
    await router.isReady()
    const wrapper = mount(MyPageSecurityView, {
      global: { plugins: [router] },
    })

    await wrapper.get('#current').setValue('Current123!')
    await wrapper.get('#newPw').setValue('Next12345!')
    await wrapper.get('#confirmPw').setValue('Next12345!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/users/me/password')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({
      currentPassword: 'Current123!',
      newPassword: 'Next12345!',
      newPasswordConfirm: 'Next12345!',
    })
    expect(router.currentRoute.value.fullPath).toBe('/mypage?edit=1')
    wrapper.unmount()
  })
})
```

The production change this test catches is omission or renaming of `newPasswordConfirm` at the view-to-API boundary.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node node_modules/vitest/vitest.mjs run tests/views/MyPageSecurityView.test.js
```

Expected: FAIL because the serialized body contains only `currentPassword` and `newPassword`.

- [ ] **Step 3: Implement the minimal payload correction**

In `MyPageSecurityView.vue`, change the successful submission call to:

```js
await auth.changePassword({
  currentPassword: current.value,
  newPassword: newPw.value,
  newPasswordConfirm: confirmPw.value,
})
```

Do not change `authStore.changePassword` or `userApi.changePassword`; both already forward payloads unchanged.

- [ ] **Step 4: Align the API specification**

Change the password-change row in `docs/api-specification.md` so the request column reads:

```text
`currentPassword`, `newPassword`, `newPasswordConfirm`
```

- [ ] **Step 5: Run focused and related tests and verify GREEN**

```powershell
node node_modules/vitest/vitest.mjs run tests/views/MyPageSecurityView.test.js tests/stores/stores.test.js tests/views/RegisterView.test.js tests/views/LoginView.test.js
```

Expected: all listed files pass with zero failures.

- [ ] **Step 6: Run full non-browser verification**

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
git diff --check -- src/views/mypage/MyPageSecurityView.vue tests/views/MyPageSecurityView.test.js docs/api-specification.md
```

Expected: all Vitest files pass, Vite exits with code `0`, and the task diff has no whitespace errors. Do not open or automate a browser.

- [ ] **Step 7: Commit only password-change files**

```powershell
git add -- src/views/mypage/MyPageSecurityView.vue tests/views/MyPageSecurityView.test.js docs/api-specification.md
git commit -m "fix: send password confirmation to backend"
```
