from __future__ import annotations

import json
import queue
import sys
import time
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Callable

import numpy as np
import sounddevice as sd

from presentation_analysis.config import AnalysisConfig
from presentation_analysis.content_density import apply_density
from presentation_analysis.models import (
    PresentationAnalysisResult,
    SlideAlignment,
    SlideContent,
    SlideEvaluation,
    STTAnalysis,
    STTSegment,
    TimeRecommendation,
)
from presentation_analysis.ppt_extractor import extract_presentation, find_ppt_file
from presentation_analysis.presentation_evaluator import evaluate_slides
from presentation_analysis.report_writer import build_result, write_reports
from presentation_analysis.slide_aligner import align_slides
from presentation_analysis.stt_processor import analyze_stt_segments
from presentation_analysis.text_utils import format_seconds, no_space_len
from presentation_analysis.time_recommender import build_recommendations

LogFn = Callable[[str], None]


def run_live_mic_presentation_analysis(
    root: Path,
    ppt_path: Path | None = None,
    slide_events_path: Path | None = None,
    target_minutes: float | None = None,
    logs_dir: Path | None = None,
    config: AnalysisConfig | None = None,
    whisper_model: str | None = None,
    audio_device: int | None = None,
    sample_rate: int | None = 16000,
    auto_sample_rate: bool = False,
    speech_db_threshold: float = -42.0,
    live_chunk_seconds: float | None = None,
    live_max_seconds: float | None = None,
    logger: LogFn | None = None,
) -> PresentationAnalysisResult | None:
    config = config or AnalysisConfig()
    log = logger or _default_logger
    root = root.resolve()
    logs_dir = (logs_dir or root / "logs").resolve()
    logs_dir.mkdir(parents=True, exist_ok=True)

    selected_ppt = find_ppt_file(root, ppt_path)
    if selected_ppt is None:
        if ppt_path is None:
            log("루트 폴더에서 sample.pptx 또는 sample.ppt 파일을 찾을 수 없습니다.")
        else:
            log(f"PPT 파일을 찾을 수 없습니다: {ppt_path}")
        return None

    selected_ppt = selected_ppt.resolve()
    selected_events = _resolve_optional(root, slide_events_path)
    if selected_events is not None and not selected_events.exists():
        log(f"[매칭] 슬라이드 전환 기록 파일을 찾을 수 없어 자동 추정을 사용합니다: {selected_events}")

    log(f"[시작] PPT 분석 대상: {selected_ppt}")
    try:
        slides = extract_presentation(selected_ppt, config, logger=log)
    except Exception as exc:
        log(str(exc))
        return None
    apply_density(slides, config)
    log(f"PPT 분석 완료: {len(slides)}개 슬라이드")

    selected_model = whisper_model or config.whisper_model
    try:
        transcriber: LiveTranscriber = FasterWhisperLiveTranscriber(selected_model, log)
    except Exception as first_exc:
        log(f"[STT] faster-whisper를 사용할 수 없습니다: {first_exc}")
        try:
            transcriber = OpenAIWhisperLiveTranscriber(selected_model, log)
        except Exception as second_exc:
            log("마이크 실시간 STT에는 faster-whisper 또는 openai-whisper가 필요합니다.")
            log("설치 예: pip install faster-whisper")
            log(f"openai-whisper 로드 실패: {second_exc}")
            return None

    actual_sample_rate = _select_sample_rate(audio_device, sample_rate, auto_sample_rate)
    chunk_seconds = live_chunk_seconds or config.live_chunk_seconds
    chunk_seconds = max(1.0, min(config.live_max_chunk_seconds, chunk_seconds))
    log_path = logs_dir / f"live_presentation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"

    log("")
    log("마이크 실시간 발표 분석을 시작합니다.")
    log(f"- 장치: {audio_device if audio_device is not None else '기본 입력 장치'}")
    log(f"- 샘플레이트: {actual_sample_rate} Hz")
    log(f"- STT 모델: {transcriber.engine_name} {selected_model}")
    log(f"- 분석 청크: {chunk_seconds:.1f}초")
    log("- 종료/최종 보고서 저장: Ctrl+C")
    log("")

    segments: list[STTSegment] = []
    audio_queue: queue.Queue[np.ndarray] = queue.Queue()
    buffer = np.empty(0, dtype=np.float32)
    timeline_seconds = 0.0
    start_monotonic = time.monotonic()
    last_state: LiveState | None = None

    try:
        with sd.InputStream(
            samplerate=actual_sample_rate,
            blocksize=max(1, int(actual_sample_rate * 0.2)),
            channels=1,
            dtype="float32",
            device=audio_device,
            callback=lambda indata, frames, callback_time, status: _audio_callback(
                audio_queue,
                indata,
                frames,
                callback_time,
                status,
                log,
            ),
        ), log_path.open("a", encoding="utf-8") as live_log:
            while True:
                if live_max_seconds is not None and timeline_seconds >= live_max_seconds:
                    log("지정한 실시간 분석 시간이 끝났습니다.")
                    break

                try:
                    block = audio_queue.get(timeout=0.2)
                    buffer = np.concatenate([buffer, block])
                except queue.Empty:
                    pass

                needed = int(actual_sample_rate * chunk_seconds)
                if buffer.size < needed:
                    continue

                chunk = buffer[:needed]
                buffer = buffer[needed:]
                chunk_start = timeline_seconds
                chunk_duration = chunk.size / actual_sample_rate
                timeline_seconds += chunk_duration

                volume_db = _volume_db(chunk)
                if volume_db < speech_db_threshold:
                    log(f"[{format_seconds(timeline_seconds)}] 침묵/저음량 구간 건너뜀 ({volume_db:.1f} dB)")
                    _write_live_record(
                        live_log,
                        {
                            "type": "silence",
                            "time": round(timeline_seconds, 3),
                            "chunk_start": round(chunk_start, 3),
                            "chunk_end": round(timeline_seconds, 3),
                            "volume_db": round(volume_db, 2),
                        },
                    )
                    continue

                new_segments = transcriber.transcribe_chunk(chunk, chunk_start)
                if not new_segments:
                    log(f"[{format_seconds(timeline_seconds)}] STT 텍스트 없음 ({volume_db:.1f} dB)")
                    continue

                segments.extend(new_segments)
                stt, alignments, recommendations, evaluations, recommended_total, buffer_seconds, alignment_note = _evaluate_live_state(
                    slides,
                    segments,
                    config,
                    selected_events,
                    target_minutes,
                    timeline_seconds,
                )
                last_state = LiveState(
                    stt=stt,
                    alignments=alignments,
                    recommendations=recommendations,
                    evaluations=evaluations,
                    recommended_total=recommended_total,
                    buffer_seconds=buffer_seconds,
                    alignment_note=alignment_note,
                )
                _print_live_update(slides, new_segments, last_state, log)
                _write_live_record(
                    live_log,
                    _live_record(slides, new_segments, last_state, volume_db, timeline_seconds),
                )
    except KeyboardInterrupt:
        log("")
        log("실시간 분석을 종료하고 최종 보고서를 저장합니다.")
    finally:
        elapsed = max(timeline_seconds, time.monotonic() - start_monotonic)

    if last_state is None:
        stt = analyze_stt_segments(
            segments,
            config,
            audio_duration=elapsed,
            warnings=["마이크 실시간 STT 결과가 없어 기본 휴리스틱 발화 속도를 사용했습니다."],
        )
        alignments, alignment_note = align_slides(slides, stt, config, selected_events)
        recommendations, recommended_total, buffer_seconds = build_recommendations(
            slides,
            stt.chars_per_second,
            config,
            target_minutes=target_minutes,
        )
        evaluations = evaluate_slides(slides, alignments, recommendations, stt, config)
    else:
        stt = analyze_stt_segments(
            segments,
            config,
            audio_duration=elapsed,
            warnings=last_state.stt.warnings,
        )
        alignments, alignment_note = align_slides(slides, stt, config, selected_events)
        recommendations, recommended_total, buffer_seconds = build_recommendations(
            slides,
            stt.chars_per_second,
            config,
            target_minutes=target_minutes,
        )
        evaluations = evaluate_slides(slides, alignments, recommendations, stt, config)

    target_duration_seconds = target_minutes * 60.0 if target_minutes and target_minutes > 0 else None
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
    _print_final_summary(result, log, log_path, root)
    return result


