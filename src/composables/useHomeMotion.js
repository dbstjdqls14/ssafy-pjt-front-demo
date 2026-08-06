import { onBeforeUnmount, onMounted } from 'vue'

// Home cinematic-scroll engine. This is imperative interaction design (a
// single-frame-loop smooth scroll, per-section motion variables, ambient theme
// shift, scroll progress,
// chart draw + tooltip, in-page section nav). It is encapsulated as a composable
// — the idiomatic place for DOM behavior — instead of being rewritten reactively,
// which would add regression risk without benefit. It queries the elements the
// HomeView template renders in onMounted and tears everything down on unmount.
export const useHomeMotion = () => {
  let cleanup = () => {}

  onMounted(() => {
    // Keep each wheel gesture deliberately restrained: the previous 1:1
    // distance mapping still covered a large part of a section before the
    // easing was visible, which made the home page feel almost native-fast.
    // Time-based damping keeps the same perceived speed on 60/120/144 Hz
    // displays. A fixed per-frame ratio made high-refresh monitors scroll much
    // faster than ordinary 60 Hz screens.
    const SMOOTH_SCROLL_TIME_CONSTANT_MS = 320
    const DEFAULT_FRAME_MS = 1000 / 60
    const MAX_FRAME_CATCH_UP_MS = 1000
    const WHEEL_DISTANCE_SCALE = 0.58
    const MAX_WHEEL_DELTA = 160
    const MAX_PENDING_VIEWPORT_RATIO = 0.68
    // Finish the imperceptible final few pixels directly. This avoids a long
    // low-speed tail and prevents whole-pixel browsers from stalling the loop.
    const MIN_SCROLL_DISTANCE = 3
    const DIRECT_SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])
    const LIGHT_RGB = [255, 255, 255]
    const DARK_RGB = [13, 15, 21]
    const LIGHT_INK_RGB = [17, 19, 27]
    const DARK_INK_RGB = [247, 247, 244]
    const LIGHT_GRID_RGB = [82, 118, 223]
    const DARK_GRID_RGB = [168, 182, 232]

    const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max)
    const mix = (from, to, amount) => from + (to - from) * amount
    const easeOutCubic = (value) => 1 - Math.pow(1 - clamp(value), 3)
    const easeInOut = (value) => {
      const t = clamp(value)
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }
    const rgbString = (from, to, amount) =>
      from.map((channel, index) => Math.round(mix(channel, to[index], amount))).join(' ')
    const gridColor = (amount, alpha) => {
      const r = Math.round(mix(LIGHT_GRID_RGB[0], DARK_GRID_RGB[0], amount))
      const g = Math.round(mix(LIGHT_GRID_RGB[1], DARK_GRID_RGB[1], amount))
      const b = Math.round(mix(LIGHT_GRID_RGB[2], DARK_GRID_RGB[2], amount))
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
    }
    const setVar = (element, name, value) => element?.style.setProperty(name, value)

    const root = document.documentElement
    const controller = new AbortController()
    const { signal } = controller
    const on = (target, type, handler, options = {}) =>
      target.addEventListener(type, handler, { ...options, signal })

    const sections = Array.from(document.querySelectorAll('[data-home-section]'))
    const sectionLinks = Array.from(document.querySelectorAll('[data-section-link]'))
    const sectionCount = document.querySelector('[data-section-count]')
    const progressRoot = document.querySelector('[data-scroll-progress]')
    const progressFill = document.querySelector('[data-scroll-progress-fill]')
    const scrollPercent = document.querySelector('[data-scroll-percent]')
    const sideNav = document.getElementById('homeSideNav')
    const menuToggle = document.getElementById('homeMenuToggle')
    const brand = document.querySelector('.home-brand-crop')
    const heroMeta = document.querySelector('[data-motion-hero-meta]')
    const heroCta = document.querySelector('[data-motion-hero-cta]')
    const motionHeadings = Array.from(document.querySelectorAll('[data-motion-heading]'))
    const score = document.querySelector('[data-motion-score]')
    const chart = document.querySelector('[data-motion-chart]')
    const chartPoints = Array.from(document.querySelectorAll('.home-chart-point[data-score]'))
    const chartLine = document.querySelector('.home-chart-line')
    const chartTooltip = document.querySelector('.home-chart-tooltip')
    const metrics = Array.from(document.querySelectorAll('[data-motion-metric]'))
    const practiceRows = Array.from(document.querySelectorAll('[data-motion-practice-row]'))
    const recordRows = Array.from(document.querySelectorAll('[data-motion-record-row]'))
    const motionFooter = document.querySelector('[data-motion-footer]')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileMotion = window.matchMedia('(max-width: 920px)')

    let activeSectionId = ''
    let sectionMetrics = new Map()
    let targetScrollY = window.scrollY
    let visualScrollY = window.scrollY
    let motionFrame = 0
    let measureFrame = 0
    let smoothScrollActive = false
    let lastMotionTimestamp = null
    // 부드러운 자유 스크롤은 유지하되, 제스처를 멈췄을 때 현재 섹션에서 임계치
    // 이상 스크롤했으면 다음(또는 이전) 섹션으로 자동 완주해 고정하고, 임계치를
    // 못 넘었으면 현재 섹션으로 되돌려 고정한다. → 스크롤은 부드럽고, 손을 떼면
    // 항상 섹션 화면에 딱 멈춘다.
    let anchorIndex = 0
    let settleTimer = 0
    const SETTLE_MS = 190
    // 현재 섹션에서 이 비율(뷰포트 대비)만큼 스크롤하면 다음 섹션으로 넘긴다.
    const COMMIT_THRESHOLD_RATIO = 0.28

    const canUseSmoothScroll = () => !reduceMotion.matches && !mobileMotion.matches

    const normalizeWheelDelta = (event) => {
      const deltaUnit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1
      const normalizedDelta = event.deltaY * deltaUnit
      return clamp(normalizedDelta, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA) * WHEEL_DISTANCE_SCALE
    }

    const stopSmoothScroll = () => {
      smoothScrollActive = false
      targetScrollY = window.scrollY
      lastMotionTimestamp = null
      root.classList.remove('is-inertial-scrolling')
      if (settleTimer) { window.clearTimeout(settleTimer); settleTimer = 0 }
    }

    // 스냅 지점: 각 섹션 화면 top + 문서 맨 아래(푸터). 오름차순, 중복 제거.
    const snapPointList = () => {
      const maxScrollY = Math.max(root.scrollHeight - window.innerHeight, 0)
      const points = sections
        .map((section) => sectionMetrics.get(section.id)?.snapTop)
        .filter((top) => Number.isFinite(top))
        .map((top) => clamp(top, 0, maxScrollY))
      points.push(maxScrollY)
      return Array.from(new Set(points.map((point) => Math.round(point)))).sort((a, b) => a - b)
    }
    const nearestSnapIndex = (fromY, points) => {
      let best = 0
      let bestDistance = Infinity
      points.forEach((point, index) => {
        const distance = Math.abs(point - fromY)
        if (distance < bestDistance) { bestDistance = distance; best = index }
      })
      return best
    }

    // 대상 스냅 지점으로 기존 이징을 그대로 써서 부드럽게 글라이드.
    const glideToSnapY = (target) => {
      if (!Number.isFinite(target)) return
      targetScrollY = target
      smoothScrollActive = true
      lastMotionTimestamp = null
      root.classList.add('is-inertial-scrolling')
      if (!motionFrame) motionFrame = requestAnimationFrame(renderMotionFrame)
    }

    // 제스처가 멈추면 호출: 현재 섹션(anchor)에서 임계치 이상 스크롤했으면 그 방향의
    // 섹션으로 완주해 고정하고, 못 넘었으면 현재 섹션으로 되돌려 고정한다. 멀리
    // 스크롤했으면(여러 섹션 분량) 도달 지점에서 가장 가까운 섹션으로 커밋한다.
    const settleToSection = () => {
      settleTimer = 0
      if (!canUseSmoothScroll()) return
      const points = snapPointList()
      anchorIndex = clamp(anchorIndex, 0, points.length - 1)
      const anchorY = points[anchorIndex]
      const moved = targetScrollY - anchorY
      const threshold = window.innerHeight * COMMIT_THRESHOLD_RATIO
      let index = anchorIndex
      if (Math.abs(moved) >= threshold) {
        index = nearestSnapIndex(targetScrollY, points)
        // 임계치를 넘겼는데 반올림상 제자리면 스크롤 방향으로 최소 한 칸 이동.
        if (index === anchorIndex) index = clamp(anchorIndex + Math.sign(moved), 0, points.length - 1)
      }
      // 첫 화면(Home)과 두 번째 화면(Dashboard) 사이는 자유 스크롤로 두고, 세 번째
      // 화면부터(anchorIndex/index 1 이상 걸친 구간) 기존처럼 섹션에 딱 붙인다.
      // 이 구간에서 강제로 다시 글라이드시키면 배경 테마가 바뀌는 도중이라 눈에
      // 띄는 끊김으로 보였다.
      if (anchorIndex <= 1 && index <= 1) {
        anchorIndex = index
        return
      }
      anchorIndex = index
      glideToSnapY(points[index])
    }

    // 부드러운 자유 스크롤: 휠만큼 목표를 이동시키고, 멈추면 섹션에 정착시킨다.
    const handleSmoothWheel = (event) => {
      if (!canUseSmoothScroll() || event.defaultPrevented || event.ctrlKey) return
      const wheelDelta = normalizeWheelDelta(event)
      if (Math.abs(wheelDelta) < 0.01) return
      event.preventDefault()

      const points = snapPointList()
      const maxScrollY = points[points.length - 1]
      const currentScrollY = window.scrollY
      if (!smoothScrollActive) {
        targetScrollY = currentScrollY
        lastMotionTimestamp = null
        // 새 제스처 시작: 현재 위치에서 가장 가까운 섹션을 기준(anchor)으로 잡는다.
        anchorIndex = nearestSnapIndex(currentScrollY, points)
      } else if (Math.sign(targetScrollY - currentScrollY) !== Math.sign(wheelDelta)) {
        // 반대 방향 제스처는 밀린 거리를 소진하지 않고 즉시 반응.
        targetScrollY = currentScrollY
      }
      const maxPendingDistance = window.innerHeight * MAX_PENDING_VIEWPORT_RATIO
      targetScrollY = clamp(
        targetScrollY + wheelDelta,
        Math.max(0, currentScrollY - maxPendingDistance),
        Math.min(maxScrollY, currentScrollY + maxPendingDistance),
      )
      smoothScrollActive = true
      root.classList.add('is-inertial-scrolling')
      if (!motionFrame) motionFrame = requestAnimationFrame(renderMotionFrame)

      // 제스처가 멈추면 섹션에 정착(커밋 또는 원위치).
      if (settleTimer) window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(settleToSection, SETTLE_MS)
    }

    const closeMenu = () => {
      document.body.classList.remove('home-menu-open')
      menuToggle?.setAttribute('aria-expanded', 'false')
    }

    const hideChartTooltip = () => chartTooltip?.classList.remove('is-visible')
    const showChartTooltip = (point) => {
      if (!chart || !chartTooltip || !point) return
      const pointRect = point.getBoundingClientRect()
      const chartRect = chart.getBoundingClientRect()
      const tooltipX = clamp(pointRect.left + pointRect.width / 2 - chartRect.left, 54, chartRect.width - 54)
      const tooltipY = Math.max(28, pointRect.top - chartRect.top - 14)
      chartTooltip.textContent = `${point.dataset.attempt} · ${point.dataset.score}점`
      chartTooltip.style.left = `${tooltipX}px`
      chartTooltip.style.top = `${tooltipY}px`
      chartTooltip.classList.add('is-visible')
    }

    chartPoints.forEach((point) => {
      on(point, 'pointerenter', () => showChartTooltip(point))
      on(point, 'pointerleave', hideChartTooltip)
      on(point, 'focus', () => showChartTooltip(point))
      on(point, 'blur', hideChartTooltip)
    })

    const CHART_DRAW_DURATION_S = 3.1
    const CHART_REVEAL_WIDTH = 712
    if (chartLine && chartPoints.length) {
      chartPoints.forEach((point) => {
        const cx = Number(point.dataset.cx)
        const delay = (cx / CHART_REVEAL_WIDTH) * CHART_DRAW_DURATION_S
        point.style.setProperty('--point-delay', `${Math.max(0, delay).toFixed(3)}s`)
      })
    }

    const setActiveSection = (section) => {
      if (!section) return
      const sectionId = section.id
      activeSectionId = sectionId
      document.body.dataset.homeTheme = section.dataset.theme || 'light'
      sectionLinks.forEach((link) => {
        const isActive = link.dataset.sectionLink === sectionId
        link.classList.toggle('is-active', isActive)
        if (isActive) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      })
      if (sectionCount) sectionCount.textContent = `${section.dataset.homeSection} / 04`
    }

    const measureSections = () => {
      sectionMetrics = new Map(
        sections.map((section) => {
          // 섹션은 flex+align-items:center라 실제 화면(.home-section-inner, 100svh)이
          // 130svh 섹션 안 세로 중앙에 놓인다. 브레이크는 섹션 맨 위(빈 여백)가 아니라
          // 이 콘텐츠 화면 top에 걸려야 사진처럼 프레이밍된 위치에 정확히 멈춘다.
          const inner = section.querySelector('.home-section-inner')
          const snapTop = section.offsetTop + (inner ? inner.offsetTop : 0)
          return [
            section.id,
            { element: section, top: section.offsetTop, height: section.offsetHeight, bottom: section.offsetTop + section.offsetHeight, snapTop },
          ]
        }),
      )
    }

    const sectionAtVisualMarker = () => {
      const marker = visualScrollY + window.innerHeight * 0.48
      return (
        sections.find((section) => {
          const metric = sectionMetrics.get(section.id)
          return metric && metric.top <= marker && metric.bottom > marker
        }) || sections.at(-1)
      )
    }

    const revealProgress = (metric, lead = 0.14) => {
      if (!metric || reduceMotion.matches) return 1
      const start = metric.top + metric.height * lead
      return easeOutCubic((visualScrollY + window.innerHeight - start) / (window.innerHeight * 0.86))
    }
    const exitProgress = (metric) => {
      if (!metric || reduceMotion.matches) return 0
      const start = metric.top + metric.height * 0.56
      return easeInOut((visualScrollY - start) / Math.max(metric.height * 0.44, 1))
    }

    const updateAmbient = () => {
      const home = sectionMetrics.get('home')
      const dashboard = sectionMetrics.get('dashboard')
      const practice = sectionMetrics.get('practice')
      if (!home || !dashboard || !practice) return
      const ambientY = visualScrollY + window.innerHeight * 0.45
      const darkInStart = home.top + home.height * 0.62
      const darkInEnd = dashboard.top + dashboard.height * 0.16
      const lightInStart = dashboard.top + dashboard.height * 0.68
      const lightInEnd = practice.top + practice.height * 0.14
      const darkIn = easeInOut((ambientY - darkInStart) / Math.max(darkInEnd - darkInStart, 1))
      const lightIn = easeInOut((ambientY - lightInStart) / Math.max(lightInEnd - lightInStart, 1))
      const ambientMix = clamp(darkIn * (1 - lightIn))
      const pageProgress = clamp(visualScrollY / Math.max(root.scrollHeight - window.innerHeight, 1))
      root.style.setProperty('--ambient-rgb', rgbString(LIGHT_RGB, DARK_RGB, ambientMix))
      root.style.setProperty('--ambient-ink-rgb', rgbString(LIGHT_INK_RGB, DARK_INK_RGB, ambientMix))
      root.style.setProperty('--grid-line', gridColor(ambientMix, mix(0.055, 0.13, ambientMix)))
      root.style.setProperty('--grid-line-soft', gridColor(ambientMix, mix(0.045, 0.11, ambientMix)))
      root.style.setProperty('--grid-glow', gridColor(ambientMix, mix(0.07, 0.1, ambientMix)))
      root.style.setProperty('--ambient-light-overlay', (1 - ambientMix * 0.82).toFixed(3))
      root.style.setProperty('--ambient-orb-opacity', (0.7 - ambientMix * 0.28).toFixed(3))
      root.style.setProperty('--ambient-orb-a-x', `${Math.sin(pageProgress * Math.PI * 2) * 5.2}vw`)
      root.style.setProperty('--ambient-orb-a-y', `${-pageProgress * 11}vh`)
      root.style.setProperty('--ambient-orb-b-x', `${Math.cos(pageProgress * Math.PI * 1.7) * 4.2}vw`)
      root.style.setProperty('--ambient-orb-b-y', `${pageProgress * 8}vh`)
      document.body.dataset.homeTheme = ambientMix > 0.5 ? 'dark' : 'light'
    }

    const updateProgress = () => {
      const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 1)
      const ratio = clamp(visualScrollY / maxScroll)
      const percent = Math.round(ratio * 100)
      root.style.setProperty('--scroll-progress', ratio.toFixed(4))
      root.style.setProperty('--scroll-progress-position', `${6 + ratio * 88}%`)
      progressFill?.style.setProperty('--progress-ratio', ratio.toFixed(4))
      if (scrollPercent) scrollPercent.textContent = `${String(percent).padStart(2, '0')}%`
      progressRoot?.setAttribute('aria-valuenow', String(percent))
    }

    const updateHeroMotion = () => {
      const home = sectionMetrics.get('home')
      if (!home) return
      const raw = clamp((visualScrollY - home.top) / Math.max(home.height * 0.78, 1))
      const progress = reduceMotion.matches ? 0 : easeInOut(raw)
      const travel = mobileMotion.matches ? 0.3 : 1
      const fade = clamp((progress - 0.72) / 0.28)
      root.style.setProperty('--hero-line-1-x', `${window.innerWidth * 0.18 * progress * travel}px`)
      root.style.setProperty('--hero-line-2-x', `${window.innerWidth * 0.27 * progress * travel}px`)
      root.style.setProperty('--hero-line-2-y', `${window.innerHeight * -0.05 * progress * travel}px`)
      root.style.setProperty('--hero-line-3-x', `${window.innerWidth * 0.13 * progress * travel}px`)
      root.style.setProperty('--hero-scale', (1 - progress * 0.038).toFixed(4))
      root.style.setProperty('--hero-opacity', (1 - fade * 0.72).toFixed(3))
      setVar(heroMeta, '--hero-meta-x', `${window.innerWidth * 0.055 * progress * travel}px`)
      setVar(heroMeta, '--hero-meta-opacity', (1 - fade * 0.78).toFixed(3))
      setVar(heroCta, '--hero-cta-x', `${window.innerWidth * 0.035 * progress * travel}px`)
      setVar(heroCta, '--hero-cta-opacity', (1 - fade * 0.65).toFixed(3))
    }

    const updateDashboardMotion = () => {
      const dashboard = sectionMetrics.get('dashboard')
      if (!dashboard) return
      const reveal = revealProgress(dashboard, 0.13)
      const exit = exitProgress(dashboard)
      root.style.setProperty('--score-x', `${-96 * (1 - reveal) - exit * 26}px`)
      root.style.setProperty('--score-y', `${28 * (1 - reveal) - exit * 12}px`)
      root.style.setProperty('--score-opacity', reveal.toFixed(3))
      root.style.setProperty('--chart-x', `${118 * (1 - reveal) + exit * 32}px`)
      root.style.setProperty('--chart-y', `${34 * (1 - reveal) - exit * 10}px`)
      root.style.setProperty('--chart-opacity', reveal.toFixed(3))
      if (reveal > 0.24) score?.closest('.home-dashboard')?.classList.add('is-motion-active')
      metrics.forEach((metric, index) => {
        const staggered = easeOutCubic((reveal - index * 0.07) / Math.max(1 - index * 0.07, 0.5))
        setVar(metric, '--metric-y', `${34 * (1 - staggered)}px`)
        setVar(metric, '--metric-opacity', staggered.toFixed(3))
      })
    }

    const updateSectionMotion = () => {
      motionHeadings.forEach((heading) => {
        const section = heading.closest('[data-home-section]')
        const metric = sectionMetrics.get(section?.id)
        const reveal = revealProgress(metric, 0.12)
        const exit = exitProgress(metric)
        const horizontal = section?.id === 'practice' ? -72 * (1 - reveal) : 0
        setVar(heading, '--heading-x', `${horizontal}px`)
        setVar(heading, '--heading-y', `${46 * (1 - reveal) - exit * 16}px`)
        setVar(heading, '--heading-opacity', reveal.toFixed(3))
      })

      const practice = sectionMetrics.get('practice')
      const practiceReveal = revealProgress(practice, 0.18)
      practiceRows.forEach((row, index) => {
        const staggered = easeOutCubic((practiceReveal - index * 0.12) / Math.max(1 - index * 0.12, 0.5))
        const direction = index % 2 === 0 ? -1 : 1
        setVar(row, '--practice-row-x', `${direction * 92 * (1 - staggered)}px`)
        setVar(row, '--practice-row-y', `${24 * (1 - staggered)}px`)
        setVar(row, '--practice-row-opacity', staggered.toFixed(3))
      })

      const records = sectionMetrics.get('records')
      const recordsReveal = revealProgress(records, 0.15)
      recordRows.forEach((row, index) => {
        const staggered = easeOutCubic((recordsReveal - index * 0.075) / Math.max(1 - index * 0.075, 0.55))
        setVar(row, '--record-row-y', `${48 * (1 - staggered)}px`)
        setVar(row, '--record-row-opacity', staggered.toFixed(3))
      })

      const footerReveal = easeOutCubic((recordsReveal - 0.32) / 0.68)
      setVar(motionFooter, '--footer-y', `${34 * (1 - footerReveal)}px`)
      setVar(motionFooter, '--footer-opacity', footerReveal.toFixed(3))
    }

    const updateMotionVariables = () => {
      const currentSection = sectionAtVisualMarker()
      if (currentSection && currentSection.id !== activeSectionId) setActiveSection(currentSection)
      updateAmbient()
      updateProgress()
      updateHeroMotion()
      updateDashboardMotion()
      updateSectionMotion()
      brand?.classList.toggle('is-scrolled', visualScrollY > 32)
    }

    const renderMotionFrame = (timestamp) => {
      motionFrame = 0
      if (smoothScrollActive && canUseSmoothScroll()) {
        const currentScrollY = window.scrollY
        const distance = targetScrollY - currentScrollY
        const frameTimestamp = Number.isFinite(timestamp)
          ? timestamp
          : (lastMotionTimestamp ?? 0) + DEFAULT_FRAME_MS
        const elapsedMs = lastMotionTimestamp == null
          ? DEFAULT_FRAME_MS
          : clamp(frameTimestamp - lastMotionTimestamp, 4, MAX_FRAME_CATCH_UP_MS)
        const frameEase = 1 - Math.exp(-elapsedMs / SMOOTH_SCROLL_TIME_CONSTANT_MS)
        let easedScrollY = currentScrollY + distance * frameEase
        lastMotionTimestamp = frameTimestamp

        const reachesTargetPixel = Math.round(easedScrollY) === Math.round(targetScrollY)
        if (Math.abs(distance) <= MIN_SCROLL_DISTANCE || reachesTargetPixel) {
          window.scrollTo(0, targetScrollY)
          stopSmoothScroll()
        } else {
          // Some browsers expose only whole-pixel scroll positions. Guarantee
          // at least one pixel of progress instead of leaving a live RAF loop.
          if (Math.round(easedScrollY) === Math.round(currentScrollY)) {
            easedScrollY = currentScrollY + Math.sign(distance)
          }
          easedScrollY = distance > 0
            ? Math.min(easedScrollY, targetScrollY)
            : Math.max(easedScrollY, targetScrollY)
          window.scrollTo(0, easedScrollY)
        }
      } else if (smoothScrollActive) {
        stopSmoothScroll()
      } else {
        targetScrollY = window.scrollY
        lastMotionTimestamp = null
      }

      visualScrollY = window.scrollY
      updateMotionVariables()
      if (smoothScrollActive && !motionFrame) {
        motionFrame = requestAnimationFrame(renderMotionFrame)
      }
    }

    const scheduleMotionFrame = () => {
      if (!motionFrame) motionFrame = requestAnimationFrame(renderMotionFrame)
    }

    const handleResize = () => {
      stopSmoothScroll()
      if (measureFrame) cancelAnimationFrame(measureFrame)
      measureFrame = requestAnimationFrame(() => {
        measureFrame = 0
        measureSections()
        scheduleMotionFrame()
      })
    }

    sectionLinks.forEach((link) => {
      on(link, 'click', (event) => {
        const target = document.getElementById(link.dataset.sectionLink)
        if (!target) return
        event.preventDefault()
        stopSmoothScroll()
        const targetTop = sectionMetrics.get(target.id)?.top ?? target.offsetTop
        window.scrollTo({ top: targetTop, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
        closeMenu()
      })
    })

    if (menuToggle) {
      on(menuToggle, 'click', () => {
        const willOpen = !document.body.classList.contains('home-menu-open')
        document.body.classList.toggle('home-menu-open', willOpen)
        menuToggle.setAttribute('aria-expanded', String(willOpen))
      })
    }

    sideNav?.querySelectorAll('a:not([data-section-link])').forEach((link) => {
      on(link, 'click', closeMenu)
    })

    on(document, 'keydown', (event) => {
      if (DIRECT_SCROLL_KEYS.has(event.key)) stopSmoothScroll()
      if (event.key === 'Escape') closeMenu()
    })

    const observer = new IntersectionObserver(() => scheduleMotionFrame(), {
      rootMargin: '-20% 0px -45% 0px',
      threshold: [0.15, 0.35, 0.55],
    })
    sections.forEach((section) => observer.observe(section))

    setActiveSection(sections[0])
    measureSections()
    updateMotionVariables()

    on(window, 'scroll', scheduleMotionFrame, { passive: true })
    on(window, 'wheel', handleSmoothWheel, { passive: false })
    on(window, 'pointerdown', stopSmoothScroll, { passive: true })
    on(window, 'resize', handleResize)
    reduceMotion.addEventListener?.('change', () => {
      stopSmoothScroll()
      scheduleMotionFrame()
    }, { signal })
    mobileMotion.addEventListener?.('change', handleResize, { signal })

    cleanup = () => {
      controller.abort()
      observer.disconnect()
      if (motionFrame) cancelAnimationFrame(motionFrame)
      if (measureFrame) cancelAnimationFrame(measureFrame)
      if (settleTimer) window.clearTimeout(settleTimer)
      root.classList.remove('is-inertial-scrolling')
      delete document.body.dataset.homeTheme
      document.body.classList.remove('home-menu-open')
    }
  })

  onBeforeUnmount(() => cleanup())
}
