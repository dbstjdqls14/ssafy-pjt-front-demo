<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores/authStore.js'
import { useHomeMotion } from '../composables/useHomeMotion.js'
import { canRunHomeTransition, runHomeExit } from '../composables/useHomeTransition.js'
import logoDark from '../assets/images/aivo-logo.png'
import logoLight from '../assets/images/aivo-logo-white.png'

const router = useRouter()
const auth = useAuthStore()
const displayName = computed(() => auth.user?.nickname || auth.user?.name || null)

// 다른 페이지로 나갈 때: 데스크톱·라이트·모션 허용이면 우측 글자가 일제히 위로 떠오르는
// 시그니처 전환을 재생하고, 아니면 즉시 이동. 모든 내비 링크가 이걸 공유한다.
const navExit = (path) => {
  if (canRunHomeTransition()) runHomeExit(logoDark, () => router.push(path))
  else router.push(path)
}
const goPractice = () => navExit('/practice')

// 로그아웃은 예외: 시그니처 전환 없이 바로 로그아웃한다.
const logout = () => {
  auth.logout()
  router.push('/')
}

// --- Script review (발표 복기) ---
const scriptSlides = {
  1: {
    title: '문제 정의',
    summary: '혼자 연습할 때 놓치기 쉬운 전달 순간을 발견합니다.',
    transcript: [
      { time: '00:04', kind: 'match', label: '핵심 내용 일치', text: '안녕하세요, 발표 연습을 돕는 AIVO를 소개합니다.' },
      { time: '00:08', kind: 'match', label: '핵심 내용 일치', text: '발표는 반복할수록 좋아집니다.' },
      { time: '00:16', kind: 'evidence', label: '근거 보완', text: '하지만 혼자 연습하면 놓친 순간을 발견하기 어렵습니다.', reason: '문제 상황을 보여줄 구체적인 사례를 한 문장 덧붙이면 설득력이 높아져요.' },
      { time: '00:24', kind: 'match', label: '핵심 내용 일치', text: '오늘은 이 문제를 어떻게 해결하는지 보여드리겠습니다.' },
      { time: '00:31', kind: 'filler', label: '습관어 1회', text: '어, 먼저 저희가 겪은 문제부터 말씀드릴게요.', reason: '문장 첫머리의 "어"가 도입의 자신감을 낮춰요.' },
    ],
  },
  2: {
    title: '핵심 기능',
    summary: '슬라이드 핵심 문장이 실제 발화에 담겼는지 짚어줘요.',
    transcript: [
      { time: '01:00', kind: 'match', label: '핵심 내용 일치', text: 'AIVO는 발표 자료와 실제 발화를 함께 분석합니다.' },
      { time: '01:06', kind: 'match', label: '핵심 내용 일치', text: '슬라이드마다 핵심 문장이 전달됐는지 확인합니다.' },
      { time: '01:18', kind: 'filler', label: '습관어 1회', text: '그래서, 음, 말하기 습관까지 확인할 수 있습니다.', reason: '문장 중간의 "음"이 흐름을 끊어 전달 집중도를 낮춰요.' },
      { time: '01:32', kind: 'match', label: '핵심 내용 일치', text: '말하기 속도와 시선도 구간별로 기록됩니다.' },
      { time: '01:44', kind: 'evidence', label: '근거 보완', text: '분석 결과는 리포트로 정리됩니다.', reason: '어떤 지표가 리포트에 담기는지 한 예시를 들면 더 구체적이에요.' },
    ],
  },
  3: {
    title: '기대 효과',
    summary: '개선 구간을 짚어 다음 연습의 방향을 선명하게 만듭니다.',
    transcript: [
      { time: '02:08', kind: 'match', label: '핵심 내용 일치', text: '이제 막연한 반복 대신 개선할 구간을 알 수 있습니다.' },
      { time: '02:14', kind: 'match', label: '핵심 내용 일치', text: '실시간 분석으로 발표 준비 시간을 줄일 수 있습니다.' },
      { time: '02:26', kind: 'evidence', label: '근거 보완', text: '전달력도 함께 높일 수 있습니다.', reason: '시간 절감 수치나 실제 사례를 함께 제시하면 더 설득력 있어요.' },
      { time: '02:38', kind: 'match', label: '핵심 내용 일치', text: '결국 더 자신 있는 발표로 이어집니다.' },
      { time: '02:47', kind: 'match', label: '핵심 내용 일치', text: '지금 바로 첫 연습을 시작해보세요.' },
    ],
  },
}
// 실제 테스트 발표 자료(PPT)의 슬라이드 이미지. 메인 미리보기는 표지(1번),
// 아래 썸네일은 이어지는 2·3·4번 슬라이드를 그대로 보여준다.
const scriptSlideList = [
  { key: 1, no: 2, img: '/slide-2.png', title: '문제 정의' },
  { key: 2, no: 3, img: '/slide-3.png', title: '핵심 기능' },
  { key: 3, no: 4, img: '/slide-4.png', title: '기대 효과' },
]
const scriptSlide = ref(1)
const transcriptFilter = ref('all')
// 발표 영상 미리보기 포스터. public/home-presenter.jpg 에서 로드하고,
// 파일이 없으면(로드 실패) 기존 어두운 실루엣 장면으로 폴백한다.
const homePosterSrc = '/home-presenter.png'
const homePosterError = ref(false)
const currentSlide = computed(() => scriptSlides[scriptSlide.value])
const currentTranscript = computed(() =>
  transcriptFilter.value === 'improve'
    ? currentSlide.value.transcript.filter((row) => row.kind !== 'match')
    : currentSlide.value.transcript,
)

