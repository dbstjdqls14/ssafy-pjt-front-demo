#!/usr/bin/env bash
# 실제 서비스 화면을 헤드리스 Chrome 으로 캡처
# 녹화 화면은 카메라가 필요하므로 fake device 를 붙여 UI 가 뜨게 한다.
set -u
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="http://127.0.0.1:5177"
OUT_WIN='C:\Users\SSAFY\AppData\Local\Temp\claude\C--Users-SSAFY-Desktop-aivo\636821cc-0697-427a-b455-fcceaab6a1ea\scratchpad\shots'
OUT_NIX="/c/Users/SSAFY/AppData/Local/Temp/claude/C--Users-SSAFY-Desktop-aivo/636821cc-0697-427a-b455-fcceaab6a1ea/scratchpad/shots"
mkdir -p "$OUT_NIX"

W=${W:-1600}
H=${H:-1000}

shot () {  # shot <name> <path>
  local name="$1"; local p="$2"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
    --autoplay-policy=no-user-gesture-required \
    --virtual-time-budget=6000 \
    --window-size=$W,$H \
    --screenshot="$OUT_WIN\\$name.png" \
    "$BASE$p" >/dev/null 2>&1
  if [ -f "$OUT_NIX/$name.png" ]; then
    printf '  %-24s %s\n' "$name" "$(stat -c%s "$OUT_NIX/$name.png") bytes"
  else
    printf '  %-24s FAILED\n' "$name"
  fi
}

echo "capturing ${W}x${H} @2x ..."
shot home              "/"
shot practice          "/practice"
shot pres_setup        "/presentation/setup"
shot pres_slides       "/presentation/slides"
shot pres_check        "/presentation/check"
shot pres_record       "/presentation/record"
shot pres_qna          "/presentation/qna"
shot pres_report       "/presentation/report"
shot int_style         "/interview/style"
shot int_questions     "/interview/questions"
shot int_record        "/interview/record"
shot int_report        "/interview/report"
shot archive           "/archive"
echo done
