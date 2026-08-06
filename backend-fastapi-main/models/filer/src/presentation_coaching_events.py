"""Evidence-based Korean speech-event detection for presentation coaching."""

from dataclasses import dataclass
from hashlib import sha256
from itertools import pairwise
from string import punctuation
from typing import Final, Mapping, Protocol, assert_never
from unicodedata import normalize

from presentation_coaching_audio import AcousticFeatures, SpeechSpan
from presentation_coaching_types import CoachingEvent, EventKind, WordTiming


FILLER_CANDIDATE_SET_VERSION: Final = "ko-v2"
FILLER_CANDIDATES: Final = frozenset(
    {"\uc544", "\uc74c", "\uc5b4", "\uadf8", "\uc544\uc544", "\uc74c\uc74c", "\uc5b4\uc5b4"}
)
ELONGATION_MINIMUM_SECONDS: Final = 0.85
ELONGATION_MINIMUM_SECONDS_PER_HANGUL_SYLLABLE: Final = 0.5
PAUSE_ANALYSIS_MINIMUM_SECONDS: Final = 0.25
LONG_PAUSE_MINIMUM_SECONDS: Final = 1.0
VERY_LONG_PAUSE_MINIMUM_SECONDS: Final = 1.5
REPETITION_MAXIMUM_GAP_SECONDS: Final = 0.8
RESTART_MAXIMUM_GAP_SECONDS: Final = 0.5
TOKEN_EDGE_PUNCTUATION: Final = punctuation + "\u2026\u00b7\u3002\uff01\uff1f\u201c\u201d\u2018\u2019"


class WordFeatureReader(Protocol):
    """Reads acoustic evidence for the exact ASR word span."""

    def __call__(self, word_span: SpeechSpan) -> AcousticFeatures:
        """Return VAD, continuity, and pitch evidence for one word."""


@dataclass(frozen=True, slots=True)
class EventDraft:
    """Unpersisted event evidence before a stable ID and coaching text are added."""

    kind: EventKind
    span: SpeechSpan
    text: str
    evidence: Mapping[str, str | float]
    confidence: str


@dataclass(frozen=True, slots=True)
class RepetitionDetectionDiagnostics:
    """Counts the transcript conditions considered for lexical repetition."""

    detected_count: int
    lexical_adjacent_pair_count: int
    skipped_filler_pair_count: int
    timestamp_overlap_pair_count: int


@dataclass(frozen=True, slots=True)
class ElongationDetectionDiagnostics:
    """Counts each conservative gate used for elongation candidates."""

    detected_count: int
    duration_gate_word_count: int
    syllable_duration_gate_word_count: int
    acoustic_rejected_word_count: int


@dataclass(frozen=True, slots=True)
class PauseDetectionDiagnostics:
    """Summarizes VAD-confirmed pauses before scoring thresholds are applied."""

    general_pause_count: int
    long_pause_count: int
    very_long_pause_count: int
    longest_vad_pause_seconds: float


@dataclass(frozen=True, slots=True)
class EventDetectionDiagnostics:
    """Evidence explaining detected and non-detected fluency event counts."""

    repetition: RepetitionDetectionDiagnostics
    elongation: ElongationDetectionDiagnostics
    pause: PauseDetectionDiagnostics


@dataclass(frozen=True, slots=True)
class EventDetectionResult:
    """Detected coaching events together with their decision evidence."""

    events: tuple[CoachingEvent, ...]
    diagnostics: EventDetectionDiagnostics


def detect_events(
    words: tuple[WordTiming, ...],
    vad_confirmed_silences: tuple[SpeechSpan, ...],
    read_word_features: WordFeatureReader,
) -> tuple[CoachingEvent, ...]:
    """Detect conservative coaching events from ASR, VAD, and acoustic evidence."""
    return analyze_events(words, vad_confirmed_silences, read_word_features).events


