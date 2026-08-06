from pathlib import Path
from threading import Lock

from app.domains.stt.providers import FasterWhisperProvider, SttProvider, build_stt_provider
from app.domains.stt.schemas import TranscriptionResult

_provider: SttProvider | None = None
_filler_model_provider: FasterWhisperProvider | None = None
_provider_lock = Lock()


def transcribe_audio(audio_path: Path, filename: str | None) -> TranscriptionResult:
    return get_provider().transcribe(audio_path, filename)


def get_provider() -> SttProvider:
    global _provider

    with _provider_lock:
        if _provider is None:
            _provider = build_stt_provider()
        return _provider


def get_model():
    global _filler_model_provider

    with _provider_lock:
        if _filler_model_provider is None:
            _filler_model_provider = FasterWhisperProvider()
        return _filler_model_provider.get_model()


def reset_provider_for_tests() -> None:
    global _provider, _filler_model_provider
    with _provider_lock:
        _provider = None
        _filler_model_provider = None
