from __future__ import annotations

import wave
from pathlib import Path

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.models import STTAnalysis, STTSegment
from presentation_analysis.text_utils import count_words, no_space_len, repetition_ratio


def transcribe_audio_file(audio_path: Path | None, config: AnalysisConfig, model_name: str | None = None) -> STTAnalysis:
    if audio_path is None:
        return STTAnalysis.empty(
            config.default_chars_per_second,
            "오디오 파일이 없어 STT 없이 PPT 콘텐츠 분석만 수행했습니다. 발화 속도는 기본 휴리스틱 값을 사용합니다.",
        )

    if not audio_path.exists():
        return STTAnalysis.empty(
            config.default_chars_per_second,
            f"오디오 파일을 찾을 수 없습니다: {audio_path}. 발화 속도는 기본 휴리스틱 값을 사용합니다.",
        )

    warnings: list[str] = []
    segments: list[STTSegment] = []
    selected_model = model_name or config.whisper_model

    try:
        segments = _transcribe_with_faster_whisper(audio_path, selected_model)
        warnings.append("faster-whisper 세그먼트 타임스탬프를 사용했습니다.")
    except Exception as exc:
        warnings.append(f"faster-whisper를 사용할 수 없습니다: {exc}")
        try:
            segments = _transcribe_with_openai_whisper(audio_path, selected_model)
            warnings.append("openai-whisper 세그먼트 타임스탬프를 사용했습니다.")
        except Exception as whisper_exc:
            warnings.append(f"Whisper STT를 사용할 수 없습니다: {whisper_exc}")
            warnings.append("STT 없이 PPT 분석만 수행합니다. 발화 속도는 기본 휴리스틱 값입니다.")
            return STTAnalysis.empty(config.default_chars_per_second, "\n".join(warnings))

    audio_duration = _read_audio_duration(audio_path)
    return analyze_stt_segments(segments, config, audio_duration=audio_duration, warnings=warnings)


def analyze_stt_segments(
    segments: list[STTSegment],
    config: AnalysisConfig,
    audio_duration: float | None = None,
    warnings: list[str] | None = None,
) -> STTAnalysis:
    cleaned_segments = [
        STTSegment(start=max(0.0, float(segment.start)), end=max(0.0, float(segment.end)), text=segment.text.strip())
        for segment in segments
        if segment.text.strip()
    ]
    transcript = "\n".join(segment.text for segment in cleaned_segments)
    speech_duration = sum(segment.duration for segment in cleaned_segments)
    segment_end = max((segment.end for segment in cleaned_segments), default=0.0)
    total_duration = max(audio_duration or 0.0, segment_end)
    silence_duration = max(0.0, total_duration - speech_duration)
    no_space_chars = no_space_len(transcript)
    word_count = count_words(transcript)
    used_default_speed = speech_duration <= 0.0 or no_space_chars == 0
    chars_per_second = (
        config.default_chars_per_second
        if used_default_speed
        else round(no_space_chars / max(speech_duration, 0.001), 3)
    )
    words_per_minute = 0.0 if speech_duration <= 0 else round(word_count / speech_duration * 60.0, 2)
    long_pause_count = _count_long_pauses(cleaned_segments, config.long_pause_seconds)

    result_warnings = list(warnings or [])
    if used_default_speed:
        result_warnings.append("STT 발화 속도를 계산할 수 없어 기본 휴리스틱 발화 속도를 사용했습니다.")

    return STTAnalysis(
        segments=cleaned_segments,
        transcript=transcript,
        total_duration=round(total_duration, 3),
        speech_duration=round(speech_duration, 3),
        silence_duration=round(silence_duration, 3),
        silence_ratio=round(silence_duration / total_duration, 3) if total_duration > 0 else 0.0,
        char_count=len(transcript),
        no_space_char_count=no_space_chars,
        word_count=word_count,
        chars_per_second=chars_per_second,
        words_per_minute=words_per_minute,
        long_pause_count=long_pause_count,
        repetition_ratio=repetition_ratio(transcript),
        used_default_speed=used_default_speed,
        warnings=result_warnings,
    )


def _transcribe_with_faster_whisper(audio_path: Path, model_name: str) -> list[STTSegment]:
    from faster_whisper import WhisperModel  # type: ignore

    model = WhisperModel(model_name, compute_type="int8")
    segments, _info = model.transcribe(str(audio_path), language="ko")
    return [STTSegment(start=float(segment.start), end=float(segment.end), text=segment.text.strip()) for segment in segments]


def _transcribe_with_openai_whisper(audio_path: Path, model_name: str) -> list[STTSegment]:
    import whisper  # type: ignore

    model = whisper.load_model(model_name)
    result = model.transcribe(str(audio_path), language="ko")
    return [
        STTSegment(
            start=float(segment.get("start", 0.0)),
            end=float(segment.get("end", 0.0)),
            text=str(segment.get("text", "")).strip(),
        )
        for segment in result.get("segments", [])
    ]


def _count_long_pauses(segments: list[STTSegment], threshold_seconds: float) -> int:
    count = 0
    previous_end: float | None = None
    for segment in sorted(segments, key=lambda item: item.start):
        if previous_end is not None and segment.start - previous_end >= threshold_seconds:
            count += 1
        previous_end = max(previous_end or 0.0, segment.end)
    return count


def _read_audio_duration(audio_path: Path) -> float | None:
    if audio_path.suffix.lower() not in {".wav", ".wave"}:
        return None
    try:
        with wave.open(str(audio_path), "rb") as handle:
            frames = handle.getnframes()
            rate = handle.getframerate()
            return frames / float(rate) if rate else None
    except Exception:
        return None
