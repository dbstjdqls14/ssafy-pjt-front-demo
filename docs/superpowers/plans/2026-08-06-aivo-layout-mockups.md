# AIVO Layout Mockups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one in-conversation visualization containing eight selectable, high-fidelity AIVO desktop layout mockups.

**Architecture:** Create a single self-contained HTML fragment outside the repository. One root-scoped component owns a compact screen selector, eight independent 1440×900 mockup frames, and three layout notes per frame; JavaScript only changes the active frame and ARIA selection state.

**Tech Stack:** Semantic HTML, scoped CSS, vanilla JavaScript, Codex Visualize renderer

## Global Constraints

- Keep the current AIVO white, navy, purple and SUIT-like visual identity.
- Change layout, spacing and typography hierarchy only; do not invent product features or data.
- Use eight independent 1440×900 desktop frames: home, practice type, presentation setup, interviewer style, interview recording, archive, learning trend and presentation report.
- Default to the archive mockup.
- Fit the visualization without horizontal clipping at 736px and stack the selector and notes at 320px.
- Do not modify the frontend application source.

---

### Task 1: Visualization shell and shared AIVO layout primitives

**Files:**
- Create: `C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html`

**Interfaces:**
- Produces: root `#aivo-layout-redesign`, `[data-aivo-screen]` selector buttons, `[data-aivo-mockup]` panels and `selectAivoMockup(screenId)`.
- Consumes: host visualization utility classes for selector buttons only; all depicted product geometry is root-scoped AIVO CSS.

- [ ] **Step 1: Create the HTML fragment shell**

Add the root, eight labeled selector buttons, eight empty mockup panels and an empty three-item notes list associated with each panel. Mark `archive` selected initially with `aria-selected="true"` and `hidden` on the other seven panels.

- [ ] **Step 2: Add shared mockup chrome**

Define the AIVO header, navigation, page canvas, typography hierarchy, surface, divider, button, input and frame-scaling styles under `#aivo-layout-redesign`. Use a fixed internal 1440×900 frame scaled through an `aspect-ratio: 16 / 10` viewport wrapper rather than horizontal scrolling.

- [ ] **Step 3: Add the selector interaction**

Implement `selectAivoMockup(screenId)` so exactly one button has `aria-selected="true"`, exactly one panel is visible, and the selected screen title updates in the compact header.

- [ ] **Step 4: Verify the fragment contract**

Run:

```powershell
rg -n "<!doctype|<html|<head|<body|document.currentScript|fetch\(|XMLHttpRequest|WebSocket" "C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html"
```

Expected: no matches.

### Task 2: Home, practice selection, presentation setup and interviewer style mockups

**Files:**
- Modify: `C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html`

**Interfaces:**
- Consumes: shared `aivo-window`, `aivo-header`, `aivo-page`, `aivo-surface` and `aivo-action` mockup primitives from Task 1.
- Produces: panels `home`, `practice`, `presentation-setup` and `interviewer-style`.

- [ ] **Step 1: Build the home frame**

Show the complete first viewport with a compact right-side section navigator, grouped hero title/copy/CTA and the top of the next product-preview section. Keep all content inside the 1440px canvas.

- [ ] **Step 2: Build the practice type frame**

Add a 32px page heading, one-line description and two 380px-tall selection cards with 40px separation. Within each card order the type label, title, description, two capabilities and a restrained action row.

- [ ] **Step 3: Build the presentation setup frame**

Add a four-step 40px progress row, a centered 760px form, 15–16px labels and fields, compact upload surface, two-column lower settings row and adjacent previous/next actions.

- [ ] **Step 4: Build the interviewer style frame**

Add a five-step progress row, 28px title, three equal persona cards with stable portrait circles, two-line guidance and a maximum three-line example question.

- [ ] **Step 5: Add three notes per frame**

Describe the changed content height, content width and typographic hierarchy without mentioning colors.

### Task 3: Interview recording, archive, learning trend and report mockups

**Files:**
- Modify: `C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html`

**Interfaces:**
- Consumes: shared mockup primitives and selector behavior from Task 1.
- Produces: panels `interview-record`, `archive`, `trend` and `report`.

- [ ] **Step 1: Build the interview recording frame**

Use a 230px question rail, flexible center with at least 760px inside the 1440px frame, and a 270px information rail. Make the 16:9 video and question the dominant center flow.

- [ ] **Step 2: Build the archive frame**

Use a left-aligned 32px title, a single row containing tabs and search, and a 2:1 list/detail split aligned to the same top edge so both are visible in the first viewport.

- [ ] **Step 3: Build the learning trend frame**

Keep six compact key metric cards, one two-column strength/focus section, merge four flow values into one horizontal metric band, then show a compact chart and next-goal row.

- [ ] **Step 4: Build the report frame**

Add a local section navigator, condensed summary, two-column analysis/media region and a readable feedback section where the long slide title appears once.

- [ ] **Step 5: Add three notes per frame**

State the new column proportions, reduced repetition and improved first-viewport visibility.

### Task 4: Render and interaction verification

**Files:**
- Verify: `C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html`
- Create temporarily: `C:/tmp/aivo-layout-redesign-preview.html`

**Interfaces:**
- Consumes: completed visualization fragment.
- Produces: a renderer-validated standalone preview and a verified eight-screen interaction.

- [ ] **Step 1: Check file size and literal fragment integrity**

Run:

```powershell
(Get-Item "C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html").Length
rg -n '\\n|\\"' "C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html"
```

Expected: size below 1,000,000 bytes and no escaped-markup matches.

- [ ] **Step 2: Render the standalone preview**

Run:

```powershell
python "C:/Users/SSAFY/.codex/plugins/cache/openai-bundled/visualize/1.0.19/skills/visualize/scripts/render.py" "C:/Users/SSAFY/.codex/visualizations/2026/08/05/019fd2a5-f863-7610-800a-e60450a4dddf/aivo-layout-redesign-mockups.html" "C:/tmp/aivo-layout-redesign-preview.html"
```

Expected: exit code 0 and the preview file exists.

- [ ] **Step 3: Validate all selectors in a browser**

Open the rendered preview, activate all eight `[data-aivo-screen]` buttons, and verify after every click that one matching `[data-aivo-mockup]` is visible and no console error occurs.

- [ ] **Step 4: Verify responsive CSS coverage**

Confirm the fragment contains breakpoints for `max-width: 736px` and `max-width: 420px`, selector wrapping, proportional frame scaling and stacked notes.

- [ ] **Step 5: Deliver the visualization**

Return the fragment using the conversation visualization reference and state only that the user can switch across the eight proposed pages.
