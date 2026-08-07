# AIVO 프로젝트 컨텍스트

## 1. 프로젝트 정체성

- 프로젝트명: AIVO — 실시간 발표·면접 피드백 AI (계획서 B109)
- 목적: 발표·면접을 녹화하고 말하기 속도·내용 전달·습관어·시선·비언어 표현·질의응답을 분석해 반복 연습하는 웹 서비스
- 현재 성격: **Vue 3 + Vite 단일 페이지 애플리케이션(SPA)**. (초기의 단일 HTML 프로토타입, 이후의 `public/legacy` + `useLegacyView` 목업 래퍼는 모두 제거됨 — 2026-07-24 순수 Vue 이관 완료.)
- 작업 폴더: `C:\Users\SSAFY\Desktop\aivo`

## 2. 현재 기술 구조

- **프론트**: Vue 3(`<script setup>` SFC) + Vite. 상태 관리는 **Pinia**, 라우팅은 **Vue Router**(`createWebHistory`).
- 화면은 `src/views`의 SFC가 렌더링하고, `route.meta.layout`으로 `DefaultLayout`(헤더/스텝/푸터) 또는 `ImmersiveLayout`(홈·녹화)을 선택.
- 녹화·카메라·음성 인식·홈 스크롤 연출과 공통 타이머 수명주기는 `src/composables`에서 관리하고, 슬라이드 상태는 `presentationStore`가 담당.
- 백엔드 통신은 `src/api`(`client.js` fetch 래퍼 + 도메인 API). `withMock`은 네트워크 실패·미구현 endpoint·SPA fallback에만 목을 사용하며 인증·권한·검증 오류는 호출자에게 전달한다.
- 데이터 임시 저장: `localStorage`(사용자 `aivo.user`, 기록 `aivo.session-history.v2`), `sessionStorage`(발표/면접 위저드 드래프트). 키는 `constants/storageKeys.js`, JSON 직렬화·복원은 `utils/storage.js`에서 공통 관리한다.
- 발표 녹화의 시선·자세 분석은 브라우저 MediaPipe, 음량 분석은 Web Audio로 연결됨. 생성형 AI 기반 핵심 내용·질문 생성과 의미 기반 평가, 면접 분석은 아직 목 데이터이며 백엔드 Spring Boot REST·AI FastAPI 연동이 필요함.
- 상세 구조는 `docs/frontend-structure.md`, 배포/연동은 `docs/backend-integration-guide.md`.

## 3. 핵심 사용자 흐름

### 공통
`홈 → 연습 유형 선택 → 연습 폴더 선택·생성`

### 발표
`발표 자료·연습 설정 → 슬라이드 핵심 내용 설정 → 카메라·마이크 확인 → 발표 녹화 → 청중 질문 → 분석 중 → 발표 리포트 → 상세 리포트(아카이브)`

### 면접
`면접 정보 설정 → 지원 자료 등록 → 면접관 스타일 선택 → 질문 관리 → 카메라·마이크 확인 → 면접 녹화 → 분석 중 → 면접 리포트 → 상세 리포트`

## 4. 디자인 기준

- 최종 디자인 출처: Figma `https://www.figma.com/design/V9dBx6Qq439adeqBU2vLiH/Untitled`.
- 저충실도 와이어프레임, `대안`, `HI-FI`, `Version` 등 작업 과정 명칭은 실제 화면·페이지명에서 제외.
- 완성형 화면과 와이어프레임이 함께 있으면 완성형만 구현 기준으로 사용.
- 사용자가 별도 요청하지 않으면 공통 헤더의 구조·기능은 유지.
- 기준 프레임의 좌우 여백과 요소 비율을 유지하고, 임의로 화면을 꽉 채우지 않음.

## 5. 디자인 시스템 (실제 구현 값 = `src/assets/styles/tokens.css`)

초기 계획의 네이비/블루 팔레트에서 **파스텔 라벤더-글래스** 톤으로 진화했으며, 아래가 현재 구현 값입니다.

### 주요 색상 (CSS 변수)
- 주 텍스트: `--aivo-navy #2d3436`, 짙은 잉크 `--aivo-ink #1e1b4b`
- 브랜드 블루: `--aivo-blue #928af7`(라벤더), 강조 `--aivo-blue-strong #4338ca`, 연한 `--aivo-blue-soft #eeecff`
- 배경: `--aivo-canvas #fafafc`, 보조 텍스트 `--aivo-muted #73778f`, 라인 `--aivo-line #edeef7`
- 성공: `--aivo-success #209e66` / `--aivo-success-strong #16a34a`, 위험 `--aivo-danger #ef4444`
- 글래스: `--aivo-glass`, `--aivo-glass-shadow 0 15px 35px rgba(160,150,230,.1)`

