<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores/authStore.js'
import { useHomeMotion } from '../composables/useHomeMotion.js'
import { useDotField } from '../composables/useDotField.js'
import { buildVoicePaceMock, toClock, useVoicePaceGraph } from '../composables/useVoicePaceGraph.js'
import { canRunHomeTransition, runHomeExit } from '../composables/useHomeTransition.js'
import { consumeRecordingResetNotice } from '../utils/recordingRefreshRecovery.js'
import logoDark from '../assets/images/aivo-logo.png'
import logoLight from '../assets/images/aivo-logo-white.png'

const router = useRouter()
const auth = useAuthStore()
const displayName = computed(() => auth.user?.nickname || auth.user?.name || null)
const recordingResetNotice = ref(consumeRecordingResetNotice())
const recordingResetNoticeMessage = computed(() => (
  recordingResetNotice.value?.reason === 'completed-session'
    ? '종료된 세션입니다.'
    : '새로고침으로 진행 중인 연습이 종료되었습니다. 새로운 연습을 시작해주세요.'
))

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
// 홈페이지 Script 영역은 실제 재생 데이터와 무관한 고정 발표 미리보기다.
// 썸네일을 누르면 선택한 슬라이드의 제목과 발표 대본만 함께 바뀐다.
const scriptSlideList = [
  {
    key: 1,
    no: 1,
    img: '/slide-2.png',
    title: '서비스 소개',
    transcript: {
      prior: [
        '안녕하세요. 발표 연습을 더 정확하게 만들어 주는 AIVO를 소개하겠습니다.',
        '혼자 발표를 연습하면 말하기 속도나 시선처럼 놓치기 쉬운 부분이 생깁니다.',
      ],
      current: 'AIVO는 발표 자료와 실제 발화를 함께 분석해 개선이 필요한 순간을 찾아주는 연습 서비스입니다.',
      next: [
        '슬라이드별 대본과 실제 발화를 비교하고 음성과 몸짓 결과도 한 번에 확인할 수 있습니다.',
        '이제 연습부터 리포트까지 이어지는 과정을 순서대로 보여드리겠습니다.',
      ],
    },
  },
  {
    key: 2,
    no: 2,
    img: '/slide-3.png',
    title: '실시간 분석',
    transcript: {
      prior: [
        '사용자는 발표 자료를 등록하고 슬라이드별 대본을 준비할 수 있습니다.',
        '연습을 시작하면 카메라와 마이크를 통해 발표 과정이 기록됩니다.',
      ],
      current: '발표 중에는 말하기 속도와 시선, 자세를 실시간으로 확인하며 연습할 수 있습니다.',
      next: [
        '슬라이드가 바뀌는 시점과 실제 발화도 함께 기록됩니다.',
        '기록된 데이터는 발표가 끝난 뒤 상세 리포트로 정리됩니다.',
      ],
    },
  },
  {
    key: 3,
    no: 3,
    img: '/slide-4.png',
    title: '맞춤 리포트',
    transcript: {
      prior: [
        '연습이 끝나면 발표 내용을 구간별로 다시 확인할 수 있습니다.',
        '슬라이드 대본과 실제 발화를 비교해 빠뜨린 내용을 찾을 수 있습니다.',
      ],
      current: '음성 전달과 몸짓 분석 결과를 그래프로 확인하고 문제가 있었던 시점으로 바로 이동할 수 있습니다.',
      next: [
        '반복 연습 결과도 저장되어 이전 시도와 달라진 점을 비교할 수 있습니다.',
        '이를 통해 사용자는 다음 연습에서 개선할 부분을 구체적으로 확인할 수 있습니다.',
      ],
    },
  },
]
const scriptSlide = ref(1)
const activeScriptSlide = computed(() => scriptSlideList.find((item) => item.key === scriptSlide.value) ?? scriptSlideList[0])
const stepScriptSlide = (direction) => {
  const currentIndex = scriptSlideList.findIndex((item) => item.key === activeScriptSlide.value.key)
  const nextIndex = (currentIndex + direction + scriptSlideList.length) % scriptSlideList.length
  scriptSlide.value = scriptSlideList[nextIndex].key
}
// 발표 영상 미리보기 포스터. public/home-presenter.jpg 에서 로드하고,
// 파일이 없으면(로드 실패) 기존 어두운 실루엣 장면으로 폴백한다.
const homePosterSrc = '/home-presenter.png'
const homePosterError = ref(false)

const homeScriptPreview = computed(() => activeScriptSlide.value.transcript)

