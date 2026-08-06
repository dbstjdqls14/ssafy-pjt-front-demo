# Frontend Image Asset Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce oversized frontend raster image transfer and decode costs without changing visible layout, public social metadata URLs, or high-DPI sharpness.

**Architecture:** Keep all currently used URLs and imports stable, resize raster sources in place with Pillow's high-quality Lanczos filter, and delete only proven obsolete duplicates. Add a Node-side Vitest asset contract that reads PNG/JPEG headers directly so future oversized replacements fail CI without adding a runtime dependency.

**Tech Stack:** Vue 3, Vite, Vitest, Node `fs`, bundled Python 3 + Pillow 12.2.0

## Global Constraints

- Interviewer JPG files must be exactly `384×384` and remain at `/interviewers/1.jpg`, `/interviewers/2.jpg`, and `/interviewers/3.jpg`.
- Practice interview and presentation illustrations must remain PNGs with transparency preserved and fit within `600×413` and `456×516` respectively.
- `/home-presenter.png` must remain a valid public PNG used by OG/Twitter metadata and be exactly `1200×675`.
- `public/interviewers/*.png` and the identical unreferenced `src/assets/images/home-interview-persona.png` must not remain in the build source.
- Profile images, logos, slide assets, layout, CSS dimensions, routes, and backend contracts are out of scope.

---

### Task 1: Add the image asset contract and optimize sources

**Files:**
- Create: `frontend-vue-main/tests/architecture/imageAssets.test.js`
- Modify: `frontend-vue-main/public/interviewers/1.jpg`
- Modify: `frontend-vue-main/public/interviewers/2.jpg`
- Modify: `frontend-vue-main/public/interviewers/3.jpg`
- Modify: `frontend-vue-main/public/interviewers/README.md`
- Modify: `frontend-vue-main/public/home-presenter.png`
- Modify: `frontend-vue-main/src/assets/images/practice-interview-illustration.png`
- Modify: `frontend-vue-main/src/assets/images/practice-presentation-illustration.png`
- Delete: `frontend-vue-main/public/interviewers/1.png`
- Delete: `frontend-vue-main/public/interviewers/2.png`
- Delete: `frontend-vue-main/public/interviewers/3.png`
- Delete: `frontend-vue-main/src/assets/images/home-interview-persona.png`

**Interfaces:**
- Consumes: Existing image URLs and imports from `InterviewStyleView.vue`, `PracticeTypeView.vue`, `HomeView.vue`, and `index.html`.
- Produces: The same URLs/imports backed by smaller valid raster files and a CI contract for their dimensions.

- [ ] **Step 1: Write the failing asset contract test**

Create a Vitest test that reads PNG IHDR dimensions and walks JPEG markers to read SOF dimensions. Assert the exact target dimensions, assert that the four obsolete files are absent, and assert that `index.html` still points at `https://aivo.ai.kr/home-presenter.png`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/architecture/imageAssets.test.js`

Expected: FAIL because the existing images exceed their target dimensions and obsolete duplicates still exist.

- [ ] **Step 3: Resize images with the bundled Pillow runtime**

Use `Image.Resampling.LANCZOS`, preserve RGB for JPEG and RGBA/transparency for PNG, write through temporary files in the same directory, then atomically replace the originals. Save JPG at quality 88 with optimization and progressive encoding; save PNG with optimization.

- [ ] **Step 4: Remove proven duplicates and update the interviewer README**

Delete the three obsolete public PNGs and exact duplicate home persona asset. Update README references from PNG/512px to JPG/384px so the documented public contract matches the application.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- tests/architecture/imageAssets.test.js`

Expected: PASS with all target dimensions, public metadata path, and stale-file assertions satisfied.

- [ ] **Step 6: Commit the self-contained asset change**

```powershell
git add frontend-vue-main/tests/architecture/imageAssets.test.js frontend-vue-main/public frontend-vue-main/src/assets/images
git commit -m "perf: optimize frontend image assets"
```

### Task 2: Verify production and rendered behavior

**Files:**
- Verify: `frontend-vue-main/dist`
- Verify: `/interview/style`, `/practice`, `/`

**Interfaces:**
- Consumes: Optimized sources from Task 1.
- Produces: Build and browser evidence that URLs, rendering, and interactions are unchanged.

- [ ] **Step 1: Run the complete automated checks**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: exit code 0; `dist/interviewers` contains JPG files and no obsolete PNG files.

- [ ] **Step 3: Validate the desktop target flow in Browser**

The flow under test is: `/interview/style` loads → select another interviewer → the selected ring changes while all three circular portraits stay sharp and correctly cropped.

Check page identity, meaningful DOM, framework overlay absence, console warnings/errors, screenshot evidence, and the selection interaction at the existing desktop viewport.

- [ ] **Step 4: Validate related screens in Browser**

Open `/practice` and `/`, confirm both practice illustrations and the home poster render without clipping or missing-image indicators, and inspect console warnings/errors.

- [ ] **Step 5: Inspect the final diff and asset totals**

Run `git status --short`, `git diff HEAD~1 --stat`, and list source/build image sizes. Confirm that no Vue/CSS/backend contract changed and report the exact byte reduction.
