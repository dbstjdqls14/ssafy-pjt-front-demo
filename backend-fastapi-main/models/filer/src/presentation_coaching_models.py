from dataclasses import dataclass
from enum import StrEnum
from importlib.util import find_spec
from pathlib import Path
from typing import Protocol, assert_never
import os, sys, time, wave

from presentation_coaching_audio import (
    TARGET_SAMPLE_RATE,
    SpeechSpan,
    load_wav_at_target_rate,
    measure_word_audio_from_analysis,
    silences_from_voiced_spans,
)
from presentation_coaching_acoustic_stutter import (
    detect_acoustic_stutter_candidates,
    merge_acoustic_stutter_events,
    to_coaching_events,
)
from presentation_coaching_crisper import (
    crisper_word_timings,
    crisper_ct2_unavailability_reason,
    rescue_crisper_filler_words,
    transcribe_korean_native_verbatim,
    transcribe_korean_with_transformers_fallback,
)
from presentation_coaching_events import (
    PAUSE_ANALYSIS_MINIMUM_SECONDS,
    EventDetectionDiagnostics,
    analyze_events,
)
from presentation_coaching_filler_rescue import (
    merge_rescued_fillers,
    transcribe_with_filler_rescue,
    transcribe_without_filler_rescue,
)
from presentation_coaching_model_cache import local_model_path as _local_model_path
from presentation_coaching_model_memory import release_cuda_memory as _release_cuda_memory
from presentation_coaching_resources import ResourcePeaks, ResourceSampler, gpu_name
from presentation_coaching_speech_rate_events import (
    SENTENCE_GAP_SECONDS,
    SpeechRateAnalysis,
    analyze_speech_rate_events,
)
from presentation_coaching_transcription import (
    FasterWhisperDecodeProfile,
    PRESENTATION_DISFLUENCY_PROFILE,
)
from presentation_coaching_types import ModelRun, RunMetrics, WordTiming
from presentation_coaching_vad import vad_analysis


class _DllDirectoryHandle(Protocol):
    def close(self) -> None: ...


_DLL_DIRECTORY_HANDLES: list[_DllDirectoryHandle] = []
_REGISTERED_DLL_DIRECTORIES: list[Path] = []


class CandidateBackend(StrEnum):
    """Supported local inference engines."""

    FASTER_WHISPER = "faster_whisper"
    CRISPERWHISPER = "crisperwhisper"
    TRANSFORMERS = "transformers"


class TranscriptionVariant(StrEnum):
    PURE = "pure"
    WINDOW_FILLER_RESCUE = "window_filler_rescue"


class CrisperPromptMode(StrEnum):
    NATIVE_VERBATIM = "native_verbatim"
    NEUTRAL_PREFIX = "neutral_prefix"
    NOT_APPLICABLE = "not_applicable"


class CrisperRuntimeBackend(StrEnum):
    CT2 = "ct2"
    TRANSFORMERS = "transformers"


@dataclass(frozen=True, slots=True)
class CrisperDecodeSettings:
    runtime_backend: CrisperRuntimeBackend
    hallucination_mitigation: bool = True


@dataclass(frozen=True, slots=True)
class EmptyKoreanTranscriptionError(RuntimeError):
    model_key: str

    def __str__(self) -> str:
        return f"{self.model_key}: 한국어 전사 결과가 비어 있습니다. 음질과 모델 설정을 확인하세요."


@dataclass(frozen=True, slots=True)
class UnsupportedBackendError(RuntimeError):
    backend: CandidateBackend

    def __str__(self) -> str:
        return f"{self.backend.value}: 단어 시각 어댑터를 사용할 수 없습니다."


@dataclass(frozen=True, slots=True)
class CandidateSpec:
    """One selectable local model configuration."""

    key: str
    label: str
    model_id: str
    backend: CandidateBackend
    language: str
    compute_type: str
    device: str


@dataclass(frozen=True, slots=True)
class CandidateAvailability:
    """Whether a candidate can run without an implicit download."""

    available: bool
    reason: str
    local_model_path: Path | None


@dataclass(frozen=True, slots=True)
class BenchmarkedRun:
    """A model result plus full-pipeline timing and resource peaks."""

    model_run: ModelRun
    total_seconds: float
    resources: ResourcePeaks
    audio_path: Path
    event_detection_diagnostics: EventDetectionDiagnostics | None = None
    speech_rate_analysis: SpeechRateAnalysis | None = None


