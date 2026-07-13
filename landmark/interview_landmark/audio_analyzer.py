from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import asdict, dataclass
from statistics import median
from typing import Deque

import numpy as np
import sounddevice as sd


@dataclass(frozen=True)
class AudioMetrics:
    timestamp: float
    is_speaking: bool
    volume_db: float
    pitch_hz: float | None
    tone_label: str
    speech_rate_per_minute: float
    speech_rate_label: str
    pause_ratio: float
    long_pause: bool
    choppy_speech: bool
    stutter_like: bool
    agitated_tone: bool
    events: list[str]
    negative_behaviors: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


class RealTimeAudioAnalyzer:
    def __init__(
        self,
        sample_rate: int | None = 16000,
        block_seconds: float = 0.2,
        device: int | None = None,
        speech_db_threshold: float = -42.0,
    ) -> None:
        self.sample_rate = sample_rate
        self.block_seconds = block_seconds
        self.block_size = int((sample_rate or 16000) * block_seconds)
        self.device = device
        self.speech_db_threshold = speech_db_threshold
        self.lock = threading.Lock()
        self.latest = AudioMetrics(
            timestamp=time.time(),
            is_speaking=False,
            volume_db=-120.0,
            pitch_hz=None,
            tone_label="unknown",
            speech_rate_per_minute=0.0,
            speech_rate_label="unknown",
            pause_ratio=1.0,
            long_pause=False,
            choppy_speech=False,
            stutter_like=False,
            agitated_tone=False,
            events=["음성 대기"],
            negative_behaviors=[],
        )
        self.pitch_history: Deque[float] = deque(maxlen=240)
        self.syllable_times: Deque[float] = deque(maxlen=500)
        self.speech_flags: Deque[tuple[float, bool]] = deque(maxlen=300)
        self.short_burst_times: Deque[float] = deque(maxlen=80)
        self.last_syllable_time = 0.0
        self.speech_start_time: float | None = None
        self.silence_start_time = time.time()
        self.stream: sd.InputStream | None = None

    def start(self) -> None:
        if self.sample_rate is None:
            device_info = sd.query_devices(self.device, "input")
            self.sample_rate = int(device_info["default_samplerate"])
            self.block_size = int(self.sample_rate * self.block_seconds)
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            blocksize=self.block_size,
            channels=1,
            dtype="float32",
            device=self.device,
            callback=self._callback,
        )
        self.stream.start()

    def stop(self) -> None:
        if self.stream is None:
            return
        self.stream.stop()
        self.stream.close()
        self.stream = None

    def get_latest(self) -> AudioMetrics:
        with self.lock:
            return self.latest

    def _callback(self, indata, frames, callback_time, status) -> None:
        del frames, callback_time, status
        timestamp = time.time()
        samples = np.asarray(indata[:, 0], dtype=np.float32)
        metrics = self._analyze_block(samples, timestamp)
        with self.lock:
            self.latest = metrics

    def _analyze_block(self, samples: np.ndarray, timestamp: float) -> AudioMetrics:
        samples = samples - float(np.mean(samples))
        rms = float(np.sqrt(np.mean(np.square(samples))) + 1e-9)
        volume_db = round(20.0 * float(np.log10(rms)), 1)
        is_speaking = volume_db > self.speech_db_threshold
        pitch_hz = self._estimate_pitch(samples) if is_speaking else None

        if pitch_hz:
            self.pitch_history.append(pitch_hz)

        self._update_speech_segments(timestamp, is_speaking)
        if is_speaking:
            self._update_syllable_peaks(samples, timestamp, rms)

        speech_rate = self._speech_rate(timestamp)
        pause_ratio = self._pause_ratio(timestamp)
        tone_label = self._tone_label(pitch_hz)
        speech_rate_label = self._speech_rate_label(speech_rate)
        long_pause = (not is_speaking) and (timestamp - self.silence_start_time >= 1.2)
        choppy_speech = self._recent_short_bursts(timestamp) >= 3
        stutter_like = self._recent_short_bursts(timestamp) >= 4 and speech_rate >= 120
        agitated_tone = is_speaking and volume_db > -24.0 and tone_label == "high" and speech_rate_label == "fast"
        negatives = self._negative_behaviors(
            tone_label=tone_label,
            speech_rate_label=speech_rate_label,
            long_pause=long_pause,
            choppy_speech=choppy_speech,
            stutter_like=stutter_like,
            agitated_tone=agitated_tone,
        )
        events = self._events(is_speaking, pitch_hz, negatives)

        return AudioMetrics(
            timestamp=timestamp,
            is_speaking=is_speaking,
            volume_db=volume_db,
            pitch_hz=round(pitch_hz, 1) if pitch_hz else None,
            tone_label=tone_label,
            speech_rate_per_minute=round(speech_rate, 1),
            speech_rate_label=speech_rate_label,
            pause_ratio=round(pause_ratio, 3),
            long_pause=long_pause,
            choppy_speech=choppy_speech,
            stutter_like=stutter_like,
            agitated_tone=agitated_tone,
            events=events,
            negative_behaviors=negatives,
        )

    def _estimate_pitch(self, samples: np.ndarray) -> float | None:
        if len(samples) < self.sample_rate * 0.05:
            return None
        window = np.hanning(len(samples))
        corr = np.correlate(samples * window, samples * window, mode="full")[len(samples) - 1 :]
        min_lag = int(self.sample_rate / 450)
        max_lag = int(self.sample_rate / 70)
        if max_lag >= len(corr):
            return None
        segment = corr[min_lag:max_lag]
        if len(segment) == 0:
            return None
        lag = int(np.argmax(segment) + min_lag)
        confidence = float(corr[lag] / (corr[0] + 1e-9))
        if confidence < 0.28:
            return None
        return float(self.sample_rate / lag)

    def _update_speech_segments(self, timestamp: float, is_speaking: bool) -> None:
        self.speech_flags.append((timestamp, is_speaking))
        if is_speaking and self.speech_start_time is None:
            self.speech_start_time = timestamp
        if not is_speaking:
            if self.speech_start_time is not None:
                duration = timestamp - self.speech_start_time
                if 0.08 <= duration <= 0.35:
                    self.short_burst_times.append(timestamp)
                self.speech_start_time = None
            if not self.silence_start_time:
                self.silence_start_time = timestamp
        else:
            self.silence_start_time = timestamp

    def _update_syllable_peaks(self, samples: np.ndarray, timestamp: float, block_rms: float) -> None:
        frame_size = max(1, int(self.sample_rate * 0.04))
        hop = max(1, int(self.sample_rate * 0.02))
        frame_rms = []
        for start in range(0, max(1, len(samples) - frame_size), hop):
            frame = samples[start : start + frame_size]
            frame_rms.append(float(np.sqrt(np.mean(np.square(frame))) + 1e-9))

        if len(frame_rms) < 3:
            return

        threshold = max(block_rms * 1.18, 0.012)
        for index in range(1, len(frame_rms) - 1):
            if frame_rms[index] <= threshold:
                continue
            if frame_rms[index] <= frame_rms[index - 1] or frame_rms[index] <= frame_rms[index + 1]:
                continue
            peak_time = timestamp - (len(samples) / self.sample_rate) + (index * hop / self.sample_rate)
            if peak_time - self.last_syllable_time >= 0.12:
                self.syllable_times.append(peak_time)
                self.last_syllable_time = peak_time

    def _speech_rate(self, timestamp: float) -> float:
        window_seconds = 15.0
        while self.syllable_times and timestamp - self.syllable_times[0] > window_seconds:
            self.syllable_times.popleft()
        if not self.syllable_times:
            return 0.0
        active_window = max(3.0, min(window_seconds, timestamp - self.syllable_times[0]))
        return len(self.syllable_times) / active_window * 60.0

    def _pause_ratio(self, timestamp: float) -> float:
        recent = [(ts, flag) for ts, flag in self.speech_flags if timestamp - ts <= 10.0]
        if not recent:
            return 1.0
        silent = sum(1 for _, flag in recent if not flag)
        return silent / len(recent)

    def _tone_label(self, pitch_hz: float | None) -> str:
        if pitch_hz is None:
            return "unknown"
        baseline = median(self.pitch_history) if len(self.pitch_history) >= 15 else pitch_hz
        if pitch_hz >= max(260.0, baseline * 1.25):
            return "high"
        if pitch_hz <= min(120.0, baseline * 0.75):
            return "low"
        return "normal"

    @staticmethod
    def _speech_rate_label(rate: float) -> str:
        if rate >= 250:
            return "fast"
        if 0 < rate <= 90:
            return "slow"
        return "normal"

    def _recent_short_bursts(self, timestamp: float) -> int:
        while self.short_burst_times and timestamp - self.short_burst_times[0] > 5.0:
            self.short_burst_times.popleft()
        return len(self.short_burst_times)

    @staticmethod
    def _negative_behaviors(
        tone_label: str,
        speech_rate_label: str,
        long_pause: bool,
        choppy_speech: bool,
        stutter_like: bool,
        agitated_tone: bool,
    ) -> list[str]:
        behaviors = []
        if speech_rate_label == "fast":
            behaviors.append("말 빠름")
        if tone_label == "high":
            behaviors.append("높은 톤")
        if agitated_tone:
            behaviors.append("격앙된 어조 가능")
        if stutter_like:
            behaviors.append("말더듬/반복 발화 가능")
        elif choppy_speech:
            behaviors.append("말이 짧게 끊김")
        if long_pause:
            behaviors.append("긴 침묵")
        return behaviors

    @staticmethod
    def _events(is_speaking: bool, pitch_hz: float | None, negatives: list[str]) -> list[str]:
        events = ["발화 중" if is_speaking else "침묵"]
        if pitch_hz:
            events.append("피치 감지")
        events.extend(negatives)
        return events
