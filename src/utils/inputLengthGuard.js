// 글자 수 제한(maxlength)이 걸린 입력칸의 한글(IME) 입력 보정.
//
// 증상: 상한에 도달한 뒤 계속 타이핑하면 "더 입력되지 않는다"가 아니라 이미 입력된
// 마지막 글자가 새로 누른 자모로 계속 바뀐다.
//
// 원인: 조합(composition) 중인 문자열까지 브라우저의 maxlength가 잘라낸다. 잘린
// 조합 문자열이 그대로 값에 반영되면서 확정된 마지막 글자가 덮어써진다.
// keydown에서 preventDefault로 막는 방법은 통하지 않는다 — Windows Chrome은 키를
// 렌더러(웹페이지)보다 먼저 OS IME에 넘기므로 취소해도 조합이 진행된다.
//
// 해결: 조합이 시작되면 maxlength 속성을 잠시 떼어 브라우저가 조합 문자열을 자르지
// 않게 한다(= 마지막 글자가 망가질 수 없다). 그리고 값이 상한을 넘는 순간 JS가
// 상한까지 잘라 되돌린다. 조합이 끝나면 속성을 다시 붙인다.
//
// 이렇게 하면
// - 확정된 글자는 어떤 경우에도 덮어써지지 않는다.
// - 상한에서 자모를 더 눌러도 글자 수가 늘지 않는다.
// - "가" → "각"처럼 글자 수가 늘지 않는 조합은 상한에서도 정상 동작한다.
//
// 캡처 단계 document 리스너로 모든 화면의 input/textarea에 한 번에 적용된다.

// 커서/선택 개념이 있어 길이 제한을 적용하는 입력 타입.
const GUARDED_INPUT_TYPES = new Set(['text', 'search', 'tel', 'url', 'password', 'email'])

// 문자를 만들어 내는 물리 키만. (편집·이동·기능 키는 여기에 걸리지 않는다.)
const CHARACTER_KEY_CODE = /^(Key[A-Z]|Digit\d|Numpad\d|Numpad(Add|Subtract|Multiply|Divide|Decimal|Comma)|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote|Intl(Backslash|Ro|Yen)|Space)$/

// 조합 중 maxlength를 떼어 둔 입력칸 → 원래 상한값.
const detachedLimits = new WeakMap()

const isGuardedField = (element) => {
  if (element instanceof HTMLTextAreaElement) return true
  return element instanceof HTMLInputElement && GUARDED_INPUT_TYPES.has(element.type)
}

// 조합 중에는 속성을 떼어 두므로, 그때는 기억해 둔 값을 상한으로 쓴다.
const readLimit = (element) => {
  if (detachedLimits.has(element)) return detachedLimits.get(element)
  const limit = element.maxLength
  return Number.isInteger(limit) && limit >= 0 ? limit : null
}

const isCharacterKey = (event) => {
  // code를 주는 환경(데스크톱 브라우저 전반)에서는 물리 키로 정확히 판별한다.
  if (event.code) return CHARACTER_KEY_CODE.test(event.code)
  // code가 비는 일부 모바일 IME 폴백: 조합 키와 길이 1의 일반 문자.
  if (event.key === 'Process' || event.key === 'Unidentified') return true
  return [...String(event.key ?? '')].length === 1
}

// 선택 영역을 덮어쓰는 입력은 길이가 늘지 않으므로 막지 않는다.
const hasSelection = (element) => {
  try {
    return element.selectionStart !== element.selectionEnd
  } catch {
    // email 등 selectionStart 접근이 허용되지 않는 타입.
    return false
  }
}

// 상한을 넘은 값을 잘라낸다. 잘랐으면 true.
const clampValue = (element, limit) => {
  if (element.value.length <= limit) return false
  element.value = element.value.slice(0, limit)
  try {
    element.setSelectionRange(limit, limit)
  } catch {
    // selectionRange를 지원하지 않는 타입은 커서 위치를 건드리지 않는다.
  }
  return true
}

const detachLimit = (element, limit) => {
  detachedLimits.set(element, limit)
  element.removeAttribute('maxlength')
}

const restoreLimit = (element) => {
  if (!detachedLimits.has(element)) return null
  const limit = detachedLimits.get(element)
  detachedLimits.delete(element)
  element.setAttribute('maxlength', String(limit))
  return limit
}

// 조합이 시작되면 브라우저가 조합 문자열을 자르지 못하게 maxlength를 떼어 둔다.
const onCompositionStart = (event) => {
  const element = event.target
  if (!isGuardedField(element) || detachedLimits.has(element)) return
  const limit = readLimit(element)
  if (limit === null) return
  detachLimit(element, limit)
}

// 조합이 끝나면 상한까지 잘라내고 속성을 되돌린다. (캡처 단계라 Vue의 v-model
// compositionend 핸들러보다 먼저 실행되므로, 잘린 값이 그대로 모델에 반영된다.) */
const onCompositionEnd = (event) => {
  const element = event.target
  const limit = restoreLimit(element)
  if (limit === null) return
  clampValue(element, limit)
}

const onInput = (event) => {
  const element = event.target
  if (!isGuardedField(element)) return

  const limit = readLimit(element)
  if (limit === null) return

  // 조합 중이든 아니든 상한을 넘으면 되돌린다. 조합 중이라면 이 시점에 조합이
  // 종료되므로, 넘친 글자는 화면에 남지 않고 확정된 글자는 그대로 유지된다.
  clampValue(element, limit)
}

// 조합 도중 포커스가 빠지는 경우의 안전망(브라우저에 따라 compositionend가 오지
// 않을 수 있다).
const onBlur = (event) => {
  const element = event.target
  const limit = restoreLimit(element)
  if (limit === null) return
  if (clampValue(element, limit)) {
    // 이 시점엔 감싸는 input 이벤트가 없으므로 v-model에 직접 알린다.
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

// 조합이 아닌 일반 문자 입력은 상한에서 키 자체를 막는다(커서만 움직이는 헛입력 방지).
// 조합 중인 키는 막지 않는다 — "가"→"각"처럼 글자 수가 늘지 않는 입력은 허용해야 한다.
const onKeydown = (event) => {
  const element = event.target
  if (!isGuardedField(element) || element.readOnly || element.disabled) return
  if (event.isComposing || detachedLimits.has(element)) return

  const limit = readLimit(element)
  if (limit === null) return

  // Ctrl/Cmd/Alt 조합(전체 선택·붙여넣기·되돌리기 등)은 문자 입력이 아니다.
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (!isCharacterKey(event)) return
  if (hasSelection(element)) return
  if (element.value.length < limit) return

  event.preventDefault()
}

export const installInputLengthGuard = (target = document) => {
  target.addEventListener('compositionstart', onCompositionStart, true)
  target.addEventListener('compositionend', onCompositionEnd, true)
  target.addEventListener('input', onInput, true)
  target.addEventListener('keydown', onKeydown, true)
  target.addEventListener('blur', onBlur, true)
  return () => {
    target.removeEventListener('compositionstart', onCompositionStart, true)
    target.removeEventListener('compositionend', onCompositionEnd, true)
    target.removeEventListener('input', onInput, true)
    target.removeEventListener('keydown', onKeydown, true)
    target.removeEventListener('blur', onBlur, true)
  }
}
