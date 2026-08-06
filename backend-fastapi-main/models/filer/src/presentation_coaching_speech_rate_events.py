"""Sentence-level speech-rate measurement and non-scoring change events."""

from dataclasses import dataclass
from hashlib import sha256
from statistics import median
from typing import Final, Literal

from presentation_coaching_audio import SpeechSpan, overlap_seconds
from presentation_coaching_events import FILLER_CANDIDATES, TOKEN_EDGE_PUNCTUATION
from presentation_coaching_types import CoachingEvent, EventKind, WordTiming


SENTENCE_GAP_SECONDS: Final = 0.75
MAXIMUM_COMPARISON_SEGMENT_SECONDS: Final = 6.0
MINIMUM_SEGMENT_VOICED_SECONDS: Final = 3.0
MINIMUM_SEGMENT_CONTENT_SYLLABLES: Final = 8
MINIMUM_RATE_CHANGE_SYLLABLES_PER_SECOND: Final = 1.0
MODIFIED_Z_SCORE_THRESHOLD: Final = 3.5
SENTENCE_END_PUNCTUATION: Final = ".!?\u3002\uff01\uff1f"
ComparisonRole = Literal["slowest", "fastest", "representative"]


@dataclass(frozen=True, slots=True)
class SpeechRateSegment:
    """One punctuation- or silence-delimited utterance measured with VAD time."""

    start_seconds: float
    end_seconds: float
    sentence: str
    content_syllable_count: int
    voiced_seconds: float
    syllables_per_second: float | None
    eligible_for_change_event: bool


@dataclass(frozen=True, slots=True)
class SpeechRateAnalysis:
    """All utterance rates and their presentation-relative comparison points."""

    segments: tuple[SpeechRateSegment, ...]
    overall_articulation_rate_syllables_per_second: float | None
    events: tuple[CoachingEvent, ...]


def analyze_speech_rate_events(
    words: tuple[WordTiming, ...],
    voiced_spans: tuple[SpeechSpan, ...],
    *,
    sentence_gap_seconds: float = SENTENCE_GAP_SECONDS,
    maximum_segment_seconds: float = MAXIMUM_COMPARISON_SEGMENT_SECONDS,
) -> SpeechRateAnalysis:
    """Measure utterance rates and emit non-scoring comparison points."""
    if sentence_gap_seconds < 0.0:
        raise ValueError("sentence_gap_seconds must be non-negative")
    if maximum_segment_seconds <= 0.0:
        raise ValueError("maximum_segment_seconds must be positive")
    segments = _segments(
        words,
        voiced_spans,
        sentence_gap_seconds,
        maximum_segment_seconds,
    )
    overall_articulation_rate = _overall_articulation_rate(segments)
    return SpeechRateAnalysis(
        segments,
        overall_articulation_rate,
        _change_events(segments, overall_articulation_rate),
    )


def _segments(
    words: tuple[WordTiming, ...],
    voiced_spans: tuple[SpeechSpan, ...],
    sentence_gap_seconds: float,
    maximum_segment_seconds: float,
) -> tuple[SpeechRateSegment, ...]:
    groups: list[tuple[WordTiming, ...]] = []
    current: list[WordTiming] = []
    previous_end = 0.0
    for word in words:
        starts_new_segment = current and (
            word.start_seconds - previous_end >= sentence_gap_seconds
            or word.end_seconds - current[0].start_seconds > maximum_segment_seconds
        )
        if starts_new_segment:
            groups.append(tuple(current))
            current = []
        current.append(word)
        previous_end = word.end_seconds
        if word.text.rstrip().endswith(tuple(SENTENCE_END_PUNCTUATION)):
            groups.append(tuple(current))
            current = []
    if current:
        groups.append(tuple(current))
    return tuple(_segment(group, voiced_spans) for group in groups)


def _segment(
    words: tuple[WordTiming, ...], voiced_spans: tuple[SpeechSpan, ...]
) -> SpeechRateSegment:
    start_seconds = words[0].start_seconds
    end_seconds = words[-1].end_seconds
    span = SpeechSpan(start_seconds, end_seconds)
    content_syllable_count = sum(
        _hangul_syllable_count(word.text)
        for word in words
        if _normalized_token(word.text) not in FILLER_CANDIDATES
    )
    voiced_seconds = sum(overlap_seconds(span, voiced_span) for voiced_span in voiced_spans)
    syllables_per_second = (
        content_syllable_count / voiced_seconds if voiced_seconds > 0.0 else None
    )
    eligible = (
        syllables_per_second is not None
        and voiced_seconds >= MINIMUM_SEGMENT_VOICED_SECONDS
        and content_syllable_count >= MINIMUM_SEGMENT_CONTENT_SYLLABLES
    )
    return SpeechRateSegment(
        start_seconds,
        end_seconds,
        " ".join(word.text for word in words),
        content_syllable_count,
        voiced_seconds,
        syllables_per_second,
        eligible,
    )


def _overall_articulation_rate(
    segments: tuple[SpeechRateSegment, ...],
) -> float | None:
    measured_segments = tuple(
        segment for segment in segments if segment.syllables_per_second is not None
    )
    voiced_seconds = sum(segment.voiced_seconds for segment in measured_segments)
    if voiced_seconds <= 0.0:
        return None
    return sum(segment.content_syllable_count for segment in measured_segments) / voiced_seconds


