# Front Monorepo Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitLab `front` 브랜치를 Spring, FastAPI, 최신 Vue 프런트의 세 프로젝트 디렉터리 구조로 재구성한다.

**Architecture:** 두 백엔드 디렉터리는 현재 루트 위치와 내용을 유지한다. 현재 루트의 모든 프런트 추적 파일은 `git mv`로 `frontend-vue-main/` 아래에 이동해 기존 프런트 내용을 보존하고 과거 backend 브랜치의 프런트 복사본은 사용하지 않는다.

**Tech Stack:** Git, Vue 3, Vite, Vitest, FastAPI, pytest, Spring Boot, Gradle

## Global Constraints

- 최종 프로젝트 디렉터리는 `backend-fastapi-main/`, `backend-spring-develop/`, `frontend-vue-main/` 세 개다.
- `.idea/`는 포함하지 않는다.
- 로컬 비추적 런타임 파일은 커밋하지 않는다.
- 최종 구조 변경 커밋 메시지는 `프런트 최신화 및 백엔드 폴더 동기화`다.
- `front` 푸시는 강제 푸시 없이 fast-forward 방식만 사용한다.

---

### Task 1: 최신 프런트 디렉터리 이동

**Files:**
- Create: `frontend-vue-main/`
- Move: `.env.example`, `.gitignore`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `README.md`, `docs/`, `index.html`, `package-lock.json`, `package.json`, `public/`, `src/`, `tests/`, `vite.config.js`
- Preserve: `backend-fastapi-main/`, `backend-spring-develop/`

**Interfaces:**
- Consumes: 현재 `front` 루트의 추적된 프런트 프로젝트
- Produces: 독립 실행 가능한 `frontend-vue-main/` 프로젝트

- [ ] **Step 1: 이동 대상이 모두 추적 상태인지 확인**

Run:

```powershell
git ls-tree --name-only HEAD
```

Expected: 두 백엔드 디렉터리와 이동 대상 프런트 항목이 모두 출력된다.

- [ ] **Step 2: `frontend-vue-main`을 만들고 프런트 항목 이동**

Run:

```powershell
New-Item -ItemType Directory -Path frontend-vue-main
git mv -- .env.example .gitignore AGENTS.md PROJECT_CONTEXT.md README.md docs index.html package-lock.json package.json public src tests vite.config.js frontend-vue-main
```

Expected: 두 백엔드 디렉터리는 루트에 남고 프런트 항목은 rename으로 표시된다.

- [ ] **Step 3: 루트 프로젝트 디렉터리 검증**

Run:

```powershell
git status --short --untracked-files=no
git ls-files | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique
```

Expected: 추적 변경은 프런트 파일 이동뿐이며 추적 루트는 세 프로젝트 디렉터리만 출력된다.

### Task 2: 프로젝트 회귀 검증

**Files:**
- Test: `frontend-vue-main/tests/**`
- Test: `backend-fastapi-main/tests/**`
- Test: `backend-spring-develop/src/test/**`

**Interfaces:**
- Consumes: Task 1의 세 프로젝트 디렉터리
- Produces: 구조 변경 후 테스트·빌드 증거

- [ ] **Step 1: 프런트 전체 테스트 실행**

Run from `frontend-vue-main/`:

```powershell
node ..\node_modules\vitest\vitest.mjs run
```

Expected: 40개 테스트 파일, 148개 테스트가 통과한다.

- [ ] **Step 2: 프런트 프로덕션 빌드 실행**

Run from `frontend-vue-main/`:

```powershell
node ..\node_modules\vite\bin\vite.js build
```

Expected: Vite 빌드가 exit code 0으로 끝난다.

- [ ] **Step 3: FastAPI 테스트 실행**

Run from `backend-fastapi-main/` with the existing temporary test dependencies:

```powershell
python -B -m pytest -q
```

Expected: 16개 테스트가 통과한다.

- [ ] **Step 4: Spring 검증 가능 여부 확인**

Run from `backend-spring-develop/`:

```powershell
java -version
.\gradlew.bat test
```

Expected: Java 25가 설치되어 있으면 테스트를 실행한다. Java가 없으면 실행 불가 사실과 요구 버전을 최종 보고에 명시한다.

### Task 3: 커밋과 GitLab front 갱신

**Files:**
- Commit: 모든 Task 1 이동과 이 설계·계획 문서

**Interfaces:**
- Consumes: 검증된 세 프로젝트 구조
- Produces: 원격 `front` 브랜치의 새 HEAD

- [ ] **Step 1: 추적 트리와 diff 확인**

Run:

```powershell
git diff --check
git status --short --untracked-files=no
git diff --summary
```

Expected: 예상한 rename과 두 문서 추가 외의 변경이 없다.

- [ ] **Step 2: 요청한 메시지로 단일 구조 변경 커밋 작성**

Run:

```powershell
git add -u -- .
git add -- frontend-vue-main
git commit --amend -m "프런트 최신화 및 백엔드 폴더 동기화"
```

Expected: 이전 미푸시 설계 커밋과 구조 변경이 하나의 커밋으로 정리된다.

- [ ] **Step 3: 최신 원격 front와 fast-forward 관계 확인**

Run:

```powershell
git fetch origin front
git merge-base --is-ancestor origin/front HEAD
```

Expected: 명령이 exit code 0으로 끝난다.

- [ ] **Step 4: 원격 front 푸시 및 SHA 확인**

Run:

```powershell
git push origin HEAD:front
git ls-remote origin refs/heads/front
git rev-parse HEAD
```

Expected: 원격 `front` SHA와 로컬 HEAD SHA가 일치한다.
