from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass
from math import atan2, degrees
from statistics import mean, pstdev
from typing import Deque, Iterable, Mapping, Sequence

import numpy as np


@dataclass(frozen=True)
class HeadPose:
    yaw: float
    pitch: float
    roll: float
    direction: str


@dataclass(frozen=True)
class InterviewMetrics:
    timestamp: float
    face_detected: bool
    attention_score: float
    gaze_direction: str
    gaze_x: float
    gaze_y: float
    head_pose: HeadPose
    head_nod: bool
    head_shake: bool
    blink_or_squint: bool
    blink_event: bool
    blink_count: int
    blink_rate_per_minute: float
    lip_press: bool
    lip_lick: bool
    expression_tension: float
    joy_score: float
    negative_behaviors: list[str]
    events: list[str]
    emotion_hint: str

    def to_dict(self) -> dict:
        data = asdict(self)
        return data


@dataclass(frozen=True)
class Point:
    x: float
    y: float
    z: float


class InterviewFaceAnalyzer:
    """Turns MediaPipe Face Mesh landmarks into interview-oriented signals.

    The output should be treated as behavioral telemetry, not as a definitive
    emotional or psychological diagnosis.
    """

    LEFT_EYE = (33, 133)
    RIGHT_EYE = (362, 263)
    LEFT_IRIS = (468, 469, 470, 471, 472)
    RIGHT_IRIS = (473, 474, 475, 476, 477)
    LEFT_EYE_VERTICAL = (159, 145)
    RIGHT_EYE_VERTICAL = (386, 374)

    NOSE_TIP = 1
    CHIN = 152
    FOREHEAD = 10
    LEFT_FACE = 234
    RIGHT_FACE = 454
    LEFT_MOUTH = 61
    RIGHT_MOUTH = 291
    UPPER_LIP = 13
    LOWER_LIP = 14
    TONGUE_OR_INNER_MOUTH = 17

    def __init__(self, history_seconds: float = 3.0, target_fps: int = 30) -> None:
        self.max_history = max(20, int(history_seconds * target_fps))
        self.pitch_history: Deque[tuple[float, float]] = deque(maxlen=self.max_history)
        self.yaw_history: Deque[tuple[float, float]] = deque(maxlen=self.max_history)
        self.expression_history: Deque[tuple[float, float]] = deque(maxlen=self.max_history)
        self.blink_history: Deque[float] = deque(maxlen=300)
        self.eye_was_closed = False
        self.blink_count = 0

    def analyze(
        self,
        landmarks: Sequence,
        image_width: int,
        image_height: int,
        timestamp: float,
        blendshapes: Sequence | None = None,
    ) -> InterviewMetrics:
        points = [Point(lm.x * image_width, lm.y * image_height, lm.z) for lm in landmarks]
        blendshape_scores = self._blendshape_scores(blendshapes)

        gaze_x, gaze_y, gaze_direction = self._estimate_gaze(points)
        head_pose = self._estimate_head_pose(points)
        eye_open = self._eye_open_ratio(points)
        mouth_open = self._mouth_open_ratio(points)
        mouth_width = self._distance(points[self.LEFT_MOUTH], points[self.RIGHT_MOUTH])
        lip_press = mouth_open < 0.16
        blink_or_squint = eye_open < 0.18
        blink_event = self._detect_blink_event(timestamp, blink_or_squint)
        lip_lick = self._detect_lip_lick(points, mouth_open)
        joy_score = self._joy_score(blendshape_scores, mouth_open)

        expression_signal = self._expression_signal(points, eye_open, mouth_open)
        self.expression_history.append((timestamp, expression_signal))
        self.pitch_history.append((timestamp, head_pose.pitch))
        self.yaw_history.append((timestamp, head_pose.yaw))

        head_nod = self._oscillation_detected(self.pitch_history, min_range=7.0, min_crossings=2)
        head_shake = self._oscillation_detected(self.yaw_history, min_range=9.0, min_crossings=2)
        expression_tension = self._expression_tension(lip_press, blink_or_squint, mouth_width)
        attention_score = self._attention_score(gaze_direction, head_pose, head_nod, head_shake)
        blink_rate = self._blink_rate_per_minute(timestamp)
        negative_behaviors = self._negative_behaviors(
            gaze_direction=gaze_direction,
            head_pose=head_pose,
            head_nod=head_nod,
            head_shake=head_shake,
            lip_press=lip_press,
            lip_lick=lip_lick,
            expression_tension=expression_tension,
            blink_rate_per_minute=blink_rate,
        )
        emotion_hint = self._emotion_hint(attention_score, expression_tension, lip_lick, head_nod, head_shake, joy_score)
        events = self._events(blink_event, negative_behaviors, joy_score, emotion_hint)

        return InterviewMetrics(
            timestamp=timestamp,
            face_detected=True,
            attention_score=attention_score,
            gaze_direction=gaze_direction,
            gaze_x=gaze_x,
            gaze_y=gaze_y,
            head_pose=head_pose,
            head_nod=head_nod,
            head_shake=head_shake,
            blink_or_squint=blink_or_squint,
            blink_event=blink_event,
            blink_count=self.blink_count,
            blink_rate_per_minute=blink_rate,
            lip_press=lip_press,
            lip_lick=lip_lick,
            expression_tension=expression_tension,
            joy_score=joy_score,
            negative_behaviors=negative_behaviors,
            events=events,
            emotion_hint=emotion_hint,
        )

    def _estimate_gaze(self, points: Sequence[Point]) -> tuple[float, float, str]:
        left_x = self._iris_position(points, self.LEFT_IRIS, self.LEFT_EYE)
        right_x = self._iris_position(points, self.RIGHT_IRIS, self.RIGHT_EYE)
        gaze_x = (left_x + right_x) / 2.0

        left_y = self._iris_vertical_position(points, self.LEFT_IRIS, self.LEFT_EYE_VERTICAL)
        right_y = self._iris_vertical_position(points, self.RIGHT_IRIS, self.RIGHT_EYE_VERTICAL)
        gaze_y = (left_y + right_y) / 2.0

        if gaze_x < 0.38:
            direction = "right"
        elif gaze_x > 0.62:
            direction = "left"
        elif gaze_y < 0.34:
            direction = "up"
        elif gaze_y > 0.68:
            direction = "down"
        else:
            direction = "center"
        return round(gaze_x, 3), round(gaze_y, 3), direction

    def _estimate_head_pose(self, points: Sequence[Point]) -> HeadPose:
        nose = points[self.NOSE_TIP]
        chin = points[self.CHIN]
        forehead = points[self.FOREHEAD]
        left_face = points[self.LEFT_FACE]
        right_face = points[self.RIGHT_FACE]

        face_width = max(1.0, self._distance(left_face, right_face))
        face_height = max(1.0, self._distance(forehead, chin))
        face_center_x = (left_face.x + right_face.x) / 2.0
        face_center_y = (forehead.y + chin.y) / 2.0

        yaw = ((nose.x - face_center_x) / face_width) * 75.0
        pitch = ((nose.y - face_center_y) / face_height) * 85.0
        roll = degrees(atan2(right_face.y - left_face.y, right_face.x - left_face.x))

        direction = "center"
        if yaw < -10:
            direction = "left"
        elif yaw > 10:
            direction = "right"
        elif pitch < -8:
            direction = "up"
        elif pitch > 10:
            direction = "down"
        elif abs(roll) > 8:
            direction = "tilted"

        return HeadPose(
            yaw=round(yaw, 2),
            pitch=round(pitch, 2),
            roll=round(roll, 2),
            direction=direction,
        )

    def _eye_open_ratio(self, points: Sequence[Point]) -> float:
        left_width = self._distance(points[self.LEFT_EYE[0]], points[self.LEFT_EYE[1]])
        right_width = self._distance(points[self.RIGHT_EYE[0]], points[self.RIGHT_EYE[1]])
        left_height = self._distance(points[self.LEFT_EYE_VERTICAL[0]], points[self.LEFT_EYE_VERTICAL[1]])
        right_height = self._distance(points[self.RIGHT_EYE_VERTICAL[0]], points[self.RIGHT_EYE_VERTICAL[1]])
        return ((left_height / max(left_width, 1.0)) + (right_height / max(right_width, 1.0))) / 2.0

    def _mouth_open_ratio(self, points: Sequence[Point]) -> float:
        mouth_width = self._distance(points[self.LEFT_MOUTH], points[self.RIGHT_MOUTH])
        mouth_height = self._distance(points[self.UPPER_LIP], points[self.LOWER_LIP])
        return mouth_height / max(mouth_width, 1.0)

    def _detect_lip_lick(self, points: Sequence[Point], mouth_open: float) -> bool:
        upper_lip = points[self.UPPER_LIP]
        lower_lip = points[self.LOWER_LIP]
        inner = points[self.TONGUE_OR_INNER_MOUTH]
        mouth_width = max(1.0, self._distance(points[self.LEFT_MOUTH], points[self.RIGHT_MOUTH]))
        lip_band_top = min(upper_lip.y, lower_lip.y) - mouth_width * 0.08
        lip_band_bottom = max(upper_lip.y, lower_lip.y) + mouth_width * 0.10
        centered = abs(inner.x - ((points[self.LEFT_MOUTH].x + points[self.RIGHT_MOUTH].x) / 2.0)) < mouth_width * 0.34
        near_lips = lip_band_top <= inner.y <= lip_band_bottom
        return centered and near_lips and mouth_open > 0.10

    def _expression_signal(self, points: Sequence[Point], eye_open: float, mouth_open: float) -> float:
        brow_eye_left = self._distance(points[105], points[159])
        brow_eye_right = self._distance(points[334], points[386])
        face_width = max(1.0, self._distance(points[self.LEFT_FACE], points[self.RIGHT_FACE]))
        brow_eye = ((brow_eye_left + brow_eye_right) / 2.0) / face_width
        return eye_open * 0.35 + mouth_open * 0.40 + brow_eye * 0.25

    def _detect_blink_event(self, timestamp: float, eye_closed: bool) -> bool:
        blink_event = self.eye_was_closed and not eye_closed
        self.eye_was_closed = eye_closed
        if blink_event:
            self.blink_count += 1
            self.blink_history.append(timestamp)
        return blink_event

    def _blink_rate_per_minute(self, timestamp: float) -> float:
        while self.blink_history and timestamp - self.blink_history[0] > 60.0:
            self.blink_history.popleft()
        return round(float(len(self.blink_history)), 1)

    def _joy_score(self, blendshape_scores: Mapping[str, float], mouth_open: float) -> float:
        smile_left = blendshape_scores.get("mouthSmileLeft", 0.0)
        smile_right = blendshape_scores.get("mouthSmileRight", 0.0)
        cheek_squint_left = blendshape_scores.get("cheekSquintLeft", 0.0)
        cheek_squint_right = blendshape_scores.get("cheekSquintRight", 0.0)
        mouth_open_score = max(0.0, min(1.0, mouth_open * 2.5))
        score = ((smile_left + smile_right) / 2.0) * 0.70
        score += ((cheek_squint_left + cheek_squint_right) / 2.0) * 0.15
        score += mouth_open_score * 0.15
        return round(max(0.0, min(1.0, score)), 3)

    def _expression_tension(self, lip_press: bool, blink_or_squint: bool, mouth_width: float) -> float:
        variation_score = 0.0
        if len(self.expression_history) >= 10:
            values = [value for _, value in self.expression_history]
            variation = pstdev(values)
            variation_score = max(0.0, min(1.0, 1.0 - (variation / 0.045)))

        width_score = 0.0
        if len(self.expression_history) >= 10:
            width_score = 0.2 if mouth_width > 0 else 0.0

        tension = variation_score * 0.45 + (0.30 if lip_press else 0.0) + (0.20 if blink_or_squint else 0.0) + width_score
        return round(max(0.0, min(1.0, tension)), 3)

    def _attention_score(self, gaze_direction: str, head_pose: HeadPose, head_nod: bool, head_shake: bool) -> float:
        score = 1.0
        if gaze_direction != "center":
            score -= 0.30
        if head_pose.direction != "center":
            score -= 0.25
        if abs(head_pose.roll) > 8:
            score -= 0.10
        if head_nod:
            score -= 0.08
        if head_shake:
            score -= 0.10
        return round(max(0.0, min(1.0, score)), 3)

    def _emotion_hint(
        self,
        attention_score: float,
        expression_tension: float,
        lip_lick: bool,
        head_nod: bool,
        head_shake: bool,
        joy_score: float,
    ) -> str:
        if joy_score > 0.45:
            return "joy"
        if expression_tension > 0.70 and (lip_lick or head_nod or head_shake):
            return "possible_nervousness"
        if attention_score < 0.45:
            return "possible_distraction"
        if expression_tension > 0.75:
            return "possible_tension"
        return "neutral_observation"

    def _negative_behaviors(
        self,
        gaze_direction: str,
        head_pose: HeadPose,
        head_nod: bool,
        head_shake: bool,
        lip_press: bool,
        lip_lick: bool,
        expression_tension: float,
        blink_rate_per_minute: float,
    ) -> list[str]:
        behaviors = []
        if gaze_direction != "center":
            behaviors.append("시선 이탈")
        if head_pose.direction != "center":
            behaviors.append("고개 방향 이탈")
        if head_nod:
            behaviors.append("고개 까딱임 반복")
        if head_shake:
            behaviors.append("좌우 고개 흔들림")
        if lip_lick:
            behaviors.append("입술 핥기 추정")
        if lip_press:
            behaviors.append("입술 압박")
        if expression_tension > 0.72:
            behaviors.append("표정 경직 높음")
        if blink_rate_per_minute >= 30:
            behaviors.append("눈깜빡임 많음")
        return behaviors

    def _events(
        self,
        blink_event: bool,
        negative_behaviors: Sequence[str],
        joy_score: float,
        emotion_hint: str,
    ) -> list[str]:
        events = []
        if blink_event:
            events.append("눈깜빡임")
        if joy_score > 0.45:
            events.append("기쁨/웃음 감지")
        events.extend(negative_behaviors)
        if not events and emotion_hint == "neutral_observation":
            events.append("중립 관찰")
        return events

    @staticmethod
    def _blendshape_scores(blendshapes: Sequence | None) -> dict[str, float]:
        if not blendshapes:
            return {}
        return {category.category_name: float(category.score) for category in blendshapes}

    def _iris_position(self, points: Sequence[Point], iris_indices: Iterable[int], eye_corners: tuple[int, int]) -> float:
        iris_x = mean(points[index].x for index in iris_indices)
        left = points[eye_corners[0]].x
        right = points[eye_corners[1]].x
        low = min(left, right)
        high = max(left, right)
        return max(0.0, min(1.0, (iris_x - low) / max(high - low, 1.0)))

    def _iris_vertical_position(
        self,
        points: Sequence[Point],
        iris_indices: Iterable[int],
        eye_vertical: tuple[int, int],
    ) -> float:
        iris_y = mean(points[index].y for index in iris_indices)
        top = points[eye_vertical[0]].y
        bottom = points[eye_vertical[1]].y
        low = min(top, bottom)
        high = max(top, bottom)
        return max(0.0, min(1.0, (iris_y - low) / max(high - low, 1.0)))

    def _oscillation_detected(
        self,
        history: Deque[tuple[float, float]],
        min_range: float,
        min_crossings: int,
    ) -> bool:
        if len(history) < 12:
            return False

        recent = [(ts, value) for ts, value in history if history[-1][0] - ts <= 1.2]
        if len(recent) < 8:
            return False

        values = np.array([value for _, value in recent], dtype=float)
        if float(values.max() - values.min()) < min_range:
            return False

        centered = values - float(values.mean())
        signs = np.sign(centered)
        crossings = int(np.sum(signs[1:] * signs[:-1] < 0))
        return crossings >= min_crossings

    @staticmethod
    def _distance(a: Point, b: Point) -> float:
        return float(((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5)
