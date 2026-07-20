# 실시간 마이크 발표 분석

마이크로 말하는 내용을 실시간 STT로 받아 PPT 슬라이드와 매칭하려면 로컬 STT 엔진이 필요합니다.

```powershell
cd "C:\Users\YSB\Downloads\실시간 발표 피드백 AI\실시간 발표 피드백 AI\landmark"
.\.venv\Scripts\Activate.ps1
pip install faster-whisper
python app.py --ppt sample.pptx --live-mic --target-minutes 10
```

마이크 장치를 지정해야 하면 먼저 장치 번호를 확인합니다.

```powershell
python audio_check.py
python app.py --ppt sample.pptx --live-mic --audio-device 1 --target-minutes 10
```

실행 중에는 콘솔에 STT 청크, 현재 추정 슬라이드, 실제/권장시간 상태가 계속 출력됩니다. `Ctrl+C`를 누르면 최종 XML/TXT 보고서와 `logs/live_presentation_YYYYMMDD_HHMMSS.jsonl` 실시간 로그를 저장합니다.

# 발표 PPT 콘텐츠/시간 분석

이 프로젝트는 기존 실시간 얼굴/음성 지표 분석 흐름을 유지하면서, `sample.pptx` 또는 `sample.ppt`를 분석해 슬라이드별 콘텐츠 밀도와 권장 발표시간을 로그로 저장할 수 있습니다. 프론트엔드 연결이나 DB는 사용하지 않습니다.

## 설치

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

PPTX 분석에는 `python-pptx`가 필요합니다. 슬라이드 자동 매칭에는 `scikit-learn`의 character n-gram TF-IDF를 우선 사용하고, 설치되지 않은 경우 로컬 문자 n-gram 유사도 fallback을 사용합니다.

OCR은 다음 순서로 사용합니다.

1. `easyocr` (`ko`, `en`)
2. `pytesseract` (`kor+eng`, 별도 Tesseract 실행 파일 설치 필요)
3. 둘 다 사용할 수 없으면 OCR을 비활성화하고 경고만 남김

오디오 STT는 로컬 Whisper 계열 패키지가 설치되어 있을 때만 수행합니다. 우선 `faster-whisper`를 사용하고, 없으면 `openai-whisper`가 설치되어 있는지 확인합니다. 외부 유료 API나 OpenAI API는 사용하지 않습니다.

## PPT 파일 위치

기본 실행은 프로젝트 루트(`landmark`)에서 다음 순서로 파일을 찾습니다.

1. `sample.pptx`
2. `sample.ppt`

구형 `.ppt` 파일은 LibreOffice가 설치되어 있으면 headless 모드로 임시 `.pptx`로 변환해 분석합니다. LibreOffice가 없으면 `.ppt`를 `.pptx`로 변환한 뒤 다시 실행해야 합니다.

## 실행 명령

PPT만 분석:

```powershell
python app.py --ppt sample.pptx --analyze-ppt-only
```

PPT와 발표 오디오 통합 분석:

```powershell
python app.py --ppt sample.pptx --audio sample.wav --target-minutes 10
```

슬라이드 전환 기록 포함:

```powershell
python app.py --ppt sample.pptx --audio sample.wav --slide-events slide_events.csv --target-minutes 10
```

`--ppt`를 생략하면 루트의 `sample.pptx`, `sample.ppt`를 자동 탐색합니다.

## slide_events.csv 형식

```csv
slide_index,start_time,end_time
1,0.0,18.5
2,18.5,54.2
3,54.2,101.8
```

실제 슬라이드 전환시간 CSV를 제공하면 슬라이드별 실제 발표시간 정확도가 높아집니다. CSV가 없으면 STT 세그먼트와 슬라이드 텍스트의 유사도를 이용해 단조 증가 방식으로 추정하므로, 보고서의 매칭 결과는 실제 전환 로그가 아닌 추정값입니다.

## 로그 위치

분석 결과는 DB 대신 `logs` 폴더에 UTF-8 파일로 저장됩니다.

```text
logs/
├─ ppt_content_YYYYMMDD_HHMMSS.xml
├─ presentation_analysis_YYYYMMDD_HHMMSS.xml
└─ presentation_analysis_YYYYMMDD_HHMMSS.txt
```

