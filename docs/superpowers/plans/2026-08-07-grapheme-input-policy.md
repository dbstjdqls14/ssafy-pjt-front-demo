# Grapheme Input Policy Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce every policy-managed maximum length by visible grapheme count, including paste and IME input, while allowing all non-emoji text in descriptions, questions, and slide notes.

**Architecture:** Extend the DOM-independent text policy utility with grapheme-safe slicing and emoji-presentation detection. Add one reusable Vue directive for user-originated length enforcement, apply it to every policy-managed field, and retain Store validation as the final API boundary. Existing server values are validated but are never truncated merely because a view loaded.

**Tech Stack:** Vue 3 `<script setup>`, custom Vue directive, Pinia, Vitest, `Intl.Segmenter`, Unicode property escapes, Vite

## Global Constraints

- Count and limit text by grapheme clusters, not UTF-16 code units.
- New typing, paste, drag input, and completed IME input must not exceed each field's existing limit.
- Keep invalid characters visible; only excess graphemes are omitted.
- `nickname` and `singleLineContent` keep their existing strict character rules.
- `singleLineProse` and `multiLineContent` allow every non-emoji character, including all languages, punctuation, symbols, tabs, and formatting characters.
- Plain text symbols such as `©`, `♥`, `℃`, `→`, `···`, `‘’` are valid; emoji presentations such as `😊`, `❤️`, flags, keycaps, and ZWJ emoji are invalid.
- Do not truncate values merely because they came from the server already over the limit.
- Do not change email, password, search, file, or select inputs.
- Do not run manual browser tests for this change.

---

### Task 1: Grapheme slicing and emoji-only prose validation

**Files:**
- Modify: `src/utils/textInputPolicy.js`
- Modify: `tests/utils/textInputPolicy.test.js`

**Interfaces:**
- Produces: `sliceGraphemes(value, maxLength): string`
- Produces: `hasEmojiPresentation(value): boolean`
- Keeps: `countGraphemes(value)` and `textPolicyValidationMessage(value, options)`

- [ ] **Step 1: Write failing utility tests.**

```js
expect(sliceGraphemes('가👨‍👩‍👧‍👦나다', 3)).toBe('가👨‍👩‍👧‍👦나')
expect(hasEmojiPresentation('© ♥ ℃ → ··· ‘문장’ 日本語\t')).toBe(false)
expect(hasEmojiPresentation('😊 ❤️ 🇰🇷 1️⃣ 👨‍👩‍👧‍👦')).toBe(true)
expect(textPolicyValidationMessage('‘오늘의 건수’ ··· 日本語\t', {
  policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
  maxLength: 100,
})).toBe('')
expect(textPolicyValidationMessage('설명 😊', {
  policy: TEXT_INPUT_POLICIES.MULTI_LINE_CONTENT,
  maxLength: 100,
})).toBe('이모지는 입력할 수 없어요.')
```

- [ ] **Step 2: Run `node node_modules/vitest/vitest.mjs run tests/utils/textInputPolicy.test.js` and confirm failure because the new exports and prose behavior do not exist.**
- [ ] **Step 3: Implement grapheme-safe slicing from `Intl.Segmenter` segments and emoji detection for default emoji presentation, U+FE0F presentation, regional flags, keycaps, modifiers, and ZWJ emoji. Do not classify plain text-presentation symbols as emoji.**
- [ ] **Step 4: Replace prose allow-list regular expressions with `hasEmojiPresentation` checks and the message `이모지는 입력할 수 없어요.`; keep nickname/title patterns unchanged.**
- [ ] **Step 5: Rerun the focused utility tests until green.**

### Task 2: Reusable user-input grapheme limit directive

**Files:**
- Create: `src/directives/graphemeMax.js`
- Create: `tests/directives/graphemeMax.test.js`

**Interfaces:**
- Consumes: `countGraphemes`, `sliceGraphemes`
- Produces: named export `vGraphemeMax`

- [ ] **Step 1: Write a failing mounted-component test for normal input, paste, replacement selection, and IME completion.**

