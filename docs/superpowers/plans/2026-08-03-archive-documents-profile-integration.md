# Archive, Documents, and Profile API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unsupported archive mocks with supported Spring presentation APIs, make support-document loading resilient, and connect nickname/profile-image editing to the Spring multipart contract.

**Architecture:** Keep the existing Vue views, Pinia stores, and API client boundaries. Add Spring contract methods and normalizers at the API edge, keep presentation archive state separate from the protected interview report state, and make the existing profile-image surface an accessible file picker without introducing shared report components.

**Tech Stack:** Vue 3, Pinia, Vue Router, Fetch/FormData, Vitest, Vue Test Utils, Spring REST contracts.

## Global Constraints

- Modify only `frontend-vue-main`; do not modify Spring, FastAPI, or database code.
- Do not modify interview report detail, interview recording, or interview analysis production files.
- Preserve existing uncommitted practice-trend changes.
- Do not fabricate scores, attempts, dates, durations, or domain identifiers.
- Profile images accept JPEG, PNG, or WebP up to 5 MiB.
- Run each behavior through a red-green TDD cycle before production changes.

---

### Task 1: Profile multipart API contract

**Files:**
- Modify: `src/api/userApi.js`
- Create: `tests/api/userProfileApi.test.js`

**Interfaces:**
- Consumes: `{ nickname, removeProfileImage, profileImage }`
- Produces: `PATCH /users/me` with FormData parts `request` and optional `profileImage`

- [ ] Write a failing API test asserting that `request` is an `application/json` Blob containing `nickname` and `removeProfileImage`.
- [ ] Write a failing API test asserting that `profileImage` is omitted when null and included with its filename when provided.
- [ ] Run the test and verify it fails because `userApi.updateProfile` sends JSON.
- [ ] Implement the minimal FormData builder in `userApi.js` without altering the existing practice-trends change.
- [ ] Run the API test and verify it passes.

### Task 2: Profile image edit UI and Google mock removal

**Files:**
- Modify: `src/views/mypage/MyPageView.vue`
- Modify: `src/assets/styles/views/mypage-refresh.css`
- Create: `tests/views/MyPageView.test.js`

**Interfaces:**
- Consumes: `auth.user.profileImageUrl`, `auth.updateProfile(payload)`
- Produces: validated image selection, local preview, image removal, and saved multipart payload

- [ ] Write a failing view test proving the Google account blocks are absent.
- [ ] Write a failing view test proving the existing image-change surface opens a JPEG/PNG/WebP file input and previews a valid image.
- [ ] Write failing tests for invalid MIME type, files larger than 5 MiB, cancel restoration, and default-image removal.
- [ ] Write a failing save test asserting `{ nickname, profileImage, removeProfileImage }` is passed to the auth store.
- [ ] Run the view test and verify failures are caused by the missing behavior.
- [ ] Implement preview URL lifecycle, validation, reset, cancel, and save behavior in `MyPageView.vue`.
- [ ] Replace initial-only avatars with `profileImageUrl`/preview images when present.
- [ ] Remove both Google-linked UI blocks and add narrowly scoped profile image styles.
- [ ] Run the view tests and verify they pass.

### Task 3: Support-document partial success

**Files:**
- Modify: `src/stores/documentsStore.js`
- Modify: `src/views/mypage/MyPageDocumentsView.vue` only if separate error copy is required
- Modify: `tests/stores/stores.test.js`
- Create: `tests/api/supportDocumentsApi.test.js`

**Interfaces:**
- Consumes: independent resume and portfolio list responses
- Produces: all successful documents plus an error describing only failed categories

- [ ] Write failing API tests for resume/portfolio list, detail, and multipart upload paths and fields.
- [ ] Write a failing store test where resume loading fails and portfolio loading succeeds.
- [ ] Write a failing store test where portfolio loading fails and resume loading succeeds.
- [ ] Verify the tests fail because `Promise.all` rejects and discards the successful result.
- [ ] Replace the combined request with independent settled results while preserving successful data.
- [ ] Throw only when both list calls fail; expose a partial-error message when one fails.
- [ ] Run document API, store, list-view, and detail-view tests.

### Task 4: Presentation archive API boundary

**Files:**
- Modify: `src/api/archiveApi.js`
- Modify: `src/api/normalizers/practice.js`
- Modify: `src/stores/archiveStore.js`
- Create: `tests/api/archivePracticeApi.test.js`
- Modify: `tests/stores/stores.test.js`

**Interfaces:**
- Consumes: Spring folder and presentation-practice DTOs
- Produces: normalized folders and attempts with nullable score fields

- [ ] Write failing API tests for folder list, folder detail, and `/practice-folders/{folderId}/presentation-practices`.
- [ ] Write failing normalizer tests proving IDs, duration, date, and nullable scores are preserved without fabrication.
- [ ] Write a failing store test proving archive loading no longer calls `/reports` and stores real folder IDs.
- [ ] Implement API methods and presentation-practice normalizer.
- [ ] Add archive store state/actions for real folders, selected folder, and presentation practices while preserving the legacy `find()` state used by protected interview report code.
- [ ] Run the focused API/normalizer/store tests.

### Task 5: Real archive folder list and presentation detail UI

**Files:**
- Modify: `src/views/archive/ArchiveView.vue`
- Modify: `src/views/archive/FolderDetailView.vue`
- Modify: `tests/views/FolderDetailView.test.js`
- Create or modify: `tests/views/ArchiveView.test.js`

**Interfaces:**
- Consumes: normalized real folders and presentation practices from `archiveStore`
- Produces: folder-ID routing, real presentation attempts, explicit unavailable score states

- [ ] Write a failing archive view test asserting folder cards are keyed/routed by `folderId` and do not display fabricated best/latest scores.
- [ ] Write a failing folder-detail test asserting a presentation folder loads its actual presentation practices.
- [ ] Write a failing test asserting one real practice remains one rendered practice and no seven-point history appears.
- [ ] Write a failing test asserting missing scores render an unavailable state rather than `0점`.
- [ ] Run the tests and verify the expected failures.
- [ ] Update `ArchiveView` to load actual folders and route with `/archive/folders/{folderId}?type={type}`.
- [ ] Update `FolderDetailView` to load folder detail and presentation practices and remove synthetic records and score offsets.
- [ ] Keep interview detail routing code unchanged and render a clear unavailable state when interview practices cannot be listed.
- [ ] Run archive view tests and router tests.

### Task 6: Regression and browser verification

**Files:**
- No new production files

**Interfaces:**
- Consumes: completed implementation
- Produces: verified frontend build with protected interview code unchanged

- [ ] Run all Vitest tests.
- [ ] Run `pnpm run build`.
- [ ] Compare protected interview report production files to commit `520e2326f3de3ab742e9141fa0cbcac97afe1820` and require zero diff.
- [ ] Check the final diff for unrelated practice-trend changes and ensure they were neither overwritten nor staged.
- [ ] Open `/mypage`, `/mypage/documents`, `/archive`, and a presentation folder in the local browser.
- [ ] Verify profile image selection/removal, Google mock absence, document partial states, folder navigation, and console errors.
- [ ] Report successful checks separately from backend-dependent checks that could not be exercised.