def analyze_events(
    words: tuple[WordTiming, ...],
    vad_confirmed_silences: tuple[SpeechSpan, ...],
    read_word_features: WordFeatureReader,
) -> EventDetectionResult:
    """Return coaching events and the gate counts that explain zero-value metrics."""
    repetition_drafts = _repetition_drafts(words)
    elongation_drafts, elongation_diagnostics = _elongation_drafts(
        words, read_word_features
    )
    pause_drafts = _pause_drafts(words, vad_confirmed_silences)
    drafts = (
        *_filler_drafts(words),
        *repetition_drafts,
        *elongation_drafts,
        *pause_drafts,
    )
    events = tuple(
        _event(draft)
        for draft in sorted(
            drafts,
            key=lambda draft: (
                draft.span.start_seconds,
                draft.span.end_seconds,
                draft.kind.value,
                draft.text,
            ),
        )
    )
    pause_durations = tuple(
        silence.end_seconds - silence.start_seconds
        for silence in vad_confirmed_silences
        if silence.end_seconds - silence.start_seconds >= PAUSE_ANALYSIS_MINIMUM_SECONDS
    )
    return EventDetectionResult(
        events,
        EventDetectionDiagnostics(
            _repetition_diagnostics(words, repetition_drafts),
            elongation_diagnostics,
            PauseDetectionDiagnostics(
                sum(draft.kind is EventKind.PAUSE for draft in pause_drafts),
                sum(
                    draft.kind in (EventKind.LONG_PAUSE, EventKind.VERY_LONG_PAUSE)
                    for draft in pause_drafts
                ),
                sum(draft.kind is EventKind.VERY_LONG_PAUSE for draft in pause_drafts),
                max(pause_durations, default=0.0),
            ),
        ),
    )


def _filler_drafts(words: tuple[WordTiming, ...]) -> tuple[EventDraft, ...]:
    return tuple(
        EventDraft(
            EventKind.FILLER,
            SpeechSpan(word.start_seconds, word.end_seconds),
            normalized,
            {
                "candidate_set_version": FILLER_CANDIDATE_SET_VERSION,
                "normalized_token": normalized,
            },
            "high",
        )
        for word in words
        if (normalized := _normalized_token(word.text)) in FILLER_CANDIDATES
    )


def _repetition_drafts(words: tuple[WordTiming, ...]) -> tuple[EventDraft, ...]:
    return (*_word_repetition_drafts(words), *_phrase_repetition_drafts(words), *_restart_drafts(words), *_self_repair_drafts(words))


def _repetition_diagnostics(
    words: tuple[WordTiming, ...], drafts: tuple[EventDraft, ...]
) -> RepetitionDetectionDiagnostics:
    normalized_pairs = tuple(
        (previous, following, _normalized_token(previous.text), _normalized_token(following.text))
        for previous, following in pairwise(words)
    )
    lexical_pairs = tuple(
        pair
        for pair in normalized_pairs
        if pair[2]
        and pair[3]
        and pair[2] not in FILLER_CANDIDATES
        and pair[3] not in FILLER_CANDIDATES
    )
    return RepetitionDetectionDiagnostics(
        len(drafts),
        len(lexical_pairs),
        sum(
            first_token in FILLER_CANDIDATES or second_token in FILLER_CANDIDATES
            for _, _, first_token, second_token in normalized_pairs
            if first_token and second_token
        ),
        sum(
            following.start_seconds < previous.end_seconds
            for previous, following, _, _ in normalized_pairs
        ),
    )


def _word_repetition_drafts(words: tuple[WordTiming, ...]) -> tuple[EventDraft, ...]:
    return tuple(
        EventDraft(
            EventKind.REPETITION,
            SpeechSpan(previous.start_seconds, following.end_seconds),
            f"{previous_token} {following_token}",
            {
                "gap_seconds": following.start_seconds - previous.end_seconds,
                "normalized_token": previous_token,
                "repetition_unit": "word",
            },
            "high" if following.start_seconds - previous.end_seconds <= 0.35 else "medium",
        )
        for previous, following in pairwise(words)
        if (previous_token := _normalized_token(previous.text))
        and previous_token == _normalized_token(following.text)
        and previous_token not in FILLER_CANDIDATES
        and 0.0 <= following.start_seconds - previous.end_seconds <= REPETITION_MAXIMUM_GAP_SECONDS
        if (following_token := _normalized_token(following.text))
    )