def available_candidates() -> dict[str, CandidateSpec]:  # noqa: DICT_OK
    """Return the complete selectable Korean model catalog."""
    specs = (
        CandidateSpec("faster-whisper-large-v3-turbo", "faster-whisper large-v3-turbo", "mobiuslabsgmbh/faster-whisper-large-v3-turbo", CandidateBackend.FASTER_WHISPER, "ko", "float16", "cuda"),
        CandidateSpec("faster-whisper-large-v3", "faster-whisper large-v3", "Systran/faster-whisper-large-v3", CandidateBackend.FASTER_WHISPER, "ko", "float16", "cuda"),
        CandidateSpec("crisperwhisper-2-turbo", "CrisperWhisper 2.0 turbo", "nyralabs/CrisperWhisper2.0_turbo", CandidateBackend.CRISPERWHISPER, "ko", "float16", "cuda"),
        CandidateSpec("crisperwhisper-2-large", "CrisperWhisper 2.0 large", "nyralabs/CrisperWhisper2.0_large", CandidateBackend.CRISPERWHISPER, "ko", "float16", "cuda"),
        CandidateSpec("selo-whisper-ko-disfluency", "SeloWhisper Korean disfluency", "rearleg/SeloWhisper-ko-disfluency", CandidateBackend.TRANSFORMERS, "ko", "float16", "cuda"),
        CandidateSpec("tellang-whisper-turbo-ko", "tellang Whisper turbo Korean", "tellang/whisper-large-v3-turbo-ko", CandidateBackend.FASTER_WHISPER, "ko", "float16", "cuda"),
    )
    return {spec.key: spec for spec in specs}


def inspect_candidate(
    spec: CandidateSpec, *, allow_model_downloads: bool = False,
) -> CandidateAvailability:  # noqa: BROAD_EXCEPT_OK
    """Resolve an installed backend to a cached or downloaded model."""
    module_name = spec.backend.value
    if find_spec(module_name) is None:
        return CandidateAvailability(False, f"{module_name} 패키지가 설치되지 않았습니다.", None)
    if (
        spec.backend is CandidateBackend.CRISPERWHISPER
        and sys.platform != "win32"
    ):
        crisper_reason = crisper_ct2_unavailability_reason()
        if crisper_reason is not None:
            return CandidateAvailability(False, crisper_reason, None)
    if (
        spec.backend is CandidateBackend.TRANSFORMERS
        and not allow_model_downloads
        and _local_model_path(spec.model_id) is None
    ):
        return CandidateAvailability(False, "이 노트북에는 해당 Transformers 단어 시각 어댑터가 없습니다.", None)
    local_path = _local_model_path(spec.model_id)
    if allow_model_downloads and local_path is None and not Path(spec.model_id).is_dir():
        try:
            from huggingface_hub import snapshot_download
            local_path = Path(snapshot_download(spec.model_id, local_files_only=False))
        except Exception as exc:  # noqa: BROAD_EXCEPT_OK
            return CandidateAvailability(
                False,
                f"Download failed for {spec.model_id}: {type(exc).__name__}: {exc}",
                None,
            )
    if local_path is None:
        return CandidateAvailability(False, "로컬 모델 가중치가 없습니다. 모델을 먼저 캐시에 받아 주세요.", None)
    return CandidateAvailability(True, "로컬 실행 가능", local_path)