class LiveTranscriber:
    engine_name = "unknown"

    def transcribe_chunk(self, audio: np.ndarray, offset_seconds: float) -> list[STTSegment]:
        raise NotImplementedError


class FasterWhisperLiveTranscriber(LiveTranscriber):
    engine_name = "faster-whisper"

    def __init__(self, model_name: str, logger: LogFn) -> None:
        from faster_whisper import WhisperModel  # type: ignore

        logger(f"[STT] faster-whisper 모델을 로드합니다: {model_name}")
        self.model = WhisperModel(model_name, compute_type="int8")

    def transcribe_chunk(self, audio: np.ndarray, offset_seconds: float) -> list[STTSegment]:
        result, _info = self.model.transcribe(audio, language="ko", beam_size=1)
        segments: list[STTSegment] = []
        for segment in result:
            text = segment.text.strip()
            if not text:
                continue
            segments.append(
                STTSegment(
                    start=offset_seconds + float(segment.start),
                    end=offset_seconds + float(segment.end),
                    text=text,
                )
            )
        return segments


class OpenAIWhisperLiveTranscriber(LiveTranscriber):
    engine_name = "openai-whisper"

    def __init__(self, model_name: str, logger: LogFn) -> None:
        import whisper  # type: ignore

        logger(f"[STT] openai-whisper 모델을 로드합니다: {model_name}")
        self.model = whisper.load_model(model_name)

    def transcribe_chunk(self, audio: np.ndarray, offset_seconds: float) -> list[STTSegment]:
        result = self.model.transcribe(audio, language="ko", fp16=False)
        segments: list[STTSegment] = []
        for segment in result.get("segments", []):
            text = str(segment.get("text", "")).strip()
            if not text:
                continue
            segments.append(
                STTSegment(
                    start=offset_seconds + float(segment.get("start", 0.0)),
                    end=offset_seconds + float(segment.get("end", 0.0)),
                    text=text,
                )
            )
        return segments


