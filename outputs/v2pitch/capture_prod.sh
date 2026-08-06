#!/usr/bin/env bash
# 프로덕션(aivo.ai.kr) 화면 캡처.
# PROFILE 환경변수에 Chrome user-data-dir 을 주면 그 프로필의 로그인 세션을 사용한다.
set -u
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="${BASE:-https://aivo.ai.kr}"
NAME="${NAME:-prod}"
OUT_WIN="C:\\Users\\SSAFY\\AppData\\Local\\Temp\\claude\\C--Users-SSAFY-Desktop-aivo\\636821cc-0697-427a-b455-fcceaab6a1ea\\scratchpad\\$NAME"
OUT_NIX="/c/Users/SSAFY/AppData/Local/Temp/claude/C--Users-SSAFY-Desktop-aivo/636821cc-0697-427a-b455-fcceaab6a1ea/scratchpad/$NAME"
mkdir -p "$OUT_NIX"

W=${W:-1600}
H=${H:-1000}
EXTRA=""
if [ -n "${PROFILE:-}" ]; then EXTRA="--user-data-dir=$PROFILE"; fi

shot () {
  local name="$1"; local p="$2"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
    --autoplay-policy=no-user-gesture-required --virtual-time-budget=9000 \
    $EXTRA --window-size=$W,$H \
    --screenshot="$OUT_WIN\\$name.png" "$BASE$p" >/dev/null 2>&1
  if [ -f "$OUT_NIX/$name.png" ]; then
    printf '  %-20s %8s bytes\n' "$name" "$(stat -c%s "$OUT_NIX/$name.png")"
  else
    printf '  %-20s FAILED\n' "$name"
  fi
}

echo "capturing $BASE ${W}x${H} @2x -> $NAME"
shot home           "/"
shot faq            "/faq"
shot login          "/login"
shot practice       "/practice"
shot pres_setup     "/presentation/setup"
shot pres_record    "/presentation/record"
shot pres_report    "/presentation/report"
shot pres_qna       "/presentation/qna"
shot int_style      "/interview/style"
shot int_questions  "/interview/questions"
shot int_record     "/interview/record"
shot int_report     "/interview/report"
shot archive        "/archive"
shot trend          "/mypage/trend"
echo done
