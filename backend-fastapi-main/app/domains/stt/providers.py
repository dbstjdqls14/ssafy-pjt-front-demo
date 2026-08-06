import logging
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Protocol

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.domains.stt.schemas import TranscriptionResult, TranscriptionSegment

logger = logging.getLogger(__name__)


class SttProvider(Protocol):
    provider_name: str

    def transcribe(self, audio_path: Path, filename: str | None) -> TranscriptionResult:
        ...


class GmsWhisperProvider:
    provider_name = "gms"

    def transcribe(self, audio_path: Path, filename: str | None) -> TranscriptionResult:
        if not settings.gms_api_key:
            raise HTTPException(status_code=500, detail="GMS_KEY is not configured.")

        started_at = perf_counter()
        request_filename = filename or audio_path.name
        url = f"{settings.gms_base_url.rstrip('/')}/audio/transcriptions"
        data = {
            "model": settings.gms_whisper_model,
            "response_format": "verbose_json",
        }
        if settings.whisper_language:
            data["language"] = settings.whisper_language

        logger.info(
            "GMS Whisper STT started: filename=%s model=%s url=%s",
            request_filename,
            settings.gms_whisper_model,
            url,
        )

        with audio_path.open("rb") as audio_file:
            try:
                response = httpx.post(
                    url,
                    headers={"Authorization": f"Bearer {settings.gms_api_key}"},
                    data=data,
                    files={
                        "file": (
                            request_filename,
                            audio_file,
                            "application/octet-stream",
                        ),
                    },
                    timeout=settings.gms_timeout_seconds,
                )
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=502, detail=f"GMS Whisper request failed: {exc}") from exc

        if response.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"GMS Whisper failed: {response.status_code} {response.text[:500]}",
            )

        payload = response.json()
        text = str(payload.get("text") or "").strip()
        segments = [
            TranscriptionSegment(
                start=float(segment.get("start") or 0),
                end=float(segment.get("end") or segment.get("start") or 0),
                text=str(segment.get("text") or "").strip(),
            )
            for segment in payload.get("segments", [])
            if str(segment.get("text") or "").strip()
        ]
        elapsed_seconds = perf_counter() - started_at
        logger.info(
            "GMS Whisper STT completed: filename=%s elapsedSeconds=%.3f",
            request_filename,
            elapsed_seconds,
        )

        return TranscriptionResult(
            text=text,
            segments=segments,
            details={
                "filename": request_filename,
                "provider": self.provider_name,
                "model_source": settings.gms_whisper_model,
                "transcribe_elapsed_seconds": round(elapsed_seconds, 3),
            },
        )


class FasterWhisperProvider:
    provider_name = "faster_whisper"

    def __init__(self) -> None:
        self._model = None
        self._model_source: str | None = None
        self._model_lock = Lock()

    def transcribe(self, audio_path: Path, filename: str | None) -> TranscriptionResult:
        logger.info("faster-whisper STT started: filename=%s", filename)
        started_at = perf_counter()
        model, source = self._get_model()
        segments, info = model.transcribe(
            str(audio_path),
            language=settings.whisper_language,
            beam_size=5,
            vad_filter=True,
        )

        segment_rows = [
            TranscriptionSegment(
                start=segment.start,
                end=segment.end,
                text=segment.text.strip(),
            )
            for segment in segments
        ]
        elapsed_seconds = perf_counter() - started_at
        logger.info("faster-whisper STT completed: filename=%s elapsedSeconds=%.3f", filename, elapsed_seconds)
        text = "\n".join(segment.text for segment in segment_rows).strip()

        return TranscriptionResult(
            text=text,
            segments=segment_rows,
            details={
                "filename": filename,
                "provider": self.provider_name,
                "model_source": source,
                "detected_language": getattr(info, "language", None),
                "language_probability": getattr(info, "language_probability", None),
                "duration": getattr(info, "duration", None),
                "transcribe_elapsed_seconds": round(elapsed_seconds, 3),
            },
        )

    def get_model(self):
        return self._get_model()

    def _get_model(self):
        from faster_whisper import WhisperModel

        with self._model_lock:
            if self._model is not None and self._model_source is not None:
                return self._model, self._model_source

            model_source = resolve_model_source()
            settings.whisper_model_root.mkdir(parents=True, exist_ok=True)

            try:
                logger.info(
                    "Loading faster-whisper model: source=%s device=%s computeType=%s root=%s",
                    model_source,
                    settings.whisper_device,
                    settings.whisper_compute_type,
                    settings.whisper_model_root,
                )
                self._model = WhisperModel(
                    model_source,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                    download_root=str(settings.whisper_model_root),
                )
            except Exception as exception:
                if settings.whisper_device == "cuda":
                    logger.warning(
                        "CUDA model loading failed. Falling back to CPU int8: %s",
                        exception,
                    )
                    self._model = WhisperModel(
                        model_source,
                        device="cpu",
                        compute_type="int8",
                        download_root=str(settings.whisper_model_root),
                    )
                else:
                    raise

            self._model_source = str(model_source)
            return self._model, self._model_source


def build_stt_provider() -> SttProvider:
    provider = settings.stt_provider.strip().lower()
    if provider in {"gms", "gms_whisper", "openai"}:
        return GmsWhisperProvider()
    if provider in {"faster_whisper", "faster-whisper", "local"}:
        return FasterWhisperProvider()
    raise ValueError(f"Unsupported STT_PROVIDER: {settings.stt_provider}")


def resolve_model_source() -> str:
    if settings.whisper_model_path:
        path = Path(settings.whisper_model_path).expanduser()
        if path.exists():
            return str(path)
        raise FileNotFoundError(f"WHISPER_MODEL_PATH does not exist: {path}")

    local_model = find_local_model()
    if local_model:
        return str(local_model)

    return settings.whisper_model


def find_local_model() -> Path | None:
    search_roots = [
        settings.whisper_model_root,
        settings.workspace_root / "models",
        settings.workspace_root / "cache" / "huggingface" / "hub",
    ]

    for root in search_roots:
        if not root.exists():
            continue

        direct_candidates = [
            root / settings.whisper_model,
            root / f"faster-whisper-{settings.whisper_model}",
            root / f"Systran--faster-whisper-{settings.whisper_model}",
            root / "snapshots",
        ]
        for candidate in direct_candidates:
            model_dir = first_valid_model_dir(candidate)
            if model_dir:
                return model_dir

        for candidate in root.rglob("*"):
            if candidate.is_dir():
                model_dir = first_valid_model_dir(candidate)
                if model_dir:
                    return model_dir

    return None


def first_valid_model_dir(path: Path) -> Path | None:
    if path.is_dir() and (path / "model.bin").exists() and (path / "config.json").exists():
        return path

    if path.is_dir():
        for child in path.iterdir():
            if child.is_dir() and (child / "model.bin").exists() and (child / "config.json").exists():
                return child

    return None
