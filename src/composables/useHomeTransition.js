// Home → 다른 페이지 전환(하이브리드 시그니처 모션):
//   · 우측 사이드 내비의 "모든" 글자가 일제히 위로 떠오른다.
//   · 그중 새 연습·내 기록·FAQ(+로고)는 그대로 상단 헤더 자리로 이동해 "정렬"하며 착지한다
//     (라우트가 바뀌어도 튐이 없도록, 목적지 헤더가 렌더하는 위치·크기·색으로 착지).
//   · 나머지 글자(Home·Dashboard·Script·Report·OOO님·마이페이지·로그아웃/로그인)는
//     위로 올라가며 사라진다(페이드아웃).
//
// 클론은 <body>에 직접 붙여(Vue 밖) HomeView 언마운트 후에도 살아남게 하고, 정리는
// 이동 뒤 setTimeout으로 한다(rAF는 백그라운드/비합성 환경에서 안 fire할 수 있음).
// CSS: assets/styles/global/page-transition.css (.aivo-home-transition-*).
const HOME_CHOREOGRAPHY_MS = 1600
const EXTRA_RISE_MS = 700

const textRect = (element) => {
  const range = document.createRange()
  range.selectNodeContents(element)
  const bounds = range.getBoundingClientRect()
  range.detach?.()
  return bounds.width && bounds.height ? bounds : element.getBoundingClientRect()
}

const cleanup = () => {
  document.documentElement.classList.remove('aivo-home-choreography')
  document.querySelectorAll('.aivo-home-transition-stage, .aivo-home-transition-clone').forEach((node) => node.remove())
  const backdrop = document.querySelector('.aivo-home-transition-backdrop')
  if (!backdrop) return
  backdrop.style.transition = 'opacity 260ms ease'
  backdrop.classList.remove('is-active')
  window.setTimeout(() => backdrop.remove(), 300)
}