class LiveState:
    def __init__(
        self,
        stt: STTAnalysis,
        alignments: list[SlideAlignment],
        recommendations: list[TimeRecommendation],
        evaluations: list[SlideEvaluation],
        recommended_total: float,
        buffer_seconds: float,
        alignment_note: str,
    ) -> None:
        self.stt = stt
        self.alignments = alignments
        self.recommendations = recommendations
        self.evaluations = evaluations
        self.recommended_total = recommended_total
        self.buffer_seconds = buffer_seconds
        self.alignment_note = alignment_note


def _evaluate_live_state(
    slides: list[SlideContent],
    segments: list[STTSegment],
    config: AnalysisConfig,
    selected_events: Path | None,
    target_minutes: float | None,
    audio_duration: float,
) -> tuple[
    STTAnalysis,
    list[SlideAlignment],
    list[TimeRecommendation],
    list[SlideEvaluation],
    float,
    float,
    str,
]:
    stt = analyze_stt_segments(segments, config, audio_duration=audio_duration)
    alignments, alignment_note = align_slides(slides, stt, config, selected_events)
    recommendations, recommended_total, buffer_seconds = build_recommendations(
        slides,
        stt.chars_per_second,
        config,
        target_minutes=target_minutes,
    )
    evaluations = evaluate_slides(slides, alignments, recommendations, stt, config)
    return stt, alignments, recommendations, evaluations, recommended_total, buffer_seconds, alignment_note


def _print_live_update(
    slides: list[SlideContent],
    new_segments: list[STTSegment],
    state: LiveState,
    log: LogFn,
) -> None:
    current = _current_alignment(state.alignments)
    if current is None:
        slide_text = "현재 슬라이드 추정 불가"
        recommendation_text = ""
        evaluation_text = ""
    else:
        slide = _slide_by_index(slides, current.slide_index)
        recommendation = _recommendation_by_index(state.recommendations, current.slide_index)
        evaluation = _evaluation_by_index(state.evaluations, current.slide_index)
        title = slide.title if slide else "제목 없음"
        slide_text = (
            f"현재 추정: {current.slide_index}번 {title} "
            f"({format_seconds(current.actual_duration)}, 신뢰도 {current.alignment_confidence:.2f})"
        )
        recommendation_text = (
            f"권장 최대 {recommendation.maximum_seconds:.0f}초"
            if recommendation
            else "권장시간 없음"
        )
        evaluation_text = "긴 슬라이드 후보" if evaluation and evaluation.is_too_long else "정상 범위"

    transcript = " ".join(segment.text for segment in new_segments)
    log(f"[{format_seconds(state.stt.total_duration)}] STT: {transcript}")
    log(f"  {slide_text} | {recommendation_text} | {evaluation_text}")