### 형태·폭
- 반경: sm 10 / md 12 / lg 18 / xl 20 / pill 999px
- 최대 폭: 공통·아카이브 1440px, 발표 설정 계열 최대 1600px, 모바일 좌우 16~24px 여백
- 그림자는 약하고 넓게, 테두리·배경 차이로 영역 구분. 내부 카드와 붙는 큰 외곽 카드는 제거.

## 6. 채팅에서 확정된 주요 결정

1. 서비스 소개 홈은 파스텔 글래스 대시보드 스타일 + 시네마틱 스크롤.
2. 발표 설정의 목표 시간은 고정 카드가 아니라 증감 가능한 시간 설정 UI.
3. 면접 설정에 회사명·직군·직무 선택 항목 필요(사전 등록 선택형 데이터 전제).
4. 면접관 스타일 화면은 면접관 3명 + 질문 카드 목록, 좌우 버튼·가로 스크롤.
5. 면접관/질문 카드에 불필요한 큰 외곽 카드를 중첩하지 않음.
6. 페이지 이름은 사용자 용어 사용(`[발표] 청중 질문`, `[면접] 면접 녹화` 등), `HI-FI`·`대안` 등 설계 과정 용어 제거.
7. 아카이브는 필터 사이드바 + 연습 카드/폴더 그리드. 폴더 상세는 요약 지표·시도 기록·성장 추이. 리포트도 동일한 최대 폭·여백 원칙.
8. 홈·녹화 화면을 제외한 공통 헤더는 단색 79px 헤더 기준(별도 축소형 헤더 없음).

## 7. 주요 화면

홈·대시보드 / 연습 유형 선택 / 연습 폴더 선택·생성 / 발표(자료·설정, 슬라이드 핵심, 장치 확인, 설정 확인, 녹화, 청중 질문, 분석 중, 리포트, 상세 리포트) / 면접(정보 설정, 지원 자료, 면접관 스타일, 질문 관리, 장치 확인, 녹화, 분석 중, 리포트, 상세 리포트) / 전체 기록·폴더 상세 / 마이페이지(내 정보·자소서/포트폴리오·비밀번호 변경·학습 추이) / FAQ.

## 8. 구현 시 주의사항

- 기존 기능·화면 전환을 삭제하거나 무력화한 뒤 디자인만 맞추지 않음. 업로드·녹화·저장·리포트 연결을 유지.
- 사용자/커밋되지 않은 변경사항을 임의로 되돌리지 않음. `git reset --hard`·강제 체크아웃 등 파괴적 명령 금지.
- 불필요한 파일 제거 시 실제 미사용·사용자 파일 여부를 먼저 확인.
- 수정 후 `npm test`(Vitest), `npm run build`로 검증. 가능하면 dev 서버로 1920×1080·모바일 화면 확인.
- **주의(재발 방지)**: App.vue에 `<Transition mode="out-in">`를 다시 넣지 말 것(라우트 스왑 멈춤). 가로 스크롤 클립은 `html{overflow-x:hidden}`에만(body에 주면 body가 스크롤러가 돼 홈 모션 엔진이 깨짐).

## 9. 관련 문서

- `docs/frontend-structure.md`: 프론트 폴더 구조·규칙
- `docs/frontend-specification.md`: 화면·기능·상태 저장별 프론트 구현 현황과 완료 체크리스트
- `docs/backend-integration-guide.md`: 배포 라우팅·API 연동·목→백엔드 전환
- `docs/api-specification.md`: endpoint 계약, 호출 현황, 프론트·백엔드 구현 체크리스트
- `docs/FUNCTION_SPEC_SIMPLE.md`: 전체 서비스 간단 기능 명세
- `docs/PRESENTATION_PAGE_FEATURES.md`: 발표 기능 상세 명세
- `AGENTS.md`: 이 저장소의 에이전트 작업 규칙

## 10. 현재 작업 상태

- 기본 진입 화면은 홈.
- **전 화면이 순수 Vue SFC로 이관 완료.** 레거시 목업 래퍼·`public/legacy`·`useLegacyView`는 제거됨.
- Pinia 스토어, 클린 라우터, 레이아웃/공통 컴포넌트, 컴포저블, `withMock` API 폴백, Vitest 테스트(라우트·스토어·컴포넌트·뷰) 기반.
- 다음 단계: 실제 백엔드(Spring Boot) API 연동(`src/api/*Api.js` 계약 확정 → `withMock` 자연 대체), 필요 시 E2E·반응형·접근성 패스.