def _phrase_repetition_drafts(words: tuple[WordTiming, ...]) -> tuple[EventDraft, ...]:
    drafts: list[EventDraft] = []
    for first, second, repeated_first, repeated_second in zip(
        words, words[1:], words[2:], words[3:]
    ):
        first_phrase = (_normalized_token(first.text), _normalized_token(second.text))
        repeated_phrase = (
            _normalized_token(repeated_first.text),
            _normalized_token(repeated_second.text),
        )
        gap_seconds = repeated_first.start_seconds - second.end_seconds
        if (
            all(first_phrase)
            and first_phrase == repeated_phrase
            and not any(token in FILLER_CANDIDATES for token in (*first_phrase, *repeated_phrase))
            and 0.0 <= gap_seconds <= REPETITION_MAXIMUM_GAP_SECONDS
        ):
            phrase_text = " ".join(
                (*first_phrase, *repeated_phrase)
            )
            drafts.append(
                EventDraft(
                    EventKind.REPETITION,
                    SpeechSpan(first.start_seconds, repeated_second.end_seconds),
                    phrase_text,
                    {"gap_seconds": gap_seconds, "repetition_unit": "phrase"},
                    "medium",
                )
            )
    return tuple(drafts)


def _restart_drafts(words: tuple[WordTiming, ...]) -> tuple[EventDraft, ...]:
    return tuple(
        EventDraft(
            EventKind.REPETITION,
            SpeechSpan(previous.start_seconds, following.end_seconds),
            f"{previous_token} {following_token}",
            {"gap_seconds": following.start_seconds - previous.end_seconds, "repetition_unit": "word_fragment"},
            "medium",
        )
        for previous, following in pairwise(words)
        if (previous_token := _normalized_token(previous.text))
        and (following_token := _normalized_token(following.text))
        and previous_token not in FILLER_CANDIDATES
        and following_token.startswith(previous_token)
        and following_token != previous_token
        and 0.0 <= following.start_seconds - previous.end_seconds <= RESTART_MAXIMUM_GAP_SECONDS
    )


def _self_repair_drafts(words: tuple[WordTiming, ...]) -> tuple[EventDraft, ...]:
    drafts: list[EventDraft] = []
    for first, suffix, corrected, repeated_suffix in zip(words, words[1:], words[2:], words[3:]):
        first_token = _normalized_token(first.text)
        suffix_token = _normalized_token(suffix.text)
        corrected_token = _normalized_token(corrected.text)
        if (
            first_token
            and suffix_token
            and suffix_token == _normalized_token(repeated_suffix.text)
            and first_token != corrected_token
            and _common_prefix_length(first_token, corrected_token) >= 2
            and 0.0 <= corrected.start_seconds - suffix.end_seconds <= REPETITION_MAXIMUM_GAP_SECONDS
        ):
            drafts.append(EventDraft(
                EventKind.REPETITION,
                SpeechSpan(first.start_seconds, repeated_suffix.end_seconds),
                f"{first_token} {suffix_token} → {corrected_token} {suffix_token}",
                {"gap_seconds": corrected.start_seconds - suffix.end_seconds, "repetition_unit": "self_repair"},
                "medium",
            ))
    return tuple(drafts)


def _common_prefix_length(first: str, second: str) -> int:
    return sum(left == right for left, right in zip(first, second))


