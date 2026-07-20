from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SlideContent:
    index: int
    title: str
    native_text: str
    ocr_text: str
    combined_text: str
    speaker_notes: str
    native_text_char_count: int
    native_text_no_space_count: int
    ocr_text_char_count: int
    total_text_char_count: int
    total_text_no_space_count: int
    word_count: int
    line_count: int
    text_box_count: int
    image_count: int
    table_count: int
    table_row_count: int
    table_column_count: int
    table_cell_count: int
    chart_count: int
    shape_count: int
    density_score: float = 0.0
    density_level: str = "낮음"
    slide_type: str = "일반 슬라이드"
    extraction_warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class STTSegment:
    start: float
    end: float
    text: str

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class STTAnalysis:
    segments: list[STTSegment]
    transcript: str
    total_duration: float
    speech_duration: float
    silence_duration: float
    silence_ratio: float
    char_count: int
    no_space_char_count: int
    word_count: int
    chars_per_second: float
    words_per_minute: float
    long_pause_count: int
    repetition_ratio: float
    used_default_speed: bool
    warnings: list[str] = field(default_factory=list)

    @classmethod
    def empty(cls, default_chars_per_second: float, warning: str | None = None) -> "STTAnalysis":
        warnings = [warning] if warning else []
        return cls(
            segments=[],
            transcript="",
            total_duration=0.0,
            speech_duration=0.0,
            silence_duration=0.0,
            silence_ratio=0.0,
            char_count=0,
            no_space_char_count=0,
            word_count=0,
            chars_per_second=default_chars_per_second,
            words_per_minute=0.0,
            long_pause_count=0,
            repetition_ratio=0.0,
            used_default_speed=True,
            warnings=warnings,
        )


@dataclass
class SlideAlignment:
    slide_index: int
    actual_start_time: float
    actual_end_time: float
    actual_duration: float
    matched_stt_text: str
    alignment_confidence: float
    source: str
    long_pause_count: int = 0
    silence_ratio: float = 0.0


@dataclass
class TimeRecommendation:
    slide_index: int
    slide_type: str
    minimum_seconds: float
    recommended_seconds: float
    maximum_seconds: float
    raw_recommended_seconds: float


@dataclass
class SlideEvaluation:
    slide_index: int
    is_too_long: bool
    reasons: list[str]
    suggestions: list[str]
    overrun_seconds: float


@dataclass
class ReportPaths:
    ppt_content_xml: str
    analysis_xml: str
    analysis_txt: str


@dataclass
class PresentationAnalysisResult:
    source_ppt: str
    slides: list[SlideContent]
    stt: STTAnalysis
    alignments: list[SlideAlignment]
    recommendations: list[TimeRecommendation]
    evaluations: list[SlideEvaluation]
    target_duration_seconds: float | None
    recommended_duration_seconds: float
    buffer_seconds: float
    report_paths: ReportPaths
    alignment_note: str