// --- Report preview: 실제 리포트와 동일한 음성 pace 그래프 + 몸짓 타임라인 ---
// (그래프 엔진은 실제 상세 리포트와 완전히 같은 useVoicePaceGraph를 그대로 쓴다.)
const homeReportDurationSec = 96
const homeVoicePace = computed(() => buildVoicePaceMock(homeReportDurationSec, 2))
const homeReportDuration = computed(() => homeReportDurationSec)
// 몸짓 곡선 path의 구간 끝점과 동일한 좌표를 사용해 시선 이탈 마커가
// 반응형 크기에서도 항상 그래프 선 위에 놓이게 한다.
const homeGazeMarkers = [
  { id: 1, xPct: 22, yPct: 75.45 },
  { id: 2, xPct: 45.5, yPct: 34.55 },
  { id: 3, xPct: 68.2, yPct: 57.27 },
  { id: 4, xPct: 89.1, yPct: 76.36 },
]
const {
  paceChartPath: homePaceChartPath,
  avgLineStyle: homeAvgLineStyle,
  paceYBounds: homePaceYBounds,
  fillerDotPositions: homeFillerDotPositions,
  rangeOverlays: homeRangeOverlays,
  silenceSegments: homeSilenceSegments,
} = useVoicePaceGraph(homeVoicePace, homeReportDuration)

useHomeMotion()

// 실험: 마우스 근처 점이 밝아지는 인터랙티브 도트 배경(테스트 적용).
const dotFieldEl = ref(null)
useDotField(dotFieldEl)
</script>

