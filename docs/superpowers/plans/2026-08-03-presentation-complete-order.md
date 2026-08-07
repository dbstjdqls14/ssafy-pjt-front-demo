# Presentation Complete Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send presentation complete exactly once, after Q&A when Q&A is enabled and immediately after recording when it is disabled.

**Architecture:** Keep recording artifacts in the presentation store. The analyzing view decides whether to generate questions or complete the presentation based on `qnaEnabled` and the route phase; the store coalesces concurrent complete calls and ignores calls after completion.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest

## Global Constraints

- Q&A OFF: recording end → complete → report polling.
- Q&A ON: recording end → question generation → per-question answer POST → final end → complete → report polling.
- Do not change the multipart complete payload contract.

---

### Task 1: Lock the route flow with tests

**Files:**
- Modify: `tests/views/PresentationAnalyzingView.test.js`
- Modify: `tests/stores/springPresentationFlow.test.js`

- [ ] Change the Q&A-entry test to require question generation before any complete call.
- [ ] Add a report-phase test requiring one complete call before report polling.
- [ ] Add a store test proving concurrent and post-completion calls produce one API request.
- [ ] Run both test files and confirm they fail for the old ordering or missing deduplication.

### Task 2: Implement ordering and deduplication

**Files:**
- Modify: `src/views/presentation/PresentationAnalyzingView.vue`
- Modify: `src/stores/presentationStore.js`

- [ ] Move the initial Q&A branch before `completeSession()`.
- [ ] Keep `phase=report` on the complete-and-poll path.
- [ ] Reuse an in-flight complete Promise and return early after `sessionStatus === 'completed'`.
- [ ] Run targeted tests, the full test suite, and the production build.