// --- Report preview (연습 결과 지표) ---
// 실제 상세 리포트처럼 음성·영상·내용 일치 점수에 호버하면 세부 지표를 보여준다.
const scoreAxes = [
  { key: 'voice', label: '음성', value: '86점', title: '음성 평가 지표', breakdown: [['필러', '7회'], ['말 더듬음', '2회'], ['말 속도', '128 WPM'], ['목소리 떨림', '3회'], ['긴 공백', '4회']] },
  { key: 'video', label: '영상', value: '82점', title: '영상 평가 지표', breakdown: [['시선 이탈', '6회'], ['표정 이상 감지', '3회'], ['자세와 움직임', '4회']] },
  { key: 'content', label: '내용 일치', value: '84점', title: '내용 평가 지표', breakdown: [['발표 내용 적절성', '88%'], ['슬라이드 일치', '92%'], ['질의응답 적절성', '76%']] },
]

// --- Report preview (AI 피드백) ---
// 실제 상세 리포트(발표 복기)의 AI 피드백과 동일하게 범주별 마크다운 보고서로 보여준다.
const reportReports = {
  content: `## 내용 일치 종합 분석

슬라이드 핵심 메시지와 실제 발화의 일치 정도를 분석했습니다.

### 핵심 요약
- **슬라이드 일치도 92%** — 대부분의 핵심 메시지가 발화에 담겼어요.
- 슬라이드 3의 **성과 근거**(시간 절감 수치)가 빠졌습니다.

### 개선 제안
- 정량 근거를 한 문장 덧붙이세요. 예) "발표 준비 시간을 30% 줄일 수 있습니다."`,
  delivery: `## 비언어 전달 분석

말하기 속도·습관어·시선을 종합했습니다.

### 핵심 지표
- **말하기 속도 128 WPM** — 권장 범위(110~140) 안으로 안정적입니다.
- **습관어 7회** — "음/어"가 문장 흐름을 끊었어요.
- **시선 유지 74%** — 핵심 문장에서 시선 이탈이 있었습니다.

### 개선 제안
- 문장 사이 0.5초의 의도적인 멈춤으로 습관어를 대체해보세요.`,
  qna: `## 질의응답 피드백

받은 질문에 대한 답변의 명확성과 근거를 분석했습니다.

### Q1. 서비스 차별점
- 서두의 **"음"** 습관어가 자신감을 낮췄어요. 차별점을 먼저 제시하세요.

### Q2. 기대 효과
- **수치·사례**를 함께 제시하세요. 예) "발표 준비 시간 30% 단축".`,
}

