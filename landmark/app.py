from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/latest/face_landmarker.task"
)
DEFAULT_MODEL_PATH = Path("models/face_landmarker.task")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MediaPipe landmark interview face analyzer")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    parser.add_argument("--log", type=Path, default=Path("interview_log.jsonl"), help="JSONL output path")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH, help="Face Landmarker .task model path")
    parser.add_argument("--no-preview", action="store_true", help="Run without OpenCV preview window")
    parser.add_argument("--width", type=int, default=1280, help="Camera capture width")
    parser.add_argument("--height", type=int, default=720, help="Camera capture height")
    parser.add_argument("--display-width", type=int, default=1280, help="Preview window frame width")
    parser.add_argument("--console-log-interval", type=float, default=0.5, help="Seconds between console logs")
    parser.add_argument("--no-audio", action="store_true", help="Disable microphone analysis")
    parser.add_argument("--audio-device", type=int, default=None, help="sounddevice input device index")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Microphone sample rate")
    parser.add_argument("--auto-sample-rate", action="store_true", help="Use selected microphone default sample rate")
    parser.add_argument("--speech-db-threshold", type=float, default=-42.0, help="Speech volume threshold in dBFS")
    parser.add_argument("--min-detection-confidence", type=float, default=0.6)
    parser.add_argument("--min-tracking-confidence", type=float, default=0.6)
    parser.add_argument("--ppt", type=Path, default=None, help="PPT/PPTX path. Defaults to sample.pptx then sample.ppt")
    parser.add_argument("--audio", type=Path, default=None, help="Presentation audio file for STT analysis")
    parser.add_argument("--slide-events", type=Path, default=None, help="CSV with slide_index,start_time,end_time")
    parser.add_argument("--target-minutes", type=float, default=None, help="Target presentation length in minutes")
    parser.add_argument("--analyze-ppt-only", action="store_true", help="Analyze PPT without STT/audio")
    parser.add_argument("--whisper-model", type=str, default=None, help="Whisper model name for optional audio STT")
    parser.add_argument("--live-mic", action="store_true", help="Analyze presentation from the microphone in real time")
    parser.add_argument("--live-chunk-seconds", type=float, default=None, help="Seconds of microphone audio per STT chunk")
    parser.add_argument("--live-max-seconds", type=float, default=None, help="Optional maximum live analysis duration")
    return parser.parse_args()


def ensure_model(model_path: Path) -> Path:
    if model_path.exists():
        return model_path

    model_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Face Landmarker model to {model_path}...")
    urllib.request.urlretrieve(MODEL_URL, model_path)
    return model_path