```js
const Host = {
  template: '<input v-model="value" v-grapheme-max="3" />',
  setup: () => ({ value: ref('') }),
  directives: { graphemeMax: vGraphemeMax },
}
// Programmatic input '가나다라' settles as '가나다'.
// Pasting '가👨‍👩‍👧‍👦나다' into an empty input settles as '가👨‍👩‍👧‍👦나'.
// Replacing a selected grapheme at the limit remains possible.
// Composition input is untouched until compositionend and then capped.
```

- [ ] **Step 2: Run `node node_modules/vitest/vitest.mjs run tests/directives/graphemeMax.test.js` and confirm failure because the directive is absent.**
- [ ] **Step 3: Implement event listeners for `beforeinput`, `paste`, `input`, `compositionstart`, and `compositionend`. Prevent over-limit insertion when possible, insert only the paste portion that fits, and use an input-event fallback for programmatic or drag changes. Dispatch one bubbling `input` event after a directive-authored value change so `v-model` receives the final value.**
- [ ] **Step 4: Remove all listeners in `unmounted` and rerun the focused directive test until green.**

### Task 3: Apply the shared limit to all policy-managed views

**Files:**
- Modify: `src/views/auth/RegisterView.vue`
- Modify: `src/views/mypage/MyPageView.vue`
- Modify: `src/views/presentation/PresentationSetupView.vue`
- Modify: `src/views/presentation/PresentationSlidesView.vue`
- Modify: `src/views/interview/InterviewSetupView.vue`
- Modify: `src/views/interview/InterviewQuestionsView.vue`
- Modify: `src/views/practice/FolderSelectView.vue`
- Modify: `src/views/mypage/MyPageDocumentsView.vue`
- Modify: corresponding files under `tests/views/`

**Interfaces:**
- Consumes: local `<script setup>` import `vGraphemeMax` used as `v-grapheme-max="limit"`
- Produces: view models and counters that never exceed the configured maximum after user input

- [ ] **Step 1: Add failing view tests using literal over-limit values for nickname (20), practice title (15), practice/folder description (100), document title (50), slide note (500), and interview question (200). Assert the final DOM value and counter, not directive internals.**
- [ ] **Step 2: Run the focused view tests and confirm they fail because the current fields accept over-limit values.**
- [ ] **Step 3: Import `vGraphemeMax` and attach it only to policy-managed text inputs and textareas with the matching `INPUT_LIMITS` value. Leave native limits on email, password, and search unchanged.**
- [ ] **Step 4: Update prose view tests so `‘오늘의 건수’ ··· 日本語\t` has no policy error while `설명 😊` remains visible, shows `이모지는 입력할 수 없어요.`, and blocks submit.**
- [ ] **Step 5: Rerun all focused view tests until green.**

### Task 4: Store boundary regression and final verification

**Files:**
- Modify: `src/stores/presentationStore.js` only if its current shared-policy call needs no structural change
- Modify: `src/stores/interviewStore.js` only if its current shared-policy call needs no structural change
- Modify: `tests/stores/stores.test.js`
- Modify: `docs/superpowers/plans/2026-08-07-grapheme-input-policy.md` to mark completed steps

**Interfaces:**
- Consumes: the revised shared prose policy
- Produces: valid non-emoji multilingual payloads and rejected emoji payloads at the API boundary

- [ ] **Step 1: Add failing Store tests proving a slide note with curved quotes, middle dots, Japanese text, and tabs reaches the mocked API, while an emoji slide note or interview description is rejected before the API call.**
- [ ] **Step 2: Run `node node_modules/vitest/vitest.mjs run tests/stores/stores.test.js` and confirm the multilingual case fails under the current ASCII prose pattern.**
- [ ] **Step 3: Rerun after Task 1 and make only the minimal Store change required; payload shapes and trimming behavior stay unchanged.**
- [ ] **Step 4: Run `npm test` and confirm zero failed test files and zero failed tests.**
- [ ] **Step 5: Run `npm run build` and confirm exit code 0.**
- [ ] **Step 6: Run `git diff --check`, inspect the complete scoped diff, and verify unrelated presentation-analysis and layout working-tree changes remain unstaged.**