def _elongation_drafts(
    words: tuple[WordTiming, ...], read_word_features: WordFeatureReader
) -> tuple[tuple[EventDraft, ...], ElongationDetectionDiagnostics]:
    drafts: list[EventDraft] = []
    duration_gate_word_count = 0
    syllable_duration_gate_word_count = 0
    acoustic_rejected_word_count = 0
    for word in words:
        duration_seconds = word.end_seconds - word.start_seconds
        if duration_seconds < ELONGATION_MINIMUM_SECONDS:
            continue
        duration_gate_word_count += 1
        normalized = _normalized_token(word.text)
        if not _has_elongation_duration_evidence(normalized, duration_seconds):
            continue
        syllable_duration_gate_word_count += 1
        span = SpeechSpan(word.start_seconds, word.end_seconds)
        features = read_word_features(span)
        if not _has_elongation_evidence(features):
            acoustic_rejected_word_count += 1
            continue
        confidence = "low" if features.used_fallback else "high"
        drafts.append(
            EventDraft(
                EventKind.ELONGATION,
                span,
                normalized or word.text,
                {
                    "duration_seconds": duration_seconds,
                    "voiced_fraction": features.voiced_fraction,
                    "rms_continuity": features.rms_continuity,
                    "pitch_available": float(features.pitch_available),
                    "vad_backend": features.vad_backend.value,
                    "pitch_backend": features.pitch_backend.value,
                },
                confidence,
            )
        )
    return (
        tuple(drafts),
        ElongationDetectionDiagnostics(
            len(drafts),
            duration_gate_word_count,
            syllable_duration_gate_word_count,
            acoustic_rejected_word_count,
        ),
    )


def _pause_drafts(
    words: tuple[WordTiming, ...], vad_confirmed_silences: tuple[SpeechSpan, ...]
) -> tuple[EventDraft, ...]:
    return tuple(
        EventDraft(
            _pause_kind(silence),
            silence,
            "",
            {
                "duration_seconds": silence.end_seconds - silence.start_seconds,
                "source": "vad",
                "pause_class": _pause_class(silence),
            },
            _pause_confidence(silence),
        )
        for silence in vad_confirmed_silences
        if silence.end_seconds - silence.start_seconds >= PAUSE_ANALYSIS_MINIMUM_SECONDS
    )


def _pause_kind(silence: SpeechSpan) -> EventKind:
    duration_seconds = silence.end_seconds - silence.start_seconds
    if duration_seconds >= VERY_LONG_PAUSE_MINIMUM_SECONDS:
        return EventKind.VERY_LONG_PAUSE
    if duration_seconds >= LONG_PAUSE_MINIMUM_SECONDS:
        return EventKind.LONG_PAUSE
    return EventKind.PAUSE


def _pause_class(silence: SpeechSpan) -> str:
    match _pause_kind(silence):
        case EventKind.PAUSE:
            return "analysis"
        case EventKind.LONG_PAUSE:
            return "long_candidate"
        case EventKind.VERY_LONG_PAUSE:
            return "very_long"
        case unreachable:
            assert_never(unreachable)


def _pause_confidence(silence: SpeechSpan) -> str:
    return "medium" if _pause_kind(silence) is EventKind.LONG_PAUSE else "high"


def _normalized_token(text: str) -> str:
    normalized = normalize("NFC", text).strip().strip(TOKEN_EDGE_PUNCTUATION)
    return "" if any(character.isspace() for character in normalized) else normalized


def _has_elongation_evidence(features: AcousticFeatures) -> bool:
    return (
        features.voiced_fraction >= 0.8
        and features.rms_continuity >= 0.65
        and features.pitch_available
    )


def _has_elongation_duration_evidence(text: str, duration_seconds: float) -> bool:
    syllable_count = sum("가" <= character <= "힣" for character in text)
    return syllable_count == 0 or (
        duration_seconds / syllable_count
        >= ELONGATION_MINIMUM_SECONDS_PER_HANGUL_SYLLABLE
    )


def _event(draft: EventDraft) -> CoachingEvent:
    event_id = _event_id(draft)
    return CoachingEvent(
        event_id,
        draft.kind,
        draft.span.start_seconds,
        draft.span.end_seconds,
        draft.text,
        draft.evidence,
        _coaching_message(draft),
        draft.confidence,
    )


def _event_id(draft: EventDraft) -> str:
    identity = (
        f"{draft.kind.value}|{draft.span.start_seconds:.3f}|"
        f"{draft.span.end_seconds:.3f}|{draft.text}"
    )
    return f"{draft.kind.value}-{sha256(identity.encode()).hexdigest()[:12]}"


