# AIVO 작업 지침

이 저장소를 수정하는 모든 에이전트 작업은 다음 지침을 따른다. 이 프로젝트는 **Vue 3 + Vite SPA**다(Pinia + Vue Router). 과거의 단일 HTML 프로토타입과 `public/legacy`/`useLegacyView` 목업 래퍼는 제거됐다.

## 작업 시작 전

1. 먼저 `PROJECT_CONTEXT.md`를 처음부터 끝까지 읽는다.
2. 프론트 구조는 `docs/frontend-structure.md`, 배포/연동은 `docs/backend-integration-guide.md`를 참고한다.
3. 기능 변경이면 `docs/FUNCTION_SPEC_SIMPLE.md`, 발표 기능이면 `docs/PRESENTATION_PAGE_FEATURES.md`의 관련 섹션을 읽는다.
4. `git status`로 현재 변경 파일을 확인하고 사용자의 기존 변경사항을 보존한다.
5. 대상 화면의 `src/views/**/*.vue`와 연결된 `src/stores`·`src/composables`·`src/api`를 함께 확인한다.

## 디자인 원칙

- 최종 Figma와 사용자가 제공한 완성형 캡처가 시각적 기준이다.
- 와이어프레임·저충실도·`대안` 시안은 구현하지 않는다.
- 사용자가 요청하지 않으면 공통 헤더는 유지한다. 화면을 브라우저 너비에 과도하게 늘리지 않는다.
- 공통·면접·아카이브는 1440px, 발표 설정은 1600px 기준 그리드를 우선한다.
- 색상·간격은 `src/assets/styles/tokens.css`의 CSS 변수를 사용한다. Figma의 좌우 여백, 카드 비율, 폰트 위계, 모서리와 약한 그림자를 유지한다.
- 페이지 제목에 `HI-FI`, `대안` 등 설계 과정 용어를 노출하지 않는다.

## 구현 원칙

- 디자인 변경으로 기존 기능(업로드·녹화·저장·리포트 이동)이 사라지지 않게 한다.
- 마크업만 바꾸지 말고 상태·이벤트·반응형 CSS도 함께 수정한다.
- **Vue 방식으로 작성한다**: `<script setup>` + 반응형 상태, 공유 상태는 Pinia store, DOM/브라우저 로직은 composable, 화면 전환은 `<RouterLink>`/`router.push`. `innerHTML`·전역 `window.*` 브리지·목업 인라인 스크립트를 새로 만들지 않는다.
- 새 화면/플로우는 `routes.js`에 `meta.{layout,bodyClass,area,title,requiresAuth,flow}`로 등록한다.
- 백엔드 호출은 `src/api/*Api.js`에 두고 `withMock(request, mock)`으로 감싼다.
- 사용자가 만든 파일과 무관한 변경을 삭제/덮어쓰지 않는다. 파괴적 Git 명령을 사용하지 않는다.

### 재발 방지(중요)

- `App.vue`에 `<Transition mode="out-in">`를 다시 넣지 않는다(라우트 스왑이 멈춘다).
- 가로 스크롤 클립은 `html { overflow-x: hidden }`에만 둔다. `body`에 주면 body가 스크롤 컨테이너가 되어 `window.scrollY` 기반 로직(홈 스크롤 연출)이 깨진다.

## 검증

- `npm test`(Vitest) 통과를 확인한다. 화면/스토어/컴포넌트 로직을 바꿨으면 해당 테스트를 추가·갱신한다.
- `npm run build`가 성공하는지 확인한다.
- `npm run dev`(또는 프리뷰)로 변경 화면의 이전·다음·저장·녹화·리포트 이동을 확인하고, 콘솔 에러가 없는지 본다.
- 기본 진입 화면이 홈인지, 1920×1080과 모바일 너비에서 레이아웃이 깨지지 않는지 확인한다.

## 응답 방식

- 완료 결과를 먼저 설명하고, 변경한 주요 화면과 검증 결과를 간단히 보고한다.
- 실제로 확인하지 못한 동작·화면을 확인했다고 표현하지 않는다.
- 로컬 파일은 클릭 가능한 경로 링크로 언급한다.