// 시그니처 전환을 재생할 조건(데스크톱, 라이트 히어로, 모션 허용).
export const canRunHomeTransition = () =>
  document.body.classList.contains('home-page') &&
  window.matchMedia('(min-width: 761px)').matches &&
  document.body.dataset.homeTheme !== 'dark' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const runHomeExit = async (logoSrc, run) => {
  // 헤더로 착지하는 글자(+로고): 새 연습·내 기록·FAQ.
  const headerSources = Array.from(
    document.querySelectorAll(
      '.home-brand-crop[data-transition-role="logo"], .home-side-nav [data-transition-role="practice"], .home-side-nav [data-transition-role="records"], .home-side-nav [data-transition-role="faq"]',
    ),
  ).filter((source) => source.getClientRects().length)

  // 위로 올라가며 사라지는 나머지 우측 글자들.
  const extraSources = Array.from(
    document.querySelectorAll(
      [
        '.home-side-nav .home-section-nav a',
        '.home-side-nav .home-auth-links a',
        '.home-side-nav .home-auth-links span',
        '.home-side-nav .home-auth-links button',
      ].join(', '),
    ),
  ).filter((source) => source.getClientRects().length && source.textContent.trim())

  if (!headerSources.length && !extraSources.length) {
    await run()
    return
  }

  const backdrop = document.createElement('div')
  backdrop.className = 'aivo-home-transition-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')

  const stage = document.createElement('div')
  stage.className = 'aivo-home-transition-stage'
  stage.setAttribute('aria-hidden', 'true')
  stage.innerHTML = `
    <div class="aivo-home-transition-inner">
      <span class="aivo-home-transition-logo" data-aivo-transition-target="logo">
        <img src="${logoSrc}" alt="" />
      </span>
      <nav class="aivo-home-transition-nav">
        <span data-aivo-transition-target="practice" class="is-active">새 연습</span>
        <span data-aivo-transition-target="records">내 기록</span>
        <span data-aivo-transition-target="faq">FAQ</span>
      </nav>
      <span aria-hidden="true"></span>
    </div>
  `
  document.body.append(backdrop, stage)

  // 헤더 착지 글자: 클론을 "최종(헤더) 모습"으로 만들어 목적지 슬롯에 고정한 뒤,
  // 홈 위치에 겹치는 transform → transform:none 으로 애니메이트해 정확히 착지시킨다.
  const moving = headerSources.map((source) => {
    const role = source.dataset.transitionRole
    const sourceRect = role === 'logo' ? source.getBoundingClientRect() : textRect(source)
    const targetElement = stage.querySelector(`[data-aivo-transition-target="${role}"]`)
    const targetRect = role === 'logo' ? targetElement.getBoundingClientRect() : textRect(targetElement)
    const targetStyle = getComputedStyle(targetElement)
    const clone = role === 'logo' ? source.cloneNode(true) : document.createElement('span')

    if (role !== 'logo') clone.textContent = source.textContent.trim()
    clone.removeAttribute?.('href')
    clone.removeAttribute?.('id')
    clone.classList.add('aivo-home-transition-clone')

    const base = {
      position: 'fixed',
      top: `${targetRect.top}px`,
      left: `${targetRect.left}px`,
      transformOrigin: 'top left',
      opacity: '1',
    }
    if (role === 'logo') {
      Object.assign(clone.style, base, {
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
      })
    } else {
      Object.assign(clone.style, base, {
        fontFamily: targetStyle.fontFamily,
        fontSize: targetStyle.fontSize,
        fontWeight: targetStyle.fontWeight,
        lineHeight: targetStyle.lineHeight,
        letterSpacing: targetStyle.letterSpacing,
        whiteSpace: 'nowrap',
        color: getComputedStyle(source).color,
      })
    }
    document.body.append(clone)
    source.style.opacity = '0'

    const startScale = sourceRect.height / targetRect.height
    const startX = sourceRect.left - targetRect.left
    const startY = sourceRect.top - targetRect.top
    const startColor = getComputedStyle(source).color

    const frames =
      role === 'logo'
        ? [
            { transform: `translate3d(${startX}px, ${startY}px, 0) scale(${startScale})`, easing: 'cubic-bezier(.45, 0, .55, 1)' },
            { transform: 'translate3d(0, 0, 0) scale(1)' },
          ]
        : [
            // 먼저 헤더 행으로 상승(+리사이즈), 그다음 중앙으로 슬라이드하며 정렬.
            { offset: 0, transform: `translate3d(${startX}px, ${startY}px, 0) scale(${startScale})`, color: startColor, easing: 'cubic-bezier(.45, 0, .55, 1)' },
            { offset: 0.5, transform: `translate3d(${startX}px, 0, 0) scale(1)`, easing: 'cubic-bezier(.45, 0, .55, 1)' },
            { offset: 1, transform: 'translate3d(0, 0, 0) scale(1)', color: targetStyle.color },
          ]

    return { clone, animation: clone.animate(frames, { duration: HOME_CHOREOGRAPHY_MS, easing: 'linear', fill: 'both' }) }
  })

  // 나머지 글자: 제자리에서 위로 떠올라 사라진다.
  const rising = extraSources.map((source) => {
    const rect = textRect(source)
    const cs = getComputedStyle(source)
    const clone = document.createElement('span')
    clone.className = 'aivo-home-transition-clone'
    clone.textContent = source.textContent.trim()
    Object.assign(clone.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
      whiteSpace: 'nowrap',
    })
    document.body.append(clone)
    source.style.opacity = '0'

    const animation = clone.animate(
      [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(0, -52px, 0)', opacity: 0 },
      ],
      { duration: EXTRA_RISE_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' },
    )
    return { clone, animation }
  })

  const all = [...moving, ...rising]

  stage.getBoundingClientRect()
  document.documentElement.classList.add('aivo-home-choreography')
  requestAnimationFrame(() => backdrop.classList.add('is-active'))

  // 착지를 기다리되, 애니메이션이 안 끝나는 환경(백그라운드 탭 등)에서도 멈추지 않도록
  // 타임아웃 폴백으로 항상 이동이 진행되게 한다.
  const settled = Promise.all(all.map(({ animation }) => animation.finished.catch(() => null)))
  const fallback = new Promise((resolve) => window.setTimeout(resolve, HOME_CHOREOGRAPHY_MS + 250))
  await Promise.race([settled, fallback])
  stage.classList.add('is-ready')
  all.forEach(({ clone, animation }) => {
    animation.cancel()
    clone.remove()
  })

  try {
    await run()
  } finally {
    window.setTimeout(cleanup, 90)
  }
}
