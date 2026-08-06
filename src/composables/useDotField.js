import { onBeforeUnmount, onMounted } from 'vue'

// 홈 배경에 까는 실험적 인터랙티브 도트 효과 — 마우스 근처의 점들만 커지고
// 밝아진다. 캔버스 하나에 격자로 점을 찍어두고, 마우스가 움직일 때만
// 다시 그린다(상시 애니메이션 루프 없이도 충분히 부드럽다).
const DOT_GAP = 20
const DOT_RADIUS = 1.1
const HOVER_RADIUS = 170
const HOVER_MAX_SCALE = 2.6
const DOT_RGB = '82, 118, 223'
// 커서를 그대로 따라가면 너무 빠르고 딱딱해 보여서, 실제 그리는 위치(smoothX/Y)는
// 이 시간 상수로 커서 위치를 뒤쫓아가게 한다(홈 스크롤 이징과 같은 방식).
const SMOOTH_TIME_CONSTANT_MS = 140
const SETTLE_EPSILON_PX = 0.4

export const useDotField = (canvasRef) => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mobile = window.matchMedia('(max-width: 720px)')
  let ctx = null
  let width = 0
  let height = 0
  let pointerX = -9999
  let pointerY = -9999
  let smoothX = -9999
  let smoothY = -9999
  let lastFrameTs = null
  let drawFrame = 0
  let resizeFrame = 0

  const canActivate = () => !reduceMotion.matches && !mobile.matches

  const resize = () => {
    const canvas = canvasRef.value
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const draw = (timestamp) => {
    drawFrame = 0
    if (!ctx) return

    const elapsedMs = lastFrameTs == null ? 16 : Math.min(Math.max(timestamp - lastFrameTs, 0), 200)
    lastFrameTs = timestamp
    const ease = 1 - Math.exp(-elapsedMs / SMOOTH_TIME_CONSTANT_MS)
    smoothX += (pointerX - smoothX) * ease
    smoothY += (pointerY - smoothY) * ease

    ctx.clearRect(0, 0, width, height)
    if (canActivate()) {
      for (let y = DOT_GAP / 2; y < height; y += DOT_GAP) {
        for (let x = DOT_GAP / 2; x < width; x += DOT_GAP) {
          const dist = Math.hypot(x - smoothX, y - smoothY)
          const closeness = Math.max(0, 1 - dist / HOVER_RADIUS)
          if (closeness === 0) {
            ctx.beginPath()
            ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${DOT_RGB}, 0.14)`
            ctx.fill()
            continue
          }
          ctx.beginPath()
          ctx.arc(x, y, DOT_RADIUS * (1 + closeness * (HOVER_MAX_SCALE - 1)), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${DOT_RGB}, ${(0.14 + closeness * 0.66).toFixed(3)})`
          ctx.fill()
        }
      }
    }

    // 목표 지점에 거의 다 왔으면 루프를 멈춘다(마우스가 멈춰 있는 동안 불필요한
    // rAF를 계속 돌리지 않기 위함) — 다음 pointermove가 오면 다시 깨운다.
    const stillEasing = Math.hypot(pointerX - smoothX, pointerY - smoothY) > SETTLE_EPSILON_PX
    if (stillEasing) drawFrame = requestAnimationFrame(draw)
    else lastFrameTs = null
  }

  const scheduleDraw = () => {
    if (!drawFrame) drawFrame = requestAnimationFrame(draw)
  }

  // position:fixed 캔버스가 viewport 원점과 항상 일치하므로 clientX/Y를
  // 그대로 캔버스 좌표로 쓸 수 있다(스크롤 오프셋 보정 불필요).
  const onPointerMove = (event) => {
    pointerX = event.clientX
    pointerY = event.clientY
    scheduleDraw()
  }
  const onPointerLeave = () => {
    pointerX = -9999
    pointerY = -9999
    scheduleDraw()
  }
  const onResize = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0
      resize()
      scheduleDraw()
    })
  }

  onMounted(() => {
    const canvas = canvasRef.value
    if (!canvas) return
    ctx = canvas.getContext('2d')
    resize()
    scheduleDraw()
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave, { passive: true })
    window.addEventListener('resize', onResize)
    reduceMotion.addEventListener?.('change', scheduleDraw)
    mobile.addEventListener?.('change', scheduleDraw)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerleave', onPointerLeave)
    window.removeEventListener('resize', onResize)
    reduceMotion.removeEventListener?.('change', scheduleDraw)
    mobile.removeEventListener?.('change', scheduleDraw)
    if (drawFrame) cancelAnimationFrame(drawFrame)
    if (resizeFrame) cancelAnimationFrame(resizeFrame)
  })
}