def main() -> int:
    args = parse_args()
    if args.live_mic:
        from presentation_analysis.live_mic import run_live_mic_presentation_analysis

        result = run_live_mic_presentation_analysis(
            root=Path.cwd(),
            ppt_path=args.ppt,
            slide_events_path=args.slide_events,
            target_minutes=args.target_minutes,
            whisper_model=args.whisper_model,
            audio_device=args.audio_device,
            sample_rate=None if args.auto_sample_rate else args.sample_rate,
            auto_sample_rate=args.auto_sample_rate,
            speech_db_threshold=args.speech_db_threshold,
            live_chunk_seconds=args.live_chunk_seconds,
            live_max_seconds=args.live_max_seconds,
        )
        return 0 if result is not None else 1

    if should_run_presentation_analysis(args):
        from presentation_analysis import run_presentation_analysis

        result = run_presentation_analysis(
            root=Path.cwd(),
            ppt_path=args.ppt,
            audio_path=args.audio,
            slide_events_path=args.slide_events,
            target_minutes=args.target_minutes,
            analyze_ppt_only=args.analyze_ppt_only,
            whisper_model=args.whisper_model,
        )
        return 0 if result is not None else 1

    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    from interview_landmark.audio_analyzer import RealTimeAudioAnalyzer
    from interview_landmark.analyzer import InterviewFaceAnalyzer
    from interview_landmark.overlay import draw_overlay

    model_path = ensure_model(args.model)
    capture = cv2.VideoCapture(args.camera)
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open camera index {args.camera}")
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    analyzer = InterviewFaceAnalyzer()
    audio_analyzer = None
    if not args.no_audio:
        audio_analyzer = RealTimeAudioAnalyzer(
            sample_rate=None if args.auto_sample_rate else args.sample_rate,
            device=args.audio_device,
            speech_db_threshold=args.speech_db_threshold,
        )
        audio_analyzer.start()

    args.log.parent.mkdir(parents=True, exist_ok=True)

    options = vision.FaceLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=args.min_detection_confidence,
        min_face_presence_confidence=args.min_detection_confidence,
        min_tracking_confidence=args.min_tracking_confidence,
        output_face_blendshapes=True,
    )

    start_time = time.monotonic()
    last_console_log = 0.0
    try:
        with args.log.open("a", encoding="utf-8") as log_file, vision.FaceLandmarker.create_from_options(options) as landmarker:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break

                timestamp = time.time()
                timestamp_ms = int((time.monotonic() - start_time) * 1000)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = landmarker.detect_for_video(mp_image, timestamp_ms)
                audio_metrics = audio_analyzer.get_latest() if audio_analyzer else None

                metrics = None
                if result.face_landmarks:
                    metrics = analyzer.analyze(
                        landmarks=result.face_landmarks[0],
                        image_width=frame.shape[1],
                        image_height=frame.shape[0],
                        timestamp=timestamp,
                        blendshapes=result.face_blendshapes[0] if result.face_blendshapes else None,
                    )

                log_record = {"timestamp": timestamp}
                if metrics:
                    log_record["face"] = metrics.to_dict()
                if audio_metrics:
                    log_record["audio"] = audio_metrics.to_dict()
                log_file.write(json.dumps(log_record, ensure_ascii=False) + "\n")
                log_file.flush()

                if timestamp - last_console_log >= args.console_log_interval:
                    print(format_console_log(metrics, audio_metrics), flush=True)
                    last_console_log = timestamp

                if not args.no_preview:
                    preview = resize_for_display(frame, args.display_width)
                    draw_overlay(preview, result.face_landmarks, metrics, audio_metrics)
                    cv2.namedWindow("면접 표정/음성 행동 분석", cv2.WINDOW_NORMAL)
                    cv2.imshow("면접 표정/음성 행동 분석", preview)
                    key = cv2.waitKey(1) & 0xFF
                    if key in (27, ord("q")):
                        break
    finally:
        if audio_analyzer:
            audio_analyzer.stop()
        capture.release()
        if not args.no_preview:
            cv2.destroyAllWindows()
    return 0


def should_run_presentation_analysis(args: argparse.Namespace) -> bool:
    return any(
        [
            args.ppt is not None,
            args.audio is not None,
            args.slide_events is not None,
            args.target_minutes is not None,
            args.analyze_ppt_only,
            args.live_mic,
        ]
    )


def resize_for_display(frame, display_width: int):
    if display_width <= 0 or frame.shape[1] == display_width:
        return frame
    ratio = display_width / frame.shape[1]
    display_height = int(frame.shape[0] * ratio)
    return cv2.resize(frame, (display_width, display_height), interpolation=cv2.INTER_LINEAR)


def format_console_log(metrics, audio_metrics) -> str:
    timestamp = metrics.timestamp if metrics else audio_metrics.timestamp if audio_metrics else time.time()
    if metrics:
        face_events = ", ".join(metrics.events)
        face_negatives = ", ".join(metrics.negative_behaviors) if metrics.negative_behaviors else "없음"
        face_text = (
            f"감정={metrics.emotion_hint} 기쁨={metrics.joy_score:.2f} "
            f"주의={metrics.attention_score:.2f} 시선={metrics.gaze_direction} "
            f"깜빡임={metrics.blink_count}회/최근1분{metrics.blink_rate_per_minute:.0f}회 "
            f"표정행동={face_negatives} 표정이벤트={face_events}"
        )
    else:
        face_text = "얼굴=미감지"

    if audio_metrics:
        audio_negatives = ", ".join(audio_metrics.negative_behaviors) if audio_metrics.negative_behaviors else "없음"
        pitch = f"{audio_metrics.pitch_hz:.0f}Hz" if audio_metrics.pitch_hz else "미감지"
        audio_text = (
            f"음성={'발화' if audio_metrics.is_speaking else '침묵'} "
            f"볼륨={audio_metrics.volume_db:.1f}dB 피치={pitch} 톤={audio_metrics.tone_label} "
            f"말속도={audio_metrics.speech_rate_per_minute:.0f}/분({audio_metrics.speech_rate_label}) "
            f"음성행동={audio_negatives}"
        )
    else:
        audio_text = "음성=꺼짐"

    return (
        f"[{time.strftime('%H:%M:%S', time.localtime(timestamp))}] "
        f"{face_text} | {audio_text}"
    )


if __name__ == "__main__":
    raise SystemExit(main())