// 경량 마크다운 → HTML (제목/굵게/코드/목록/문단). 상세 리포트와 동일한 렌더러.
const renderMarkdown = (md) => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
  const out = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const raw of String(md).split('\n')) {
    const line = raw.trim()
    if (!line) { closeList(); continue }
    let m
    if ((m = line.match(/^###\s+(.*)/))) { closeList(); out.push(`<h4>${inline(m[1])}</h4>`) }
    else if ((m = line.match(/^##\s+(.*)/))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`) }
    else if ((m = line.match(/^#\s+(.*)/))) { closeList(); out.push(`<h2>${inline(m[1])}</h2>`) }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(m[1])}</li>`) }
    else { closeList(); out.push(`<p>${inline(line)}</p>`) }
  }
  closeList()
  return out.join('')
}
const reportTab = ref('content')
const reportHtml = computed(() => renderMarkdown(reportReports[reportTab.value] || ''))

useHomeMotion()
</script>

<template>
  <a class="home-skip-link" href="#home">본문으로 바로가기</a>

  <div class="home-ambient" data-home-ambient aria-hidden="true">
    <i class="home-ambient-orb home-ambient-orb-a"></i>
    <i class="home-ambient-orb home-ambient-orb-b"></i>
  </div>

  <a class="home-brand-crop" href="#home" aria-label="AIVO 홈" data-transition-role="logo">
    <img :src="logoDark" class="home-brand-dark" alt="AIVO" />
    <img :src="logoLight" class="home-brand-light" alt="" aria-hidden="true" />
  </a>

  <button class="home-menu-toggle" id="homeMenuToggle" type="button" aria-expanded="false" aria-controls="homeSideNav">
    <span>메뉴</span>
    <i aria-hidden="true"></i>
    <i aria-hidden="true"></i>
  </button>

  <aside class="home-side-nav" id="homeSideNav" aria-label="홈 화면 탐색">
    <nav class="home-route-nav" aria-label="페이지 이동">
      <a href="/practice" data-transition-role="practice" @click.prevent="goPractice">새 연습</a>
      <a href="/archive" data-transition-role="records" @click.prevent="navExit('/archive')">내 기록</a>
      <a href="/faq" data-transition-role="faq" @click.prevent="navExit('/faq')">FAQ</a>
    </nav>

    <nav class="home-section-nav" aria-label="서비스 소개 섹션">
      <a href="#home" data-section-link="home">Home</a>
      <a href="#dashboard" data-section-link="dashboard">Dashboard</a>
      <a href="#practice" data-section-link="practice">Script</a>
      <a href="#records" data-section-link="records">Report</a>
    </nav>

    <div v-if="!auth.isAuthenticated" class="home-auth-links">
      <a href="/login" @click.prevent="navExit('/login')">로그인</a>
      <a href="/register" @click.prevent="navExit('/register')">회원가입</a>
    </div>
    <div v-else class="home-auth-links">
      <span class="home-profile-label" data-transition-role="profile">{{ displayName }}님</span>
      <a href="/mypage" data-transition-role="mypage" @click.prevent="navExit('/mypage')">마이페이지</a>
      <button class="home-auth-action" type="button" @click="logout">로그아웃</button>
    </div>
  </aside>

  <div class="home-scroll-progress" data-scroll-progress role="progressbar"
    aria-label="페이지 스크롤 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
    <span class="home-progress-track" aria-hidden="true">
      <i data-scroll-progress-fill></i>
    </span>
    <span class="home-progress-readout" aria-live="off">
      <b data-section-count>01 / 04</b>
      <em data-scroll-percent>00%</em>
    </span>
  </div>

  <main>
    <section class="home-section home-hero" id="home" data-home-section="01" data-theme="light" aria-labelledby="homeTitle">
      <div class="home-section-inner home-hero-inner">
        <div class="home-hero-copy">
          <h1 id="homeTitle">
            <span class="home-title-lead" data-motion-hero-line="1">혼자 하는 연습에,</span>
            <span class="home-title-accent" data-motion-hero-line="2">확신을 더하다.</span>
          </h1>
          <p data-motion-hero-meta>발표 및 면접 및 리포트</p>
          <a class="home-main-cta home-arrow-link" data-motion-hero-cta href="/practice" @click.prevent="goPractice">
            <span>새 연습 시작하기</span>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" /></svg>
          </a>
        </div>
        <span class="home-hero-index" aria-hidden="true">AIVO · 01</span>
      </div>
    </section>

    <section class="home-section home-dashboard" id="dashboard" data-home-section="02" data-theme="dark" aria-labelledby="dashboardTitle">
      <div class="home-section-inner">
        <header class="home-section-heading" data-motion-heading>
          <div class="home-heading-copy">
            <h2 id="dashboardTitle">연습 점수부터 성장 추이까지 한눈에</h2>
            <span>마이페이지의 내 학습 추이에서 연습별 성장 흐름을 확인할 수 있어요.</span>
          </div>
        </header>

        <div class="home-score-stage">
          <div class="home-score-copy" data-motion-score>
            <strong>84</strong>
            <p>지난 연습보다 <b>+6</b></p>
          </div>

          <div class="home-chart" data-motion-chart>
            <svg viewBox="0 0 720 290" role="group" aria-label="최근 다섯 번의 연습 점수" preserveAspectRatio="none">
              <defs>
                <linearGradient id="homeChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stop-color="#5276df" stop-opacity=".18" />
                  <stop offset="1" stop-color="#5276df" stop-opacity="0" />
                </linearGradient>
                <clipPath id="homeChartReveal" clipPathUnits="userSpaceOnUse">
                  <rect class="home-chart-reveal-rect" x="0" y="-40" width="712" height="370" />
                </clipPath>
              </defs>
              <path class="home-chart-fill" d="M18 221 C90 214 125 176 190 168 S294 184 353 165 S468 109 521 99 S625 76 702 56 L702 275 L18 275 Z" />
              <path class="home-chart-line" d="M18 221 C90 214 125 176 190 168 S294 184 353 165 S468 109 521 99 S625 76 702 56" />
              <g class="home-chart-points">
                <circle class="home-chart-point" cx="18" cy="221" r="5" tabindex="0" data-cx="18" data-cy="221" data-score="72" data-attempt="1회" aria-label="1회 점수 72점"></circle>
                <circle class="home-chart-point" cx="190" cy="168" r="5" tabindex="0" data-cx="190" data-cy="168" data-score="78" data-attempt="2회" aria-label="2회 점수 78점"></circle>
                <circle class="home-chart-point" cx="353" cy="165" r="5" tabindex="0" data-cx="353" data-cy="165" data-score="77" data-attempt="3회" aria-label="3회 점수 77점"></circle>
                <circle class="home-chart-point" cx="521" cy="99" r="5" tabindex="0" data-cx="521" data-cy="99" data-score="82" data-attempt="4회" aria-label="4회 점수 82점"></circle>
                <circle class="home-chart-point is-current" cx="702" cy="56" r="7" tabindex="0" data-cx="702" data-cy="56" data-score="84" data-attempt="현재" aria-label="현재 점수 84점"></circle>
              </g>
            </svg>
            <output class="home-chart-tooltip" aria-live="polite"></output>
            <div class="home-chart-labels" aria-hidden="true">
              <span>72<small>1회</small></span>
              <span>78<small>2회</small></span>
              <span>77<small>3회</small></span>
              <span>82<small>4회</small></span>
              <span>84<small>현재</small></span>
            </div>
          </div>
        </div>

        <dl class="home-metrics">
          <div data-motion-metric><dt>속도</dt><dd>128 <small>단어/분</small></dd></div>
          <div data-motion-metric><dt>집중도</dt><dd>81%</dd></div>
          <div data-motion-metric><dt>성장률</dt><dd>+8%</dd></div>
          <div data-motion-metric><dt>연속 기록</dt><dd>4 <small>일</small></dd></div>
        </dl>
      </div>
    </section>

    <section class="home-section home-practice" id="practice" data-home-section="03" data-theme="light" aria-labelledby="practiceTitle">
      <div class="home-section-inner">
        <header class="home-section-heading" data-motion-heading>
          <div class="home-heading-copy">
            <h2 id="practiceTitle">슬라이드별 대본과 실제 발화를 나란히 비교</h2>
            <span>연습 후 슬라이드별 대본과 실제 발화를 나란히 비교해 복기할 수 있어요.</span>
          </div>
        </header>

        <div class="home-review" data-motion-practice-row>
          <div class="home-review-slide">
            <header class="home-review-col-head">
              <h3>발표 슬라이드</h3>
              <span>슬라이드 1 · 서비스 소개 발표</span>
            </header>
            <div class="home-review-stage home-review-video" aria-label="발표 영상 미리보기">
              <img
                v-if="!homePosterError"
                class="home-review-video-poster"
                :src="homePosterSrc"
                alt="발표 연습 예시 화면"
                @error="homePosterError = true"
              />
              <span v-else class="home-review-video-scene" aria-hidden="true"></span>
              <span class="home-review-video-play" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-8z" /></svg>
              </span>
            </div>
            <div class="home-review-thumbs" role="tablist" aria-label="복기할 슬라이드 선택">
              <button
                v-for="item in scriptSlideList"
                :key="item.key"
                type="button"
                class="home-review-thumb"
                :class="{ 'is-active': scriptSlide === item.key }"
                role="tab"
                :aria-selected="scriptSlide === item.key"
                @click="scriptSlide = item.key"
              >
                <span class="home-review-thumb-img"><img :src="item.img" :alt="`슬라이드 ${item.no}`" /></span>
              </button>
            </div>
          </div>

          <div class="home-review-script">
            <header class="home-review-col-head">
              <h3>슬라이드별 실제 발화</h3>
              <button type="button" class="home-review-filter-btn" aria-label="발화 필터">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
              </button>
            </header>
            <div class="home-review-filter" role="tablist" aria-label="발화 필터">
              <button type="button" :class="{ 'is-active': transcriptFilter === 'all' }" role="tab" :aria-selected="transcriptFilter === 'all'" @click="transcriptFilter = 'all'">전체 발화</button>
              <button type="button" :class="{ 'is-active': transcriptFilter === 'improve' }" role="tab" :aria-selected="transcriptFilter === 'improve'" @click="transcriptFilter = 'improve'">문제 구간</button>
            </div>
            <div class="home-review-transcript" aria-live="polite">
              <article v-for="(row, i) in currentTranscript" :key="i" class="home-transcript-card" :class="`is-${row.kind}`">
                <span class="home-transcript-meta"><b>{{ row.time }}</b><em>{{ row.label }}</em></span>
                <p>{{ row.text }}</p>
                <small v-if="transcriptFilter === 'improve' && row.reason">{{ row.reason }}</small>
              </article>
              <p v-if="!currentTranscript.length" class="home-transcript-empty">개선이 필요한 발화 구간이 없습니다.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="home-section home-records" id="records" data-home-section="04" data-theme="light" aria-labelledby="recordsTitle">
      <div class="home-section-inner">
        <header class="home-section-heading" data-motion-heading>
          <div class="home-heading-copy">
            <h2 id="recordsTitle">내용 및 전달 및 비언어와 질의응답까지 구간별로 확인</h2>
            <span>슬라이드 일치 및 전달력 및 시선과 질의응답 답변을 하나의 리포트에서 확인할 수 있어요.</span>
          </div>
        </header>

        <div class="home-result" data-motion-record-row>
          <section class="home-result-summary" aria-label="연습 결과">
            <dl class="home-result-axes">
              <div v-for="axis in scoreAxes" :key="axis.key" class="home-score-metric" tabindex="0">
                <dt>{{ axis.label }}<span class="home-score-hint" aria-hidden="true">?</span></dt>
                <dd>{{ axis.value }}</dd>
                <aside class="home-score-detail">
                  <strong>{{ axis.title }}</strong>
                  <dl class="home-score-breakdown">
                    <div v-for="(row, i) in axis.breakdown" :key="i"><dt>{{ row[0] }}</dt><dd>{{ row[1] }}</dd></div>
                  </dl>
                </aside>
              </div>
            </dl>
          </section>

          <section class="home-result-feedback" aria-label="AI 피드백">
            <header>
              <h3>AI 피드백</h3>
              <p>구간별 개선 포인트를 확인해요.</p>
            </header>
            <div class="home-result-tabs" role="tablist" aria-label="리포트 분석 영역">
              <button type="button" :class="{ 'is-active': reportTab === 'content' }" role="tab" :aria-selected="reportTab === 'content'" @click="reportTab = 'content'">내용 일치</button>
              <button type="button" :class="{ 'is-active': reportTab === 'delivery' }" role="tab" :aria-selected="reportTab === 'delivery'" @click="reportTab = 'delivery'">비언어 전달</button>
              <button type="button" :class="{ 'is-active': reportTab === 'qna' }" role="tab" :aria-selected="reportTab === 'qna'" @click="reportTab = 'qna'">질의응답</button>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="home-result-report markdown-body" aria-live="polite" v-html="reportHtml"></div>
          </section>
        </div>

        <footer class="home-footer" data-motion-footer>
          <span>AIVO Copyright © 2026 AIVO.</span>
          <a href="mailto:hello@aivo.app">hello@aivo.app</a>
        </footer>
      </div>
    </section>
  </main>
</template>
