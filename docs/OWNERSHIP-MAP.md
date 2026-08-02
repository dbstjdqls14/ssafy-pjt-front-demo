# 면접 · 발표 작업 영역 가이드 (소유권 지도)

> **목적:** 면접·발표를 나눠 작업할 때 팀원 간 코드 충돌을 막기 위한 규칙.
> 완전 분리(코드 복제)는 하지 않는다 — 녹화·분석 엔진은 면접·발표가 똑같이 쓰는
> 코드라 공유가 정상이다. 대신 **"어느 파일이 누구 소유인지"** 를 명확히 하고,
> 공유 파일을 건드릴 땐 서로 알린다.
>
> 이 문서는 코드 감사(actual import 스캔) 결과로 작성됨. 파일 추가 시 갱신할 것.

---

## 🚦 3-존 규칙

| 존 | 의미 | 작업 방식 |
|----|------|-----------|
| 🟢 **면접 전용** | 면접만 사용 | 면접 담당이 **자유롭게 수정** |
| 🔵 **발표 전용** | 발표만 사용 | 발표 담당이 **자유롭게 수정** |
| 🔴 **공유** | 면접·발표 둘 다 사용 | **수정 전 상대에게 한마디** 후 진행 |

**빠른 판단법:** 파일/클래스 이름에
- `interview` → 🟢 면접 · `presentation` → 🔵 발표
- `record` / `media` / `recording` / `common` / `practice` → 🔴 공유 (조심)

---

## 🟢 면접 전용 (면접 담당 자유 수정)

```
src/views/interview/**                     ← 면접 화면 전부
src/stores/interviewStore.js               ← 면접 상태
src/utils/interviewTimeline.js
src/utils/interviewReportScores.js
src/utils/interviewAudioAnalysis.js
src/composables/useVoicePaceGraph.js       ← 면접 음성 그래프
src/composables/useGestureGraph.js         ← 면접 몸짓 그래프
src/composables/useCountUp.js
src/components/interview/**                 ← SearchableSelect 등
src/assets/styles/views/interview-flow.css
src/assets/styles/views/interview-record.css
src/assets/styles/views/interview-report.css
src/assets/styles/views/interview-analyzing.css
src/api/interviewApi.js
```

## 🔵 발표 전용 (발표 담당 자유 수정)

```
src/views/presentation/**
src/stores/presentationStore.js
src/utils/presentationFiles.js
src/utils/presentationArtifacts.js
src/composables/useSpeechRecognition.js
src/composables/useRealtimePresentationAnalysis.js
src/services/presentationVisionService.js
src/assets/styles/views/presentation-*.css   (flow, record, ready, check, slides, setup, qna, outcome)
src/api/presentationApi.js
```

## 🔴 공유 — 수정 전 상대에게 알릴 것 ⚠️

```
# 녹화·분석 엔진 (면접·발표 공용)
src/composables/useRecorder.js
src/composables/useMediaDevices.js
src/composables/useFaceAnalysis.js
src/composables/useMicLevel.js
src/services/pcmWavCapture.js

# 상태·유틸
src/stores/recordingStore.js
src/stores/practiceStore.js
src/stores/authStore.js
src/utils/storage.js
src/utils/id.js

# 공통 컴포넌트
src/components/common/CameraZoomControl.vue

# 공유 CSS (아래 '숨은 결합' 참고)
src/assets/styles/views/practice-flow.css
src/assets/styles/app-shell.css
src/assets/styles/global/**
```

---

## ⚠️ 숨은 결합 (반드시 인지)

면접 라우트가 **발표 CSS 클래스를 재사용**한다 (`src/router/modules/interviewRoutes.js`의 `bodyClass`):

| 면접 라우트가 쓰는 클래스 | 실제 정의 위치 | 영향 |
|--------------------------|----------------|------|
| `presentation-flow-page` (3개 라우트) | `presentation-flow.css` | 면접 setup/style/questions 페이지가 발표 CSS를 로드 |
| `presentation-analyzing-page` | 발표 분석 CSS | 면접 분석 화면 공유 |
| `presentation-result-page` | 발표 결과 CSS | 면접 결과 화면 공유 |

➡️ **`presentation-flow.css`를 수정하면 면접 플로우 화면도 바뀐다.** 발표 담당이 이
파일을 고칠 땐 면접 화면 확인 필요. (반대로 면접이 이 클래스에 의존 중이므로,
지금 억지로 떼면 CSS 복제가 되어 유지보수가 늘어난다 → 현행 유지 권장.)

---

## 🛠️ 작업 워크플로우

```
1. 작업 전:   git pull                    # 팀원 최신 변경 받기
2. 작업:      🟢/🔵 전용이면 그냥 수정
              🔴 공유면 → 상대에게 "이 파일 손댈게" 알린 뒤 수정
3. 작업 후:   git add → git commit → git push
```

- 각자 **자기 브랜치**에서 작업하고 자주 pull/merge 하면 충돌이 작게 자주 → 쉽게 해결됨.
- 한 커밋에 🟢 전용 + 🔴 공유 변경을 **섞지 말 것** (섞이면 리뷰·충돌 해결이 어려움).

---

_최종 갱신: 코드 감사 기반 자동 분류. 새 파일/화면 추가 시 이 표에 반영._
