# 추임새 용어 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자에게 노출되는 한국어 `필러`, `필러워드`, `필러어`를 `추임새`로 통일한다.

**Architecture:** 분석 데이터와 API의 영문 `filler` 계약은 유지한다. 프런트 렌더링 문구와 Spring/FastAPI가 생성하는 한국어 라벨·메시지만 변경하며, 소스 검색 계약 테스트로 기존 용어 재유입을 방지한다.

**Tech Stack:** Vue 3, Vite, Vitest, Spring Boot/Java, FastAPI/Python/pytest

## Global Constraints

- `filler`, `fillerCount`, `fillerEvents`, `FILLER`와 CSS 클래스 등 내부 계약은 변경하지 않는다.
- 사용자에게 보이는 단독 지표명은 `추임새`, 추이 지표는 `추임새 밀도`를 사용한다.
- 스키마 변경과 데이터 마이그레이션은 하지 않는다.

---

### Task 1: 프런트 용어 계약과 화면 문구

**Files:**
- Modify: `frontend-vue-main/tests/api/trendsNormalizer.test.js`
- Modify: `frontend-vue-main/tests/components/presentation-report/PresentationReportSummary.test.js`
- Modify: `frontend-vue-main/tests/components/presentation-report/PresentationReportAnalysis.test.js`
- Modify: `frontend-vue-main/tests/views/InterviewReportDetailView.test.js`
- Modify: `frontend-vue-main/tests/views/PresentationRecordRailMetrics.test.js`
- Modify: `frontend-vue-main/tests/views/HomePreview.test.js`
- Modify: `frontend-vue-main/src/components/presentation-report/PresentationReportAnalysis.vue`
- Modify: `frontend-vue-main/src/components/presentation-report/PresentationReportSummary.vue`
- Modify: `frontend-vue-main/src/views/interview/InterviewReportDetailView.vue`
- Modify: `frontend-vue-main/src/views/interview/InterviewRecordView.vue`
- Modify: `frontend-vue-main/src/views/presentation/PresentationRecordView.vue`
- Modify: `frontend-vue-main/src/views/HomeView.vue`
- Modify: `frontend-vue-main/src/api/normalizers/trends.js`
- Modify: `frontend-vue-main/src/mocks/archive.js`
- Modify: `frontend-vue-main/src/mocks/presentation.js`
- Modify: `frontend-vue-main/src/composables/useVoicePaceGraph.js`
- Modify: `frontend-vue-main/src/composables/useGestureGraph.js`
- Modify: `frontend-vue-main/src/assets/styles/views/interview-report.css`
- Modify: `frontend-vue-main/tests/utils/interviewReportScores.test.js`

**Interfaces:**
- Consumes: 기존 `filler*` API 필드와 그래프 데이터
- Produces: 동일 데이터 구조를 사용하는 `추임새` 화면 문구

- [ ] **Step 1: 실제 정규화 결과와 렌더링 문구를 검증하는 실패 테스트 작성**

```js
expect(normalizePracticeTrends(payload).metrics.find(({ key }) => key === 'filler')?.label).toBe('추임새 밀도')
expect(wrapper.get('.iv-pace-chip.is-filler').text()).toContain('추임새')
expect(wrapper.text()).not.toContain('필러')
```

- [ ] **Step 2: 테스트가 현재 `필러` 문구 때문에 실패하는지 확인**

Run: `npm test -- tests/api/trendsNormalizer.test.js tests/components/presentation-report/PresentationReportSummary.test.js tests/components/presentation-report/PresentationReportAnalysis.test.js tests/views/InterviewReportDetailView.test.js tests/views/PresentationRecordRailMetrics.test.js tests/views/HomePreview.test.js`
Expected: FAIL, 실제 화면과 정규화 결과가 기존 용어를 출력

- [ ] **Step 3: 프런트 표시 문구와 한국어 주석을 `추임새`로 변경**

프런트의 표시 조건도 `rowLabel === '추임새'`로 함께 변경하되 영문 프로퍼티와 클래스는 유지한다.

- [ ] **Step 4: 용어 계약 테스트와 관련 리포트 테스트 실행**

Run: `npm test -- tests/api/trendsNormalizer.test.js tests/components/presentation-report/PresentationReportSummary.test.js tests/components/presentation-report/PresentationReportAnalysis.test.js tests/views/InterviewReportDetailView.test.js tests/views/PresentationRecordRailMetrics.test.js tests/views/HomePreview.test.js tests/utils/interviewReportScores.test.js`
Expected: PASS

### Task 2: 백엔드 사용자 메시지와 모델 문맥

**Files:**
- Create: `backend-fastapi-main/tests/test_filler_feedback.py`
- Modify: `backend-fastapi-main/app/domains/audio_analysis/filler_model.py`
- Modify: `backend-fastapi-main/models/filer/src/presentation_coaching_transcription.py`
- Modify: `backend-fastapi-main/tests/test_audio_analysis_api.py`
- Modify: `backend-spring-develop/src/main/java/com/ssafy/b109/aivo/interview/service/InterviewReportService.java`
- Modify: `backend-spring-develop/src/main/resources/static/interview-score-rule.md`
- Modify: `backend-spring-develop/src/main/resources/static/presentation-score-rule.md`

**Interfaces:**
- Consumes: 기존 `fillerCount`와 `filler` 세그먼트 종류
- Produces: `추임새` 한국어 라벨과 감지 피드백

- [ ] **Step 1: FastAPI 피드백의 사용자 출력값을 검증하는 테스트 추가**

```python
def test_feedback_uses_interjection_terminology():
    assert _feedback(3, 0, 0) == "추임새가 3회 감지되었습니다."
```

- [ ] **Step 2: 모델 단위 테스트가 기존 메시지 때문에 실패하는지 확인**

Run: `pytest tests/test_filler_feedback.py -q`
Expected: FAIL, 실제 메시지에 `필러`가 포함됨

- [ ] **Step 3: 서버가 생성하는 한국어 라벨·메시지·분석 설명 변경**

내부 메서드명과 JSON 키는 유지하고 문자열 리터럴만 `추임새`로 변경한다.

- [ ] **Step 4: FastAPI 관련 테스트 실행**

Run: `pytest tests/test_filler_feedback.py tests/test_audio_analysis_api.py -q`
Expected: PASS

### Task 3: 전체 회귀 검증과 문서 정합성

**Files:**
- Modify: 현재 기능을 설명하는 `docs/**/*.md`의 한국어 용어

**Interfaces:**
- Consumes: Task 1~2의 변경 결과
- Produces: 코드와 문서가 같은 사용자 용어를 사용하는 검증 결과

- [ ] **Step 1: 현재 기능 문서와 코드 주석의 한국어 용어 변경**

과거 용어 자체를 설명해야 하는 이번 설계 문서만 검색 예외로 두고 나머지는 `추임새`로 통일한다.

- [ ] **Step 2: 프런트 전체 테스트 실행**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 프런트 프로덕션 빌드 실행**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 저장소 전체 잔여 표현 확인**

Run: `rg -n "필러|필러워드|필러어" . --glob "!docs/superpowers/specs/2026-08-06-interjection-terminology-design.md" --glob "!docs/superpowers/plans/2026-08-06-interjection-terminology.md" --glob "!**/node_modules/**" --glob "!**/dist/**" --glob "!**/.git/**"`
Expected: 사용자 노출 코드, 서버 메시지와 현재 기능 문서에서 결과 없음
