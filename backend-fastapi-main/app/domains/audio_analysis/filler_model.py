import sys
import wave
from dataclasses import dataclass
from pathlib import Path


MODEL_ROOT = Path(__file__).resolve().parents[3] / "models" / "filer"
MODEL_SRC = MODEL_ROOT / "src"
if MODEL_SRC.is_dir() and str(MODEL_SRC) not in sys.path:
    sys.path.insert(0, str(MODEL_SRC))


@dataclass(frozen=True, slots=True)
class FillerAnalysis:
    filler_count: int
    silence_detected: bool
    stutter_detected: bool
    silence_duration_ms: int
    average_wpm: int
    feedback: str


def analyze_filler_audio(audio_path: Path) -> FillerAnalysis:
    from app.domains.stt.service import get_model
    from presentation_coaching_audio import (
        load_wav_at_target_rate,
        measure_word_audio_from_analysis,
        silences_from_voiced_spans,
    )
    from presentation_coaching_events import (
        PAUSE_ANALYSIS_MINIMUM_SECONDS,
        analyze_events,
    )
    from presentation_coaching_filler_rescue import transcribe_with_filler_rescue
    from presentation_coaching_speech_rate_events import (
        SENTENCE_GAP_SECONDS,
        analyze_speech_rate_events,
    )
    from presentation_coaching_transcription import PRESENTATION_DISFLUENCY_PROFILE
    from presentation_coaching_types import EventKind
    from presentation_coaching_vad import vad_analysis

    model, _ = get_model()
    words = transcribe_with_filler_rescue(
        model,
        audio_path,
        PRESENTATION_DISFLUENCY_PROFILE.to_transcribe_kwargs(),
    )
    if not words:
        return FillerAnalysis(
            filler_count=0,
            silence_detected=False,
            stutter_detected=False,
            silence_duration_ms=0,
            average_wpm=0,
            feedback="분석 가능한 발화가 감지되지 않았습니다.",
        )

    samples = load_wav_at_target_rate(audio_path)
    vad_result = vad_analysis(samples)
    silences = silences_from_voiced_spans(
        vad_result.voiced_spans,
        PAUSE_ANALYSIS_MINIMUM_SECONDS,
    )
    event_analysis = analyze_events(
        words,
        silences,
        lambda span: measure_word_audio_from_analysis(samples, vad_result, span),
    )
    speech_rate_analysis = analyze_speech_rate_events(
        words,
        vad_result.voiced_spans,
        sentence_gap_seconds=SENTENCE_GAP_SECONDS,
    )
    events = (*event_analysis.events, *speech_rate_analysis.events)

    filler_count = sum(event.kind == EventKind.FILLER for event in events)
    repetition_count = sum(event.kind == EventKind.REPETITION for event in events)
    # pause_events = tuple(
    #     event
    #     for event in events
    #     if event.kind in (EventKind.PAUSE, EventKind.LONG_PAUSE, EventKind.VERY_LONG_PAUSE)
    # )
    pause_events = tuple(
        event
        for event in events
        if event.kind in (
            EventKind.LONG_PAUSE,
        )
    )
    silence_duration_ms = round(
        sum(event.end_seconds - event.start_seconds for event in pause_events) * 1000
    )

    return FillerAnalysis(
        filler_count=filler_count,
        silence_detected=bool(pause_events),
        stutter_detected=repetition_count > 0,
        silence_duration_ms=silence_duration_ms,
        average_wpm=_average_wpm(words, audio_path),
        feedback=_feedback(filler_count, len(pause_events), repetition_count),
    )


def _average_wpm(words, audio_path: Path) -> int:
    if not words:
        return 0

    start_seconds = min(word.start_seconds for word in words)
    end_seconds = max(word.end_seconds for word in words)
    duration_seconds = max(end_seconds - start_seconds, _wav_duration(audio_path), 0.0)
    if duration_seconds <= 0.0:
        return 0
    return round(len(words) / (duration_seconds / 60.0))


def _wav_duration(audio_path: Path) -> float:
    try:
        with wave.open(str(audio_path), "rb") as source:
            return source.getnframes() / source.getframerate()
    except (FileNotFoundError, wave.Error, ZeroDivisionError):
        return 0.0


def _feedback(filler_count: int, silence_count: int, repetition_count: int) -> str:
    messages: list[str] = []
    if filler_count:
        messages.append(f"추임새가 {filler_count}회 감지되었습니다.")
    if silence_count:
        messages.append(f"침묵 구간이 {silence_count}회 감지되었습니다.")
    if repetition_count:
        messages.append(f"반복/말더듬 후보가 {repetition_count}회 감지되었습니다.")
    if not messages:
        return "추임새, 침묵, 반복/말더듬 후보가 감지되지 않았습니다."
    return " ".join(messages)