def _coaching_message(draft: EventDraft) -> str:
    match draft.kind:
        case EventKind.FILLER:
            return (
                f"'{draft.text}' \uac19\uc740 \ud544\ub7ec\uac00 \ub4e4\ub9bd\ub2c8\ub2e4. "
                "\ub2e4\uc74c \ubb38\uc7a5\uc744 \uc2dc\uc791\ud558\uae30 \uc804\uc5d0 \uc9e7\uac8c \uc228\uc744 "
                "\uace0\ub974\uace0 \ubc14\ub85c \ud575\uc2ec\uc5b4\ub97c \ub9d0\ud574 \ubcf4\uc138\uc694."
            )
        case EventKind.REPETITION:
            return (
                f"'{draft.text}'\uc774 \uc5f0\uc18d\ud574\uc11c \ubc18\ubcf5\ub418\uc5c8\uc2b5\ub2c8\ub2e4. "
                "\ud575\uc2ec\uc5b4\ub97c \ud55c \ubc88\ub9cc \ub9d0\ud55c \ub4a4 \ub2e4\uc74c \ub0b4\uc6a9\uc73c\ub85c \uc774\uc5b4 \ubcf4\uc138\uc694."
            )
        case EventKind.ELONGATION:
            return _elongation_message(draft)
        case EventKind.PAUSE:
            duration_seconds = draft.span.end_seconds - draft.span.start_seconds
            return (
                f"{duration_seconds:.1f}\ucd08\uc758 \uc26c\uc774 \uae30\ub85d\ub418\uc5c8\uc2b5\ub2c8\ub2e4. "
                "\ubb38\uc7a5 \uacbd\uacc4\uc758 \uc790\uc5f0\uc2a4\ub7ec\uc6b4 \uc26c\uc77c \uc218 \uc788\uc5b4 \uc810\uc218\uc5d0\ub294 \ubc18\uc601\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
            )
        case EventKind.LONG_PAUSE:
            duration_seconds = draft.span.end_seconds - draft.span.start_seconds
            return (
                f"{duration_seconds:.1f}\ucd08\uc758 \uae34 \uc26c\uc774 \ud655\uc778\ub418\uc5c8\uc2b5\ub2c8\ub2e4. "
                "\uc7ac\uc0dd \uad6c\uac04\uc744 \ub4e3\uace0 \uc758\ub3c4\ud55c \uac15\uc870\uc778\uc9c0 \ud655\uc778\ud574 \ubcf4\uc138\uc694."
            )
        case EventKind.VERY_LONG_PAUSE:
            duration_seconds = draft.span.end_seconds - draft.span.start_seconds
            return (
                f"{duration_seconds:.1f}\ucd08\uc758 \ub9e4\uc6b0 \uae34 \uc26c\uc774 \ud655\uc778\ub418\uc5c8\uc2b5\ub2c8\ub2e4. "
                "\ubc1c\ud45c \ud750\ub984\uc774 \ub04a\uae30\uc9c0 \uc54a\ub3c4\ub85d \ub2e4\uc74c \ubb38\uc7a5\uc744 \ubbf8\ub9ac \uc5f0\uacb0\ud574 \ubcf4\uc138\uc694."
            )
        case unreachable:
            assert_never(unreachable)


def _elongation_message(draft: EventDraft) -> str:
    if draft.confidence == "low":
        return (
            f"'{draft.text}'\uc744 \uae38\uac8c \ub298\uc5ec \ub9d0\ud588\uc744 \uac00\ub2a5\uc131\uc774 \uc788\uc2b5\ub2c8\ub2e4. "
            "\uc7ac\uc0dd \uad6c\uac04\uc744 \ub4e3\uace0 \uc758\ub3c4\ud55c \uac15\uc870\uc778\uc9c0 \ud655\uc778\ud574 \ubcf4\uc138\uc694."
        )
    return (
        f"'{draft.text}'\uc744 \uae38\uac8c \ub298\uc5ec \ub9d0\ud55c \uad6c\uac04\uc774 \ud655\uc778\ub418\uc5c8\uc2b5\ub2c8\ub2e4. "
        "\ud575\uc2ec\uc5b4\ub294 \uc790\uc5f0\uc2a4\ub7ec\uc6b4 \uae38\uc774\ub85c \ub9d0\ud574 \ubcf4\uc138\uc694."
    )