콘텐츠 밀도 점수는 발표 품질 점수가 아니라 텍스트, 이미지, 표, 차트, 도형 수를 기반으로 콘텐츠 양을 비교하기 위한 휴리스틱 보조 지표입니다. 권장 발표시간도 규칙 기반 휴리스틱이며, 실제 발표 목적과 청중 수준에 맞게 조정해야 합니다.

# Interview Face Landmark Analyzer

MediaPipe Face Mesh landmark로 면접 중 비언어 신호를 실시간 분석하는 Python 예제입니다.

## 기능

- 웹캠 얼굴 landmark 추출
- 시선 방향 추정
- 고개 방향 및 고개 까딱임 감지
- 입술 핥기/입 주변 혀 노출 추정
- 표정 경직도 추정
- 기쁨/웃음 추정
- 눈깜빡임 이벤트 및 최근 1분 빈도 기록
- 부정적 행동 신호 콘솔/JSONL 로그 출력
- 실시간 마이크 입력 기반 음성 지표 분석
- 말 빠르기, 톤/피치, 격앙된 어조 가능성, 말 끊김, 긴 침묵, 말더듬 유사 패턴 추정
- 프레임별 JSONL 로그 저장

> 주의: 이 코드는 임상적 감정 판정기가 아닙니다. 면접 시스템에서는 `불안`, `거짓말`, `역량 부족` 같은 단정 대신 `시선 이탈 빈도`, `머리 움직임 빈도`, `표정 변화량` 같은 관찰 지표로 사용해야 합니다.

## 설치

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 실행

```powershell
python app.py
```

옵션:

```powershell
python app.py --camera 0 --log interview_log.jsonl --no-preview
```

첫 실행 시 `models/face_landmarker.task`가 없으면 MediaPipe 공식 모델 저장소에서 자동 다운로드합니다.

화면을 더 크게 보려면:

```powershell
python app.py --width 1280 --height 720 --display-width 1440
```

마이크 입력을 끄려면:

```powershell
python app.py --no-audio
```

마이크 장치를 직접 지정하려면:

```powershell
python app.py --audio-device 1
```

## 종료

미리보기 창에서 `q` 또는 `Esc`를 누르면 종료됩니다.

## 출력 지표

- `attention_score`: 카메라 정면 응시와 안정적인 머리 방향 기준 점수
- `gaze_direction`: `center`, `left`, `right`, `up`, `down`
- `head_pose`: yaw/pitch/roll 기반 방향
- `head_nod`: 고개 까딱임 감지
- `head_shake`: 좌우 고개 흔들림 감지
- `lip_lick`: 입 주변 혀 노출/입술 접촉 추정
- `expression_tension`: 입술 압축, 눈 깜박임/눈 좁힘, 낮은 표정 변화량 기반 경직 추정
- `joy_score`: MediaPipe blendshape의 미소 계열 점수 기반 기쁨/웃음 추정
- `blink_event`: 눈이 닫혔다 다시 열린 순간 감지
- `blink_count`, `blink_rate_per_minute`: 누적/최근 1분 눈깜빡임 수
- `negative_behaviors`: 시선 이탈, 고개 흔들림, 입술 압박 등 면접 중 부정적으로 해석될 수 있는 행동 신호
- `events`: 현재 프레임에서 감지된 사람이 읽기 쉬운 이벤트 목록
- `emotion_hint`: 관찰 지표 기반의 약한 힌트. 최종 감정 판정으로 사용하지 마세요.

음성 로그는 JSONL의 `audio` 필드에 저장됩니다.

- `volume_db`: 마이크 입력 볼륨
- `pitch_hz`: 감지된 기본 주파수
- `tone_label`: `low`, `normal`, `high`
- `speech_rate_per_minute`: 에너지 피크 기반 말 빠르기 추정
- `long_pause`: 긴 침묵
- `choppy_speech`: 말이 짧게 끊기는 패턴
- `stutter_like`: 짧은 발화 반복 기반 말더듬 유사 패턴
- `agitated_tone`: 큰 볼륨, 높은 톤, 빠른 말 속도가 함께 나타나는 경우