def _change_events(
    segments: tuple[SpeechRateSegment, ...],
    overall_articulation_rate: float | None,
) -> tuple[CoachingEvent, ...]:
    if overall_articulation_rate is None:
        return ()
    eligible_segments = tuple(
        segment for segment in segments if segment.eligible_for_change_event
    )
    if not eligible_segments:
        return ()
    rates = tuple(
        segment.syllables_per_second
        for segment in eligible_segments
        if segment.syllables_per_second is not None
    )
    statistical_baseline = median(rates)
    median_absolute_deviation = median(
        abs(rate - statistical_baseline) for rate in rates
    )
    slowest = min(
        eligible_segments,
        key=lambda segment: _rate_or_zero(segment),
    )
    fastest = max(
        eligible_segments,
        key=lambda segment: _rate_or_zero(segment),
    )
    if slowest is fastest:
        return (
            _event(
                slowest,
                overall_articulation_rate,
                "representative",
                statistical_baseline,
                median_absolute_deviation,
            ),
        )
    return (
        _event(
            slowest,
            overall_articulation_rate,
            "slowest",
            statistical_baseline,
            median_absolute_deviation,
        ),
        _event(
            fastest,
            overall_articulation_rate,
            "fastest",
            statistical_baseline,
            median_absolute_deviation,
        ),
    )


def _rate_or_zero(segment: SpeechRateSegment) -> float:
    return segment.syllables_per_second or 0.0


def _event(
    segment: SpeechRateSegment,
    overall_articulation_rate: float,
    comparison_role: ComparisonRole,
    statistical_baseline: float,
    median_absolute_deviation: float,
) -> CoachingEvent:
    assert segment.syllables_per_second is not None
    direction = _direction(comparison_role, segment, overall_articulation_rate)
    modified_z_score = _modified_z_score(
        segment,
        statistical_baseline,
        median_absolute_deviation,
    )
    identity = (
        f"{comparison_role}|{direction}|{segment.start_seconds:.3f}|{segment.end_seconds:.3f}|"
        f"{segment.syllables_per_second:.3f}|{overall_articulation_rate:.3f}"
    )
    return CoachingEvent(
        f"speech-rate-{sha256(identity.encode()).hexdigest()[:12]}",
        EventKind.SPEECH_RATE,
        segment.start_seconds,
        segment.end_seconds,
        segment.sentence,
        {
            "rate_direction": direction,
            "comparison_role": comparison_role,
            "syllables_per_second": segment.syllables_per_second,
            "baseline_syllables_per_second": overall_articulation_rate,
            "change_syllables_per_second": (
                segment.syllables_per_second - overall_articulation_rate
            ),
            "content_syllable_count": float(segment.content_syllable_count),
            "voiced_seconds": segment.voiced_seconds,
            "statistical_baseline_syllables_per_second": statistical_baseline,
            "modified_z_score": modified_z_score,
            "statistically_distinct": _is_statistically_distinct(
                segment,
                statistical_baseline,
                modified_z_score,
            ),
            "scoring_reflected": 0.0,
        },
        _message(direction, segment, overall_articulation_rate),
        "medium",
    )


def _direction(
    comparison_role: ComparisonRole,
    segment: SpeechRateSegment,
    overall_articulation_rate: float,
) -> str:
    if comparison_role == "representative":
        return "representative"
    if segment.syllables_per_second is not None and (
        segment.syllables_per_second > overall_articulation_rate
    ):
        return "faster"
    return "slower"


def _modified_z_score(
    segment: SpeechRateSegment,
    statistical_baseline: float,
    median_absolute_deviation: float,
) -> float | None:
    if median_absolute_deviation <= 0.0 or segment.syllables_per_second is None:
        return None
    return (
        0.6745
        * (segment.syllables_per_second - statistical_baseline)
        / median_absolute_deviation
    )


def _is_statistically_distinct(
    segment: SpeechRateSegment,
    statistical_baseline: float,
    modified_z_score: float | None,
) -> bool:
    if segment.syllables_per_second is None or modified_z_score is None:
        return False
    return (
        abs(modified_z_score) >= MODIFIED_Z_SCORE_THRESHOLD
        and abs(segment.syllables_per_second - statistical_baseline)
        >= MINIMUM_RATE_CHANGE_SYLLABLES_PER_SECOND
    )


def _message(
    direction: str,
    segment: SpeechRateSegment,
    overall_articulation_rate: float,
) -> str:
    if direction == "faster":
        return (
            f"전체 조음 속도 {overall_articulation_rate:.1f}음절/초보다 "
            f"이 구간이 {segment.syllables_per_second:.1f}음절/초로 빠릅니다."
        )
    if direction == "slower":
        return (
        f"전체 조음 속도 {overall_articulation_rate:.1f}음절/초보다 "
        f"이 구간이 {segment.syllables_per_second:.1f}음절/초로 느립니다."
    )
    return (
        f"이 발표에서 비교 가능한 문장이 하나여서 "
        f"{segment.syllables_per_second:.1f}음절/초 구간을 대표값으로 제공합니다."
    )


def _normalized_token(text: str) -> str:
    return text.strip().strip(TOKEN_EDGE_PUNCTUATION)


def _hangul_syllable_count(text: str) -> int:
    return sum("가" <= character <= "힣" for character in text)