def _live_record(
    slides: list[SlideContent],
    new_segments: list[STTSegment],
    state: LiveState,
    volume_db: float,
    timeline_seconds: float,
) -> dict:
    current = _current_alignment(state.alignments)
    recommendation = _recommendation_by_index(state.recommendations, current.slide_index) if current else None
    evaluation = _evaluation_by_index(state.evaluations, current.slide_index) if current else None
    slide = _slide_by_index(slides, current.slide_index) if current else None
    return {
        "type": "stt_chunk",
        "time": round(timeline_seconds, 3),
        "volume_db": round(volume_db, 2),
        "segments": [asdict(segment) for segment in new_segments],
        "transcript": " ".join(segment.text for segment in new_segments),
        "current_slide": {
            "slide_index": current.slide_index if current else None,
            "title": slide.title if slide else None,
            "actual_duration": current.actual_duration if current else 0.0,
            "alignment_confidence": current.alignment_confidence if current else 0.0,
            "recommended_max_seconds": recommendation.maximum_seconds if recommendation else 0.0,
            "is_too_long": evaluation.is_too_long if evaluation else False,
            "reasons": evaluation.reasons if evaluation else [],
        },
        "speech": {
            "chars_per_second": state.stt.chars_per_second,
            "speech_duration": state.stt.speech_duration,
            "silence_ratio": state.stt.silence_ratio,
            "no_space_char_count": no_space_len(state.stt.transcript),
        },
    }


def _write_live_record(handle, record: dict) -> None:
    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    handle.flush()


def _current_alignment(alignments: list[SlideAlignment]) -> SlideAlignment | None:
    active = [alignment for alignment in alignments if alignment.actual_duration > 0]
    if not active:
        return None
    return max(active, key=lambda alignment: alignment.actual_end_time)


def _slide_by_index(slides: list[SlideContent], slide_index: int) -> SlideContent | None:
    return next((slide for slide in slides if slide.index == slide_index), None)


def _recommendation_by_index(
    recommendations: list[TimeRecommendation],
    slide_index: int,
) -> TimeRecommendation | None:
    return next((item for item in recommendations if item.slide_index == slide_index), None)


def _evaluation_by_index(evaluations: list[SlideEvaluation], slide_index: int) -> SlideEvaluation | None:
    return next((item for item in evaluations if item.slide_index == slide_index), None)


def _select_sample_rate(audio_device: int | None, sample_rate: int | None, auto_sample_rate: bool) -> int:
    if auto_sample_rate or sample_rate is None:
        device_info = sd.query_devices(audio_device, "input")
        return int(device_info["default_samplerate"])
    return sample_rate


def _audio_callback(
    audio_queue: queue.Queue[np.ndarray],
    indata,
    frames,
    callback_time,
    status,
    logger: LogFn,
) -> None:
    del frames, callback_time
    if status:
        logger(f"[오디오] {status}")
    audio_queue.put(np.asarray(indata[:, 0], dtype=np.float32).copy())


def _volume_db(samples: np.ndarray) -> float:
    centered = samples - float(np.mean(samples))
    rms = float(np.sqrt(np.mean(np.square(centered))) + 1e-9)
    return 20.0 * float(np.log10(rms))


def _resolve_optional(root: Path, path: Path | None) -> Path | None:
    if path is None:
        return None
    return path if path.is_absolute() else root / path


def _print_final_summary(result: PresentationAnalysisResult, log: LogFn, live_log_path: Path, root: Path) -> None:
    long_count = sum(1 for evaluation in result.evaluations if evaluation.is_too_long)
    log("")
    log("실시간 발표 분석 최종 결과")
    log(f"- 실제 발표시간: {format_seconds(result.stt.total_duration)}")
    log(f"- 평균 발화 속도: {result.stt.chars_per_second:.2f} chars/sec")
    log(f"- 긴 슬라이드 후보: {long_count}개")
    log("결과 저장:")
    log(f"- {_relative_or_absolute(live_log_path, root)}")
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
