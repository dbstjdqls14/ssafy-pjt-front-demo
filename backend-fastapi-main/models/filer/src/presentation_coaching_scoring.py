"""Transparent evidence-based aggregation for presentation fluency feedback."""

from dataclasses import dataclass
from math import ceil, floor
from typing import Final

from presentation_coaching_delivery_metrics import DeliveryMetrics
from presentation_coaching_types import CoachingEvent, EventKind


FILLER_MAXIMUM_PENALTY: Final = 20
REPETITION_STUTTER_MAXIMUM_PENALTY: Final = 25
LONG_PAUSE_MAXIMUM_PENALTY: Final = 15
ELONGATION_MAXIMUM_PENALTY: Final = 10
SPEAKING_RATE_MAXIMUM_PENALTY: Final = 10
MONOTONE_MAXIMUM_PENALTY: Final = 10
VOCAL_INSTABILITY_MAXIMUM_PENALTY: Final = 0
MINIMUM_ACCEPTABLE_FILLERS_PER_100_SYLLABLES: Final = 1.0
SLOW_SPEAKING_RATE_SYLLABLES_PER_SECOND: Final = 4.0
FAST_SPEAKING_RATE_SYLLABLES_PER_SECOND: Final = 5.67
MONOTONE_PITCH_RANGE_SEMITONES: Final = 3.0


@dataclass(frozen=True, slots=True)
class ScoreComponent:
    """One disclosed raw measurement and its bounded contribution to the score."""

    key: str
    maximum_penalty: int
    applied_penalty: int
    raw_value: float | None
    unit: str
    evidence: str


@dataclass(frozen=True, slots=True)
class EvidenceBasedScore:
    """The seven-component presentation delivery score."""

    value: int
    maximum_value: int
    components: tuple[ScoreComponent, ...]

    def component(self, key: str) -> ScoreComponent:
        """Return a component identified by its stable machine key."""
        for component in self.components:
            if component.key == key:
                return component
        raise KeyError(key)


def build_evidence_based_score(
    events: tuple[CoachingEvent, ...],
    delivery_metrics: DeliveryMetrics,
    recording_seconds: float,
) -> EvidenceBasedScore:
    """Convert detected events and acoustic metrics into a disclosed 100-point score."""
    content_syllables = max(1, delivery_metrics.content_syllable_count)
    filler_events = _events_of_kind(events, EventKind.FILLER)
    repetition_events = _events_of_kind(events, EventKind.REPETITION)
    long_pause_events = _events_of_kind(events, EventKind.LONG_PAUSE)
    very_long_pause_events = _events_of_kind(events, EventKind.VERY_LONG_PAUSE)
    elongation_events = _events_of_kind(events, EventKind.ELONGATION)
    components = (
        _filler_component(len(filler_events), content_syllables),
        _repetition_component(repetition_events, content_syllables),
        _long_pause_component(
            long_pause_events, very_long_pause_events, recording_seconds
        ),
        _elongation_component(len(elongation_events), content_syllables),
        _speaking_rate_component(
            delivery_metrics.speaking_rate_syllables_per_second,
            delivery_metrics.speech_span_seconds,
        ),
        _monotone_component(delivery_metrics.pitch_range_semitones),
        _vocal_instability_component(delivery_metrics.vocal_instability_index),
    )
    return EvidenceBasedScore(
        value=max(0, 100 - sum(component.applied_penalty for component in components)),
        maximum_value=100,
        components=components,
    )


def _events_of_kind(
    events: tuple[CoachingEvent, ...], kind: EventKind
) -> tuple[CoachingEvent, ...]:
    return tuple(event for event in events if event.kind is kind)


def _filler_component(count: int, content_syllables: int) -> ScoreComponent:
    rate = 100.0 * count / content_syllables
    penalty = _bounded_round(
        (rate - MINIMUM_ACCEPTABLE_FILLERS_PER_100_SYLLABLES) * 2.0,
        FILLER_MAXIMUM_PENALTY,
    )
    return ScoreComponent(
        "filler",
        FILLER_MAXIMUM_PENALTY,
        penalty,
        round(rate, 2),
        "events_per_100_syllables",
        f"count={count};content_syllables={content_syllables}",
    )


def _repetition_component(
    events: tuple[CoachingEvent, ...], content_syllables: int
) -> ScoreComponent:
    rate = 100.0 * len(events) / content_syllables
    longest_durations = sorted(
        (event.end_seconds - event.start_seconds for event in events), reverse=True
    )[:3]
    mean_longest_three_seconds = (
        sum(longest_durations) / len(longest_durations) if longest_durations else 0.0
    )
    penalty = min(
        REPETITION_STUTTER_MAXIMUM_PENALTY,
        _bounded_round(rate * 5.0, 20) + _bounded_round(mean_longest_three_seconds * 4.0, 5),
    )
    return ScoreComponent(
        "repetition_stutter",
        REPETITION_STUTTER_MAXIMUM_PENALTY,
        penalty,
        round(rate, 2),
        "events_per_100_syllables",
        f"count={len(events)};mean_longest_three_seconds={mean_longest_three_seconds:.2f}",
    )