<template>
  <a class="home-skip-link" href="#home">본문으로 바로가기</a>

  <div
    v-if="recordingResetNotice"
    class="home-recording-reset-notice"
    data-testid="recording-reset-notice"
    role="status"
  >
    <span>{{ recordingResetNoticeMessage }}</span>
    <button type="button" aria-label="안내 닫기" @click="recordingResetNotice = null">×</button>
  </div>

  <div class="home-ambient" data-home-ambient aria-hidden="true">
    <i class="home-ambient-orb home-ambient-orb-a"></i>
    <i class="home-ambient-orb home-ambient-orb-b"></i>
    <canvas ref="dotFieldEl" class="home-dot-field"></canvas>
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
      <span
        class="home-profile-label"
        data-transition-role="profile"
        :title="`${displayName}님`"
      >
        <span class="home-profile-nickname">{{ displayName }}</span>
        <span class="home-profile-suffix">님</span>
      </span>
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

        <div class="home-review metric-report-shell" data-motion-practice-row>
          <div class="home-review-slide">
            <header class="home-review-col-head">
              <h3>발표 슬라이드</h3>
              <span>슬라이드 {{ activeScriptSlide.no }} · {{ activeScriptSlide.title }}</span>
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
              <h3>슬라이드별 대본 복기</h3>
            </header>
            <div class="home-script-report-card" aria-label="슬라이드별 대본 복기 미리보기">
              <div class="home-script-question-row">
                <button type="button" class="home-script-nav" aria-label="이전 슬라이드 미리보기" @click="stepScriptSlide(-1)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
                </button>
                <h4>슬라이드 {{ activeScriptSlide.no }}. {{ activeScriptSlide.title }}</h4>
                <button type="button" class="home-script-nav is-next" aria-label="다음 슬라이드 미리보기" @click="stepScriptSlide(1)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
                </button>
              </div>

              <div class="home-script-transcript">
                <p v-for="(line, i) in homeScriptPreview.prior" :key="`script-prior-${i}`" class="home-script-line is-muted">{{ line }}</p>
                <p class="home-script-line is-current">{{ homeScriptPreview.current }}</p>
                <p v-for="(line, i) in homeScriptPreview.next" :key="`script-next-${i}`" class="home-script-line is-muted">{{ line }}</p>
              </div>
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

        <div class="home-result metric-report-shell" data-motion-record-row>
          <section class="home-report-preview-card" data-motion-record-row aria-label="음성 전달 그래프 미리보기">
            <header class="home-report-preview-head">
              <h3>음성 전달을 구간별로 확인</h3>
              <div class="iv-pace-legend">
                <span class="iv-pace-legend-item is-slow"><i>▼</i>가장 느린 구간</span>
                <span class="iv-pace-legend-item is-fast"><i>▲</i>가장 빠른 구간</span>
                <span class="iv-pace-legend-item is-filler"><i></i>추임새</span>
                <span class="iv-pace-legend-item is-silence"><i></i>침묵 구간</span>
              </div>
            </header>
            <div class="iv-pace-chart home-pace-chart">
              <div class="home-pace-plot">
                <div class="iv-pace-avg-line" :style="homeAvgLineStyle">
                  <span class="iv-pace-avg-label">평균 속도 · 초당 {{ homeVoicePace.avgPace.toFixed(1) }}음절</span>
                </div>
                <span class="iv-pace-yaxis-label iv-pace-yaxis-max">초당 {{ homePaceYBounds.hi.toFixed(1) }}음절</span>
                <span class="iv-pace-yaxis-label iv-pace-yaxis-min">초당 {{ homePaceYBounds.lo.toFixed(1) }}음절</span>
                <span
                  v-for="(sil, i) in homeSilenceSegments"
                  :key="`home-sil-${i}`"
                  class="iv-pace-silence-bg"
                  :style="{ left: `${sil.leftPct}%`, width: `${sil.widthPct}%` }"
                  aria-hidden="true"
                ></span>
                <svg class="iv-pace-svg" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
                  <path :d="homePaceChartPath" class="iv-pace-step-line" />
                </svg>
                <span
                  v-for="(f, i) in homeFillerDotPositions"
                  :key="`home-filler-${i}`"
                  class="iv-pace-filler-dot"
                  :style="{ left: `${f.xPct}%`, top: `${f.yPct}%` }"
                  aria-hidden="true"
                ></span>
              </div>

              <div class="home-pace-range-lane" aria-label="발화 속도 구간 요약">
                <div
                  class="iv-pace-range-mark"
                  :style="{ left: `${homeRangeOverlays.slow.leftPct}%`, width: `${homeRangeOverlays.slow.widthPct}%` }"
                  aria-hidden="true"
                >
                  <span class="iv-pace-range-icon">▼</span>
                  <span class="iv-pace-range-bracket"></span>
                  <span class="iv-pace-range-value">{{ homeVoicePace.slowest.pace.toFixed(1) }}</span>
                </div>
                <div
                  class="iv-pace-range-mark"
                  :style="{ left: `${homeRangeOverlays.fast.leftPct}%`, width: `${homeRangeOverlays.fast.widthPct}%` }"
                  aria-hidden="true"
                >
                  <span class="iv-pace-range-icon">▲</span>
                  <span class="iv-pace-range-bracket"></span>
                  <span class="iv-pace-range-value">{{ homeVoicePace.fastest.pace.toFixed(1) }}</span>
                </div>
              </div>
            </div>
            <div class="iv-pace-axis-edges">
              <span>0:00</span>
              <span>{{ toClock(homeReportDurationSec) }}</span>
            </div>
          </section>

          <section class="home-report-preview-card home-gesture-graph-card" data-motion-record-row aria-label="몸짓 그래프 미리보기">
            <header class="home-gesture-graph-head">
              <h3>몸짓도 확인 가능해요</h3>
              <div class="home-gesture-legend" aria-hidden="true">
                <span><i class="is-eye"></i>시선 이탈</span>
                <span><i class="is-line"></i>기울기</span>
              </div>
            </header>

            <div class="home-gesture-chart" aria-hidden="true">
              <span class="home-gesture-range">1–24% 범위</span>
              <div class="home-gesture-plot">
                <span class="home-gesture-grid is-top"></span>
                <span class="home-gesture-grid is-bottom"></span>
                <span class="home-gesture-average"><b>기울기 평균 · 12%</b></span>
                <svg viewBox="0 0 1000 220" preserveAspectRatio="none">
                  <path d="M0 126 C86 150 145 170 220 166 C312 162 355 102 455 76 C540 53 599 88 682 126 C764 164 829 190 891 168 C945 150 975 112 1000 82" />
                </svg>
                <span class="home-gesture-marker-layer">
                  <span
                    v-for="marker in homeGazeMarkers"
                    :key="marker.id"
                    class="home-gesture-eye-marker"
                    :style="{ left: `${marker.xPct}%`, top: `${marker.yPct}%` }"
                  >
                    <svg viewBox="0 0 24 16"><path d="M1 8C5 1.5 19 1.5 23 8c-4 6.5-18 6.5-22 0Z" /><circle cx="12" cy="8" r="3.2" /></svg>
                  </span>
                </span>
                <span class="home-gesture-playhead"><b>6:45</b><i></i></span>
              </div>
              <div class="home-gesture-axis"><span>6:45</span><span>9:48</span></div>
            </div>

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
