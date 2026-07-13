from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from mediapipe.tasks.python import vision
from PIL import Image, ImageDraw, ImageFont

from interview_landmark.audio_analyzer import AudioMetrics
from interview_landmark.analyzer import InterviewMetrics

FONT_PATHS = (
    Path("C:/Windows/Fonts/malgun.ttf"),
    Path("C:/Windows/Fonts/malgunbd.ttf"),
    Path("C:/Windows/Fonts/arial.ttf"),
)

GAZE_LABELS = {
    "center": "정면",
    "left": "왼쪽",
    "right": "오른쪽",
    "up": "위쪽",
    "down": "아래쪽",
}

HEAD_LABELS = {
    "center": "정면",
    "left": "왼쪽",
    "right": "오른쪽",
    "up": "위쪽",
    "down": "아래쪽",
    "tilted": "기울어짐",
}

EMOTION_LABELS = {
    "joy": "기쁨/웃음",
    "possible_nervousness": "긴장 가능",
    "possible_distraction": "주의 이탈 가능",
    "possible_tension": "표정 경직 가능",
    "neutral_observation": "중립",
}

TONE_LABELS = {
    "unknown": "미감지",
    "low": "낮음",
    "normal": "보통",
    "high": "높음",
}

SPEECH_RATE_LABELS = {
    "unknown": "미감지",
    "slow": "느림",
    "normal": "보통",
    "fast": "빠름",
}


def draw_overlay(
    frame,
    face_landmarks,
    metrics: InterviewMetrics | None,
    audio_metrics: AudioMetrics | None = None,
) -> None:
    if face_landmarks:
        for landmarks in face_landmarks:
            _draw_landmarks(frame, landmarks)

    lines = ["얼굴 인식 대기 중"]
    if metrics:
        negative_behaviors = ", ".join(metrics.negative_behaviors) if metrics.negative_behaviors else "없음"
        events = ", ".join(metrics.events) if metrics.events else "없음"
        lines = [
            f"감정 추정: {EMOTION_LABELS.get(metrics.emotion_hint, metrics.emotion_hint)}  기쁨 점수: {metrics.joy_score:.2f}",
            f"주의/응시 점수: {metrics.attention_score:.2f}",
            f"시선 방향: {GAZE_LABELS.get(metrics.gaze_direction, metrics.gaze_direction)}  x={metrics.gaze_x:.2f}, y={metrics.gaze_y:.2f}",
            (
                "고개 방향: "
                f"{HEAD_LABELS.get(metrics.head_pose.direction, metrics.head_pose.direction)}  "
                f"좌우={metrics.head_pose.yaw:.1f}, 상하={metrics.head_pose.pitch:.1f}, 기울기={metrics.head_pose.roll:.1f}"
            ),
            f"고개 까딱임: {_yes_no(metrics.head_nod)}  좌우 흔들림: {_yes_no(metrics.head_shake)}",
            f"눈깜빡임: 총 {metrics.blink_count}회 / 최근 1분 {metrics.blink_rate_per_minute:.0f}회",
            f"입술 핥기 추정: {_yes_no(metrics.lip_lick)}  입술 압박: {_yes_no(metrics.lip_press)}",
            f"표정 경직도: {metrics.expression_tension:.2f}",
            f"부정적 행동 신호: {negative_behaviors}",
            f"최근 이벤트: {events}",
        ]

    if audio_metrics:
        audio_negatives = ", ".join(audio_metrics.negative_behaviors) if audio_metrics.negative_behaviors else "없음"
        audio_events = ", ".join(audio_metrics.events) if audio_metrics.events else "없음"
        pitch = f"{audio_metrics.pitch_hz:.0f}Hz" if audio_metrics.pitch_hz else "미감지"
        lines.extend(
            [
                "---------------- 음성 분석 ----------------",
                f"발화 상태: {'말하는 중' if audio_metrics.is_speaking else '침묵'}  볼륨: {audio_metrics.volume_db:.1f}dB",
                f"톤/피치: {TONE_LABELS.get(audio_metrics.tone_label, audio_metrics.tone_label)}  피치: {pitch}",
                (
                    "말 빠르기: "
                    f"{audio_metrics.speech_rate_per_minute:.0f}/분 "
                    f"({SPEECH_RATE_LABELS.get(audio_metrics.speech_rate_label, audio_metrics.speech_rate_label)})"
                ),
                f"침묵 비율: {audio_metrics.pause_ratio:.2f}  긴 침묵: {_yes_no(audio_metrics.long_pause)}",
                f"말 끊김: {_yes_no(audio_metrics.choppy_speech)}  말더듬 추정: {_yes_no(audio_metrics.stutter_like)}",
                f"격앙된 어조 가능: {_yes_no(audio_metrics.agitated_tone)}",
                f"음성 부정 신호: {audio_negatives}",
                f"음성 이벤트: {audio_events}",
            ]
        )

    panel_x, panel_y, box_width = _panel_layout(frame)
    x, y = panel_x + 14, panel_y + 30
    line_height = 34
    box_height = line_height * len(lines) + 18
    box_height = min(box_height, frame.shape[0] - panel_y - 12)
    _draw_translucent_panel(frame, panel_x, panel_y, box_width, box_height)

    max_lines = max(1, (box_height - 18) // line_height)
    _draw_korean_lines(frame, lines[:max_lines], x, y, line_height)


def _draw_landmarks(frame, landmarks) -> None:
    height, width = frame.shape[:2]
    connections = []
    connections.extend(vision.FaceLandmarksConnections.FACE_LANDMARKS_CONTOURS)
    connections.extend(vision.FaceLandmarksConnections.FACE_LANDMARKS_LEFT_IRIS)
    connections.extend(vision.FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_IRIS)

    points = [(int(point.x * width), int(point.y * height)) for point in landmarks]
    for connection in connections:
        if connection.start >= len(points) or connection.end >= len(points):
            continue
        cv2.line(frame, points[connection.start], points[connection.end], (60, 210, 230), 1, cv2.LINE_AA)

    for index in (1, 33, 133, 263, 362, 468, 473, 13, 14, 61, 291):
        if index < len(points):
            cv2.circle(frame, points[index], 2, (0, 255, 120), -1, cv2.LINE_AA)


def _draw_korean_lines(frame, lines: list[str], x: int, y: int, line_height: int) -> None:
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(image)
    font = _load_font(24)
    for line in lines:
        draw.text((x, y - 22), line, font=font, fill=(255, 255, 255))
        y += line_height
    frame[:] = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def _panel_layout(frame) -> tuple[int, int, int]:
    height, width = frame.shape[:2]
    if width >= 1180:
        panel_width = min(500, width // 3)
        return width - panel_width - 12, 12, panel_width
    panel_width = width - 24
    panel_y = max(12, height - 260)
    return 12, panel_y, panel_width


def _draw_translucent_panel(frame, x: int, y: int, width: int, height: int) -> None:
    overlay = frame.copy()
    cv2.rectangle(overlay, (x, y), (x + width, y + height), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.58, frame, 0.42, 0, frame)
    cv2.rectangle(frame, (x, y), (x + width, y + height), (30, 180, 220), 1)


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_PATHS:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _yes_no(value: bool) -> str:
    return "감지" if value else "없음"
