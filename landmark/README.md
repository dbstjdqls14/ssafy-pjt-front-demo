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
