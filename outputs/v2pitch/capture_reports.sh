#!/usr/bin/env bash
# 실제 연습 기록(폴더 146 발표 3회 / 145 면접 2회)의 리포트 화면 캡처
set -u
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROF='C:\Users\SSAFY\AppData\Local\Temp\claude\C--Users-SSAFY-Desktop-aivo\636821cc-0697-427a-b455-fcceaab6a1ea\scratchpad\aivo_profile_copy'
OUT_WIN='C:\Users\SSAFY\AppData\Local\Temp\claude\C--Users-SSAFY-Desktop-aivo\636821cc-0697-427a-b455-fcceaab6a1ea\scratchpad\rep'
OUT_NIX="/c/Users/SSAFY/AppData/Local/Temp/claude/C--Users-SSAFY-Desktop-aivo/636821cc-0697-427a-b455-fcceaab6a1ea/scratchpad/rep"
mkdir -p "$OUT_NIX"
W=${W:-1600}; H=${H:-1000}

shot () {
  local name="$1"; local url="$2"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
    --autoplay-policy=no-user-gesture-required --virtual-time-budget=12000 \
    --user-data-dir="$PROF" --window-size=$W,$H \
    --screenshot="$OUT_WIN\\$name.png" "$url" >/dev/null 2>&1
  if [ -f "$OUT_NIX/$name.png" ]; then
    printf '  %-22s %8s bytes\n' "$name" "$(stat -c%s "$OUT_NIX/$name.png")"
  else
    printf '  %-22s FAILED\n' "$name"
  fi
}

B="https://aivo.ai.kr"
echo "capturing reports ${W}x${H} @2x"
# 폴더 상세 (시도 목록 · 점수 추이)
shot folder_pres   "$B/archive/folders/146?type=presentation"
shot folder_int    "$B/archive/folders/145?type=interview"
# 발표 리포트 3회
shot rep_pres_1    "$B/archive/detail?id=211&presentationId=113&folderId=146"
shot rep_pres_2    "$B/archive/detail?id=219&presentationId=117&folderId=146"
shot rep_pres_3    "$B/archive/detail?id=228&presentationId=124&folderId=146"
# 면접 리포트 2회
shot rep_int_1     "$B/interview/report/detail?id=105&folderId=145"
shot rep_int_2     "$B/interview/report/detail?id=109&folderId=145"
echo done
