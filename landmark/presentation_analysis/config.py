from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DensityConfig:
    text_char_full_score: float = 600.0
    text_score_weight: float = 50.0
    structure_full_score: float = 15.0
    structure_score_weight: float = 15.0
    visual_full_score: float = 8.0
    visual_score_weight: float = 25.0
    complexity_full_score: float = 10.0
    complexity_score_weight: float = 10.0


@dataclass(frozen=True)
class RecommendationConfig:
    base_seconds: float = 8.0
    text_time_ratio: float = 0.7
    image_seconds: float = 3.0
    max_image_count_for_time: int = 3
    table_seconds: float = 10.0
    chart_seconds: float = 12.0
    min_seconds: float = 10.0
    max_seconds: float = 90.0
    transition_min_seconds: float = 5.0
    transition_max_seconds: float = 20.0
    range_ratio: float = 0.15
    density_bonus_seconds: dict[str, float] = field(
        default_factory=lambda: {
            "낮음": 0.0,
            "보통": 5.0,
            "높음": 10.0,
            "매우 높음": 15.0,
        }
    )


@dataclass(frozen=True)
class AnalysisConfig:
    default_chars_per_second: float = 4.0
    absolute_long_slide_seconds: float = 90.0
    soft_long_slide_seconds: float = 60.0
    recommendation_overrun_ratio: float = 1.2
    median_overrun_ratio: float = 1.5
    target_buffer_ratio: float = 0.05
    max_suggestions_per_slide: int = 3
    long_pause_seconds: float = 2.0
    low_alignment_threshold: float = 0.08
    min_ocr_image_width: int = 80
    min_ocr_image_height: int = 40
    fast_chars_per_second: float = 6.0
    high_silence_ratio: float = 0.25
    whisper_model: str = "base"
    live_chunk_seconds: float = 5.0
    live_max_chunk_seconds: float = 12.0
    density: DensityConfig = field(default_factory=DensityConfig)
    recommendation: RecommendationConfig = field(default_factory=RecommendationConfig)