def _long_pause_component(
    long_candidate_events: tuple[CoachingEvent, ...],
    very_long_events: tuple[CoachingEvent, ...],
    recording_seconds: float,
) -> ScoreComponent:
    total_seconds = sum(
        event.end_seconds - event.start_seconds
        for event in (*long_candidate_events, *very_long_events)
    )
    pause_ratio_percent = 100.0 * total_seconds / max(recording_seconds, 0.001)
    penalty = min(
        LONG_PAUSE_MAXIMUM_PENALTY,
        len(long_candidate_events)
        + sum(
            3 + floor((event.end_seconds - event.start_seconds - 1.5) / 0.5)
            for event in very_long_events
        ),
    )
    return ScoreComponent(
        "long_pause",
        LONG_PAUSE_MAXIMUM_PENALTY,
        penalty,
        round(pause_ratio_percent, 2),
        "percent_of_recording",
        "long_candidate_count="
        f"{len(long_candidate_events)};very_long_count={len(very_long_events)};"
        f"total_seconds={total_seconds:.2f};"
        "policy=1_point_per_1.0_to_1.49_second_pause,"
        "3_points_per_1.5_second_pause_plus_1_per_additional_0.5_seconds",
    )


def _elongation_component(count: int, content_syllables: int) -> ScoreComponent:
    rate = 100.0 * count / content_syllables
    return ScoreComponent(
        "elongation",
        ELONGATION_MAXIMUM_PENALTY,
        min(ELONGATION_MAXIMUM_PENALTY, count * 3),
        round(rate, 2),
        "events_per_100_syllables",
        f"count={count};content_syllables={content_syllables}",
    )


def _speaking_rate_component(
    syllables_per_second: float, speech_span_seconds: float
) -> ScoreComponent:
    if speech_span_seconds <= 0.0:
        return ScoreComponent(
            "speaking_rate",
            SPEAKING_RATE_MAXIMUM_PENALTY,
            0,
            None,
            "syllables_per_second",
            "measurement_unavailable",
        )
    deviation = max(
        SLOW_SPEAKING_RATE_SYLLABLES_PER_SECOND - syllables_per_second,
        syllables_per_second - FAST_SPEAKING_RATE_SYLLABLES_PER_SECOND,
        0.0,
    )
    return ScoreComponent(
        "speaking_rate",
        SPEAKING_RATE_MAXIMUM_PENALTY,
        _bounded_round(deviation * 4.0, SPEAKING_RATE_MAXIMUM_PENALTY),
        round(syllables_per_second, 2),
        "syllables_per_second",
        "acceptable_range="
        f"{SLOW_SPEAKING_RATE_SYLLABLES_PER_SECOND:.2f}-"
        f"{FAST_SPEAKING_RATE_SYLLABLES_PER_SECOND:.2f};metric=speaking_rate",
    )


def _monotone_component(pitch_range_semitones: float | None) -> ScoreComponent:
    if pitch_range_semitones is None:
        return ScoreComponent(
            "monotone",
            MONOTONE_MAXIMUM_PENALTY,
            0,
            None,
            "semitones",
            "measurement_unavailable",
        )
    penalty = _bounded_round(
        (MONOTONE_PITCH_RANGE_SEMITONES - pitch_range_semitones)
        / MONOTONE_PITCH_RANGE_SEMITONES
        * MONOTONE_MAXIMUM_PENALTY,
        MONOTONE_MAXIMUM_PENALTY,
    )
    return ScoreComponent(
        "monotone",
        MONOTONE_MAXIMUM_PENALTY,
        penalty,
        round(pitch_range_semitones, 2),
        "semitones",
        f"minimum_range={MONOTONE_PITCH_RANGE_SEMITONES:.1f}",
    )


def _vocal_instability_component(vocal_instability_index: float | None) -> ScoreComponent:
    if vocal_instability_index is None:
        return ScoreComponent(
            "vocal_instability",
            VOCAL_INSTABILITY_MAXIMUM_PENALTY,
            0,
            None,
            "index_0_to_1",
            "reference_only_tension_voice_instability;measurement_unavailable",
        )
    return ScoreComponent(
        "vocal_instability",
        VOCAL_INSTABILITY_MAXIMUM_PENALTY,
        0,
        round(vocal_instability_index, 3),
        "index_0_to_1",
        "reference_only_tension_voice_instability",
    )


def _bounded_round(value: float, maximum: int) -> int:
    return min(maximum, max(0, ceil(value)))
