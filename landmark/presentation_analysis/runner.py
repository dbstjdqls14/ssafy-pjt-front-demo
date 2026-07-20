from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.content_density import apply_density
from presentation_analysis.models import PresentationAnalysisResult
from presentation_analysis.ppt_extractor import extract_presentation, find_ppt_file
from presentation_analysis.presentation_evaluator import evaluate_slides
from presentation_analysis.report_writer import build_result, write_reports
from presentation_analysis.slide_aligner import align_slides
from presentation_analysis.stt_processor import transcribe_audio_file
from presentation_analysis.text_utils import format_seconds
from presentation_analysis.time_recommender import build_recommendations

LogFn = Callable[[str], None]


def run_presentation_analysis(
    root: Path,
    ppt_path: Path | None = None,
    audio_path: Path | None = None,
    slide_events_path: Path | None = None,
    target_minutes: float | None = None,
    analyze_ppt_only: bool = False,
    logs_dir: Path | None = None,
    config: AnalysisConfig | None = None,
    whisper_model: str | None = None,
    logger: LogFn | None = None,
) -> PresentationAnalysisResult | None:
    config = config or AnalysisConfig()
    log = logger or _default_logger
    root = root.resolve()
    logs_dir = (logs_dir or root / "logs").resolve()

    selected_ppt = find_ppt_file(root, ppt_path)
    if selected_ppt is None:
        if ppt_path is None:
            log("루트 폴더에서 sample.pptx 또는 sample.ppt 파일을 찾을 수 없습니다.")
        else:
            log(f"PPT 파일을 찾을 수 없습니다: {ppt_path}")
        return None

    selected_ppt = selected_ppt.resolve()
    selected_audio = _resolve_optional(root, audio_path)
    selected_events = _resolve_optional(root, slide_events_path)
    if selected_events is not None and not selected_events.exists():
        log(f"[매칭] 슬라이드 전환 기록 파일을 찾을 수 없어 자동 추정을 사용합니다: {selected_events}")
    if analyze_ppt_only:
        selected_audio = None

    log(f"[시작] PPT 분석 대상: {selected_ppt}")
    try:
        slides = extract_presentation(selected_ppt, config, logger=log)
    except Exception as exc:
        log(str(exc))
        return None

    apply_density(slides, config)
    log(f"PPT 분석 완료: {len(slides)}개 슬라이드")
    for slide in slides:
        log(f"[밀도] {slide.index}번 {slide.title}: {slide.density_score} / {slide.density_level}")

    stt = transcribe_audio_file(None if analyze_ppt_only else selected_audio, config, model_name=whisper_model)
    for warning in stt.warnings:
        log(f"[STT] {warning}")
    log(f"STT 분석 완료: {stt.total_duration:.1f}초")
    log(f"평균 발화 속도: {stt.chars_per_second:.2f} chars/sec")

    alignments, alignment_note = align_slides(slides, stt, config, selected_events, logger=log)
    recommendations, recommended_total, buffer_seconds = build_recommendations(
        slides,
        stt.chars_per_second,
        config,
        target_minutes=target_minutes,
    )
    target_duration_seconds = target_minutes * 60.0 if target_minutes and target_minutes > 0 else None
    evaluations = evaluate_slides(slides, alignments, recommendations, stt, config)

    report_paths = write_reports(
        selected_ppt,
        slides,
        stt,
        alignments,
        recommendations,
        evaluations,
        target_duration_seconds,
        recommended_total,
        buffer_seconds,
        alignment_note,
        logs_dir,
    )

    result = build_result(
        selected_ppt,
        slides,
        stt,
        alignments,
        recommendations,
        evaluations,
        target_duration_seconds,
        recommended_total,
        buffer_seconds,
        report_paths,
        alignment_note,
    )
    _print_console_summary(result, root, log)
    return result


def _resolve_optional(root: Path, path: Path | None) -> Path | None:
    if path is None:
        return None
    return path if path.is_absolute() else root / path


def _print_console_summary(result: PresentationAnalysisResult, root: Path, log: LogFn) -> None:
    long_candidates = [item for item in result.evaluations if item.is_too_long]
    recommendation_by_index = {item.slide_index: item for item in result.recommendations}
    alignment_by_index = {item.slide_index: item for item in result.alignments}
    slide_by_index = {item.index: item for item in result.slides}

    log("")
    log(f"PPT 분석 완료: {len(result.slides)}개 슬라이드")
    log(f"STT 분석 완료: {result.stt.total_duration:.1f}초")
    log(f"평균 발화 속도: {result.stt.chars_per_second:.2f} chars/sec")
    log(f"긴 슬라이드 후보: {len(long_candidates)}개")
    if result.target_duration_seconds is not None:
        delta = result.stt.total_duration - result.target_duration_seconds
        state = "초과" if delta > 0 else "미달"
        log(f"목표 발표시간: {format_seconds(result.target_duration_seconds)}")
        log(f"권장 발표시간 합계: {format_seconds(result.recommended_duration_seconds)}")
        log(f"예비시간: {format_seconds(result.buffer_seconds)}")
        log(f"실제 발표시간: {format_seconds(result.stt.total_duration)} ({abs(delta):.1f}초 {state})")

    if long_candidates:
        log("")
        log("[긴 슬라이드]")
        for evaluation in long_candidates:
            slide = slide_by_index[evaluation.slide_index]
            recommendation = recommendation_by_index[evaluation.slide_index]
            alignment = alignment_by_index[evaluation.slide_index]
            log(
                f"{slide.index}번 {slide.title}: "
                f"실제 {alignment.actual_duration:.0f}초 / 권장 최대 {recommendation.maximum_seconds:.0f}초"
            )

    log("")
    log("결과 저장:")
    log(f"- {_relative_or_absolute(Path(result.report_paths.ppt_content_xml), root)}")
    log(f"- {_relative_or_absolute(Path(result.report_paths.analysis_xml), root)}")
    log(f"- {_relative_or_absolute(Path(result.report_paths.analysis_txt), root)}")


def _relative_or_absolute(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except ValueError:
        return str(path)


def _default_logger(message: str) -> None:
    try:
        print(message, flush=True)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or "utf-8"
        safe_message = message.encode(encoding, errors="replace").decode(encoding, errors="replace")
        print(safe_message, flush=True)
