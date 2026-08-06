# AIVO 프론트엔드 폴더 구조

Vue 3 + Vite SPA. 모든 화면은 `src/views`의 **순수 Vue SFC**이며, 상태는 Pinia, 화면 전환은 Vue Router가 담당합니다. (과거의 `public/legacy` + `useLegacyView` 목업 래퍼 구조는 2026-07-24 이관 완료로 전부 제거됨.)

```text
src/
├─ main.js                 # createApp + Pinia + Router, 전역 스타일 import
├─ App.vue                 # route.meta.layout으로 레이아웃 선택 + <RouterView>
├─ router/
│  ├─ index.js             # createRouter 생성과 가드 설치
│  ├─ guards.js            # 인증 가드 + title/bodyClass 동기화
│  ├─ routes.js            # 도메인 라우트 모듈을 조합하는 단일 진입점
│  └─ modules/             # common/auth/practice/presentation/interview/archive/mypage
├─ layouts/
│  ├─ DefaultLayout.vue    # AppHeader + StepProgress + AppFooter
│  ├─ ImmersiveLayout.vue  # 풀블리드 (home, 녹화 화면)
│  └─ MyPageLayout.vue     # 마이페이지 하위 라우트 공통 내비게이션
├─ components/
│  ├─ common/              # AppHeader, AppFooter, StepProgress
│  └─ mypage/              # MyPageNav
├─ composables/            # useMediaDevices, useRecorder, useSpeechRecognition,
│                          # useHomeMotion, 실시간 발표 분석
├─ services/               # MediaPipe Face/Pose 모델 로딩·프레임 분석
├─ stores/                 # Pinia: auth, practice, presentation, interview,
│                          # recording, archive, documents
├─ api/                    # HTTP client + 도메인 API + mock/response/query/form-data helpers
│  ├─ normalizers/        # 백엔드 DTO(인증·기록·폴더·문서·질문·슬라이드)를 화면·Store 모델로 변환
│  └─ payloads/           # 발표·면접 Store 상태를 백엔드 세션 요청 DTO로 변환
├─ mocks/                  # API 미연동 시 사용하는 도메인별 fallback fixture
├─ constants/              # 저장소 키 등 여러 도메인이 공유하는 불변 계약
├─ utils/                  # 파일 변환, 검증, 로컬 ID, JSON storage 등 상태를 갖지 않는 순수 유틸리티
├─ assets/
│  ├─ images/              # 로고, 일러스트, 소셜 아이콘 (SFC에서 import)
│  └─ styles/
│     ├─ tokens.css        # 디자인 토큰(CSS 변수)
│     ├─ base.css          # 리셋 + 스크롤 셸
│     ├─ global/           # 공통 셸·전환·워크플로 제어 스타일
│     └─ views/            # 화면별 스타일(bodyClass로 범위 제한)
└─ views/                  # 라우터에 1:1 대응되는 완성 화면
   ├─ HomeView.vue  FaqView.vue
   ├─ auth/  practice/  presentation/  interview/  archive/  mypage/
```

## 핵심 규칙

1. **views** = 라우트 1:1 완성 화면. `<script setup>` + 반응형 상태. 목업 인라인 스크립트 없음.
2. **components** = 여러 화면에서 재사용하거나 화면 내부에서 분리한 UI 조각.
3. **stores**(Pinia) = 로그인 사용자·연습 세션·녹화 상태·기록 등 공유 상태. `defineStore`.
4. **composables** = 카메라/마이크(`useMediaDevices`), 녹화(`useRecorder`), 음성 인식(`useSpeechRecognition`), 검색 지연 호출(`useDebouncedCallback`), 점수 카운트업(`useCountUp`), 홈 스크롤 연출(`useHomeMotion`), 발표 시선·자세·음량(`useRealtimePresentationAnalysis`). 슬라이드 상태와 이동은 `presentationStore`가 관리.
5. **api** = 백엔드 endpoint 통신 함수. 연습 폴더와 면접 카탈로그·질문 생성/관리는 실제 API만 사용한다. 그 외 미연동 기능의 `withMock(request, mock)`은 네트워크 실패·미구현 endpoint·SPA fallback에만 목을 사용하고, 인증·권한·검증 오류는 호출자에게 그대로 전달한다. HTTP 응답 envelope은 `response.js`, 서버 숫자 ID 검증은 `serverId.js`, 선택 쿼리는 `query.js`, 파일·녹화 payload는 `formData.js`에서 공통 처리한다.
6. **mocks** = `withMock`의 fallback fixture. Store에는 목 목록을 직접 선언하지 않고 상태·정규화·API 흐름만 유지.
7. **디자인** = `assets/styles/tokens.css`의 CSS 변수 + `assets/styles/global/*`(공통 크롬)·`assets/styles/views/*`(화면별 CSS, body 클래스로 스코프). 룩은 파스텔 라벤더-글래스.
8. **constants** = local/session storage 키처럼 여러 store가 함께 쓰는 계약. 문자열을 각 store에 중복 선언하지 않음.
9. **storage utility** = Store의 JSON 저장·복원과 최초 방문 튜토리얼 boolean flag는 `utils/storage.js`를 사용한다. 손상되거나 사용할 수 없는 저장소는 기존 초기값으로 폴백한다.

## 라우팅

- `src/router/modules/*Routes.js`가 도메인별 경로/이름/컴포넌트(lazy `() => import()`)/`meta`를 소유합니다.
- `src/router/routes.js`는 도메인 모듈을 순서대로 조합하는 단일 라우트 진입점입니다.
- `meta`: `layout`('default'|'immersive'), `bodyClass`(CSS 스코프), `area`(헤더 활성), `title`, `requiresAuth`, `flow`('presentation'|'interview').
- `guards.js`: `beforeEach`에서 `requiresAuth` 가드, `afterEach`에서 `document.title`·`document.body.className` 세팅.
- `index.js`: 라우터 생성과 스크롤 정책을 정의한 뒤 `guards.js`를 설치합니다.
- `App.vue`는 `route.meta.layout === 'immersive' ? ImmersiveLayout : DefaultLayout`으로 레이아웃을 고릅니다.

## 백엔드 연동 시 작업 위치

| 기능 | 파일 |
|---|---|
| 로그인/회원가입 | `src/api/authApi.js`, `src/stores/authStore.js` |
| 연습 폴더 | `src/api/practiceApi.js`, `src/stores/practiceStore.js` |
| 발표 세션 | `src/api/presentationApi.js`, `src/stores/presentationStore.js` |
| 면접 세션 | `src/api/interviewApi.js`, `src/stores/interviewStore.js` |
| 기록/리포트 | `src/api/archiveApi.js`, `src/stores/archiveStore.js` |
| 녹화/카메라 | `src/composables/useMediaDevices.js`, `useRecorder.js` |

연습 폴더와 면접 설정·질문 흐름은 `withMock`을 거치지 않습니다. 실제 API 장애를 화면에 표시하며, 로컬 목 ID가 실제 Spring `Long` 필드로 전송되지 않도록 요청 전에 검증합니다. 아직 백엔드 미연동인 나머지 기능만 제한적으로 목 폴백을 사용합니다.

## 검증

- `npm test` — Vitest(jsdom): 라우트·스토어·컴포넌트·뷰 테스트.
- `npm run build` — 프로덕션 빌드(뷰별 코드 스플리팅).
- `npm run dev` — Vite dev 서버(127.0.0.1).

상세 구현 상태는 `docs/frontend-specification.md`, endpoint별 연동 상태는 `docs/api-specification.md`를 기준으로 확인합니다.