def configure_local_cuda() -> tuple[Path, ...]:
    """Register existing CUDA and bundled DLL folders before backend import."""
    cuda_path = Path(os.environ.get("CUDA_PATH", r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8"))
    site_packages = Path(__file__).resolve().parent / ".venv" / "Lib" / "site-packages"
    candidates = (
        cuda_path / "bin",
        site_packages / "nvidia" / "cudnn" / "bin",
        site_packages / "torch" / "lib",
        site_packages / "ctranslate2",
    )
    available = tuple(path for path in candidates if path.is_dir())
    new_paths = tuple(path for path in available if path not in _REGISTERED_DLL_DIRECTORIES)
    if new_paths:
        os.environ["PATH"] = os.pathsep.join((*map(str, new_paths), os.environ.get("PATH", "")))
        _REGISTERED_DLL_DIRECTORIES.extend(new_paths)
        if hasattr(os, "add_dll_directory"):
            _DLL_DIRECTORY_HANDLES.extend(os.add_dll_directory(str(path)) for path in new_paths)
    return available


def run_candidate(
    spec: CandidateSpec,
    audio_path: Path,
    *,
    transcription_profile: FasterWhisperDecodeProfile | None = None,
    transcription_variant: TranscriptionVariant | None = None,
    crisper_prompt_mode: CrisperPromptMode | None = None,
    crisper_decode_settings: CrisperDecodeSettings | None = None,
) -> ModelRun:
    """Run a candidate and return the stable public model result."""
    return benchmark_candidate(
        spec,
        audio_path,
        transcription_profile=transcription_profile,
        transcription_variant=transcription_variant,
        crisper_prompt_mode=crisper_prompt_mode,
        crisper_decode_settings=crisper_decode_settings,
    ).model_run


def benchmark_candidate(
    spec: CandidateSpec,
    audio_path: Path,
    *,
    allow_model_downloads: bool = False,
    sentence_gap_seconds: float = SENTENCE_GAP_SECONDS,
    transcription_profile: FasterWhisperDecodeProfile | None = None,
    transcription_variant: TranscriptionVariant | None = None,
    crisper_prompt_mode: CrisperPromptMode | None = None,
    crisper_decode_settings: CrisperDecodeSettings | None = None,
) -> BenchmarkedRun:  # noqa: BROAD_EXCEPT_OK
    """Run local transcription, event analysis, and resource measurement."""
    started = time.perf_counter()
    sampler = ResourceSampler()
    sampler.start()
    load_seconds = 0.0
    transcription_seconds = 0.0
    analysis_seconds = 0.0
    words: tuple[WordTiming, ...] = ()
    events = ()
    event_detection_diagnostics: EventDetectionDiagnostics | None = None
    speech_rate_analysis: SpeechRateAnalysis | None = None
    error: str | None = None
    model = None
    resolved_variant = _resolve_transcription_variant(spec, transcription_variant)
    resolved_crisper_prompt_mode = _resolve_crisper_prompt_mode(
        spec, crisper_prompt_mode
    )
    resolved_crisper_decode_settings = _resolve_crisper_decode_settings(
        spec, crisper_decode_settings
    )
    try:
        configure_local_cuda()
        availability = inspect_candidate(
            spec, allow_model_downloads=allow_model_downloads,
        )
        if not audio_path.is_file():
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")
        if not availability.available or availability.local_model_path is None:
            raise RuntimeError(availability.reason)
        load_started = time.perf_counter()
        model = _load_model(
            spec,
            availability.local_model_path,
            resolved_crisper_decode_settings.runtime_backend
            if resolved_crisper_decode_settings is not None
            else None,
        )
        load_seconds = time.perf_counter() - load_started
        transcription_started = time.perf_counter()
        words = _transcribe(
            model,
            spec,
            audio_path,
            transcription_profile or PRESENTATION_DISFLUENCY_PROFILE,
            resolved_variant,
            resolved_crisper_prompt_mode,
            resolved_crisper_decode_settings,
        )
        transcription_seconds = time.perf_counter() - transcription_started
        if not words:
            raise EmptyKoreanTranscriptionError(spec.key)
        analysis_started = time.perf_counter()
        samples = load_wav_at_target_rate(audio_path)
        vad_result = vad_analysis(samples)
        voiced_spans = vad_result.voiced_spans
        silences = silences_from_voiced_spans(
            voiced_spans, PAUSE_ANALYSIS_MINIMUM_SECONDS
        )
        event_analysis = analyze_events(
            words,
            silences,
            lambda span: measure_word_audio_from_analysis(samples, vad_result, span),
        )
        merged_events = event_analysis.events
        speech_rate_analysis = analyze_speech_rate_events(
            words, voiced_spans, sentence_gap_seconds=sentence_gap_seconds
        )
        events = tuple(sorted(
            (*merged_events, *speech_rate_analysis.events),
            key=lambda event: (event.start_seconds, event.end_seconds, event.event_id),
        ))
        event_detection_diagnostics = event_analysis.diagnostics
        analysis_seconds = time.perf_counter() - analysis_started
    except Exception as exc:  # noqa: BROAD_EXCEPT_OK
        error = f"{type(exc).__name__}: {exc}"
    finally:
        del model
        _release_cuda_memory()
        resources = sampler.stop()
    duration = _wav_duration(audio_path)
    realtime_factor = transcription_seconds / duration if duration > 0.0 else 0.0
    metrics = RunMetrics(load_seconds, transcription_seconds, analysis_seconds, realtime_factor, resources.max_vram_mib, resources.average_gpu_percent, resources.max_process_ram_mib)
    run = ModelRun(
        spec.key,
        spec.compute_type,
        gpu_name(),
        words,
        events,
        metrics,
        error,
        _transcription_profile_id(spec, transcription_profile),
        resolved_variant.value,
        resolved_crisper_prompt_mode.value,
        resolved_crisper_decode_settings.runtime_backend.value
        if resolved_crisper_decode_settings is not None
        else None,
        resolved_crisper_decode_settings.hallucination_mitigation
        if resolved_crisper_decode_settings is not None
        else None,
    )
    return BenchmarkedRun(
        run,
        time.perf_counter() - started,
        resources,
        audio_path,
        event_detection_diagnostics,
        speech_rate_analysis,
    )


def _load_model(
    spec: CandidateSpec,
    local_path: Path,
    crisper_runtime_backend: CrisperRuntimeBackend | None = None,
):
    match spec.backend:
        case CandidateBackend.FASTER_WHISPER:
            from faster_whisper import WhisperModel
            return WhisperModel(str(local_path), device=spec.device, compute_type=spec.compute_type, local_files_only=True)
        case CandidateBackend.CRISPERWHISPER:
            from crisperwhisper import CrisperWhisperModel
            runtime_backend = (
                crisper_runtime_backend.value
                if crisper_runtime_backend is not None
                else "transformers" if sys.platform == "win32" else "ct2"
            )
            return CrisperWhisperModel(
                str(local_path),
                backend=runtime_backend,
                device=spec.device,
                compute_type=spec.compute_type,
            )
        case CandidateBackend.TRANSFORMERS:
            import torch
            from transformers import (
                AutoModelForSpeechSeq2Seq,
                AutoProcessor,
                pipeline,
            )
            dtype = torch.float16 if "float16" in spec.compute_type else torch.float32
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                str(local_path), dtype=dtype, local_files_only=True,
                low_cpu_mem_usage=True,
            ).to(spec.device).eval()
            processor = AutoProcessor.from_pretrained(
                str(local_path), local_files_only=True,
            )
            return pipeline(
                "automatic-speech-recognition", model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                dtype=dtype, device=spec.device,
            )
        case unreachable:
            assert_never(unreachable)


def _transcribe(
    model,
    spec: CandidateSpec,
    audio_path: Path,
    transcription_profile: FasterWhisperDecodeProfile = PRESENTATION_DISFLUENCY_PROFILE,
    transcription_variant: TranscriptionVariant | str | None = None,
    crisper_prompt_mode: CrisperPromptMode | str | None = None,
    crisper_decode_settings: CrisperDecodeSettings | None = None,
) -> tuple[WordTiming, ...]:
    variant = _resolve_transcription_variant(spec, transcription_variant)
    prompt_mode = _resolve_crisper_prompt_mode(spec, crisper_prompt_mode)
    decode_settings = _resolve_crisper_decode_settings(
        spec, crisper_decode_settings
    )
    match spec.backend:
        case CandidateBackend.FASTER_WHISPER:
            match variant:
                case TranscriptionVariant.PURE:
                    return transcribe_without_filler_rescue(
                        model, audio_path, transcription_profile.to_transcribe_kwargs()
                    )
                case TranscriptionVariant.WINDOW_FILLER_RESCUE:
                    return transcribe_with_filler_rescue(
                        model, audio_path, transcription_profile.to_transcribe_kwargs()
                    )
                case unreachable:
                    assert_never(unreachable)
        case CandidateBackend.CRISPERWHISPER:
            match prompt_mode:
                case CrisperPromptMode.NATIVE_VERBATIM:
                    result = transcribe_korean_native_verbatim(
                        model,
                        audio_path,
                        language=spec.language,
                        word_timestamps=True,
                        hallucination_mitigation=decode_settings.hallucination_mitigation,
                    )
                case CrisperPromptMode.NEUTRAL_PREFIX:
                    result = transcribe_korean_with_transformers_fallback(
                        model,
                        audio_path,
                        language=spec.language,
                        word_timestamps=True,
                        hallucination_mitigation=decode_settings.hallucination_mitigation,
                    )
                case CrisperPromptMode.NOT_APPLICABLE:
                    raise RuntimeError("CrisperWhisper prompt mode is required.")
                case unreachable:
                    assert_never(unreachable)
            words = crisper_word_timings(result)
            match variant:
                case TranscriptionVariant.PURE:
                    return words
                case TranscriptionVariant.WINDOW_FILLER_RESCUE:
                    return merge_rescued_fillers(
                        words,
                        rescue_crisper_filler_words(
                            model,
                            audio_path,
                            language=spec.language,
                            word_timestamps=True,
                            use_neutral_prompt=(
                                prompt_mode is CrisperPromptMode.NEUTRAL_PREFIX
                            ),
                            hallucination_mitigation=decode_settings.hallucination_mitigation,
                        ),
                    )
                case unreachable:
                    assert_never(unreachable)
        case CandidateBackend.TRANSFORMERS:
            audio_input = {
                "raw": load_wav_at_target_rate(audio_path),
                "sampling_rate": TARGET_SAMPLE_RATE,
            }
            result = model(audio_input, return_timestamps="word", generate_kwargs={"language": spec.language, "task": "transcribe"})
            return tuple(WordTiming(chunk["text"].strip(), chunk["timestamp"][0], chunk["timestamp"][1]) for chunk in result.get("chunks", ()) if chunk["text"].strip() and chunk["timestamp"][0] is not None and chunk["timestamp"][1] is not None)
        case unreachable:
            assert_never(unreachable)


def _resolve_transcription_variant(
    spec: CandidateSpec,
    transcription_variant: TranscriptionVariant | str | None,
) -> TranscriptionVariant:
    if transcription_variant is not None:
        return TranscriptionVariant(transcription_variant)
    match spec.backend:
        case CandidateBackend.FASTER_WHISPER:
            return TranscriptionVariant.WINDOW_FILLER_RESCUE
        case CandidateBackend.CRISPERWHISPER | CandidateBackend.TRANSFORMERS:
            return TranscriptionVariant.PURE
        case unreachable:
            assert_never(unreachable)


def _resolve_crisper_prompt_mode(
    spec: CandidateSpec,
    prompt_mode: CrisperPromptMode | str | None,
) -> CrisperPromptMode:
    if prompt_mode is not None:
        return CrisperPromptMode(prompt_mode)
    match spec.backend:
        case CandidateBackend.CRISPERWHISPER:
            return CrisperPromptMode.NEUTRAL_PREFIX
        case CandidateBackend.FASTER_WHISPER | CandidateBackend.TRANSFORMERS:
            return CrisperPromptMode.NOT_APPLICABLE
        case unreachable:
            assert_never(unreachable)


def _resolve_crisper_decode_settings(
    spec: CandidateSpec,
    settings: CrisperDecodeSettings | None,
) -> CrisperDecodeSettings | None:
    if settings is not None:
        return settings
    match spec.backend:
        case CandidateBackend.CRISPERWHISPER:
            return CrisperDecodeSettings(
                CrisperRuntimeBackend.TRANSFORMERS
                if sys.platform == "win32"
                else CrisperRuntimeBackend.CT2
            )
        case CandidateBackend.FASTER_WHISPER | CandidateBackend.TRANSFORMERS:
            return None
        case unreachable:
            assert_never(unreachable)


def _transcription_profile_id(
    spec: CandidateSpec,
    transcription_profile: FasterWhisperDecodeProfile | None,
) -> str | None:
    if spec.backend is CandidateBackend.FASTER_WHISPER:
        return (transcription_profile or PRESENTATION_DISFLUENCY_PROFILE).profile_id
    return None


def _wav_duration(audio_path: Path) -> float:
    try:
        with wave.open(str(audio_path), "rb") as source:
            return source.getnframes() / source.getframerate()
    except (FileNotFoundError, wave.Error, ZeroDivisionError):
        return 0.0
