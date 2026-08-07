# 발표 STT의 면접 동작 정합 설계

## 목표

발표 녹화의 브라우저 STT를 이미 정상 동작하는 면접 STT와 같은 사용자 경험으로 맞춘다.
발표 중 인식 중인 문장과 확정 문장을 모두 화면에 표시하고, 종료 시 남아 있는 인식 중
문장도 유실 없이 슬라이드 방문별 `text[]`에 포함한다.

## 범위

- 발표용 `useSpeechRecognition`과 `PresentationRecordView`만 변경한다.
- `InterviewRecordView`, `interviewStore`, `interviewApi`는 변경하지 않는다.
- 서버 STT나 10초 `audio-analysis` 응답을 자막 소스로 사용하지 않는다.
- 발표 완료 API와 미디어 업로드 계약은 변경하지 않는다.

## 동작

1. 발표 시작 시 Web Speech API를 `ko-KR`, `continuous`, `interimResults` 설정으로 시작한다.
2. 확정된 결과는 순서대로 final segment에 누적한다.
3. 확정 전 결과는 하나의 interim 문장으로 유지한다.
4. 실시간 발화 패널은 최근 final 문장과 현재 interim 문장을 함께 표시한다.
5. 말하기 속도는 final과 interim을 합친 현재 전체 transcript로 계산한다.
6. final 문장은 확정되는 즉시 현재 슬라이드와 경과 시각을 포함한 transcript event로 저장한다.
7. 발표 종료 시 남아 있는 interim 문장을 한 번만 확정한 뒤 transcript event로 저장한다.
8. 이미 final로 확정된 문장이나 종료 시 한 번 확정한 interim 문장을 중복 저장하지 않는다.

## 오류 처리

- Web Speech API 미지원은 기존처럼 발표 시작을 막지 않고 사용자에게 안내한다.
- `not-allowed`, `audio-capture`, `network` 등 비동기 인식 오류도 발표 화면에 표시한다.
- 음성인식 오류가 발생해도 카메라, MediaPipe, WebM/WAV 녹화와 종료 처리는 계속한다.
- 예상하지 않은 인식 종료 시 발표가 진행 중이면 면접과 동일하게 자동 재시작한다.
- 사용자가 일시정지하거나 발표를 종료한 경우에는 자동 재시작하지 않는다.

## 데이터 흐름

```text
SpeechRecognition result
  ├─ final   → finalSegments → 화면 → transcriptEvents
  └─ interim → interimText   → 화면/WPM
                            └→ 종료 시 flush → transcriptEvents

transcriptEvents + slideTimeline
  → buildSlideVisitText()
  → 슬라이드 방문별 text[]
```

## 검증

- interim 결과가 실시간 발화 패널에 보이는지 검증한다.
- final 결과가 슬라이드와 시각을 포함해 한 번만 저장되는지 검증한다.
- 종료 직전 interim 결과가 한 번만 확정·저장되는지 검증한다.
- 명시적 정지 후에는 인식기가 재시작되지 않는지 검증한다.
- 예상하지 않은 종료 후에는 인식기가 재시작되는지 검증한다.
- STT 오류가 사용자에게 노출되면서 녹화 종료는 가능한지 검증한다.
- 생성된 `text[]`가 재방문 슬라이드를 덮어쓰지 않고 별도 객체로 유지되는지 검증한다.

## 완료 조건

- 발표 중 말한 내용이 실시간 발화 패널에 표시된다.
- 발화가 존재하면 말하기 속도가 계산된다.
- 발표 종료 결과의 `text[]`에 슬라이드별 발화가 포함된다.
- 면접 관련 소스의 diff가 0건이다.
- 관련 단위 테스트, 전체 테스트와 프로덕션 빌드가 통과한다.
