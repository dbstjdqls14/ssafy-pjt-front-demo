import asyncio
import shutil
import subprocess
import tempfile
from pathlib import Path
from time import perf_counter

from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.domains.audio_analysis.filler_model import analyze_filler_audio
from app.domains.audio_analysis.schemas import (
    AudioAnalysisResponse,
    AudioPracticeAnalysisResponse,
    AudioSttSegment,
    FullAudioSttResponse,
)


class AudioAnalysisService:
    async def analyze_chunk(
        self,
        interview_id: int,
        audio: UploadFile,
        sequence: int | None,
    ) -> AudioAnalysisResponse:
        settings.upload_root.mkdir(parents=True, exist_ok=True)
        suffix = Path(audio.filename or "audio").suffix or ".wav"

        with tempfile.NamedTemporaryFile(
            prefix=f"interview-{interview_id}-chunk-",
            suffix=suffix,
            dir=settings.upload_root,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            shutil.copyfileobj(audio.file, temp_file)

        converted_path: Path | None = None
        try:
            size = temp_path.stat().st_size
            converted_path = await asyncio.to_thread(convert_to_pcm_wav, temp_path)
            validate_wav_file(converted_path)
            analysis = await asyncio.to_thread(analyze_filler_audio, converted_path)
        finally:
            temp_path.unlink(missing_ok=True)
            if converted_path is not None:
                converted_path.unlink(missing_ok=True)

        return AudioAnalysisResponse(
            interviewId=interview_id,
            sequence=sequence,
            filename=audio.filename,
            contentType=audio.content_type,
            size=size,
            fillerCount=analysis.filler_count,
            silenceDetected=analysis.silence_detected,
            stutterDetected=analysis.stutter_detected,
            silenceDurationMs=analysis.silence_duration_ms,
            averageWpm=analysis.average_wpm,
            feedback=analysis.feedback,
        )

    async def analyze_practice_chunk(
        self,
        practice_id: int,
        audio: UploadFile,
        sequence: int | None,
    ) -> AudioPracticeAnalysisResponse:
        settings.upload_root.mkdir(parents=True, exist_ok=True)
        suffix = Path(audio.filename or "audio").suffix or ".wav"

        with tempfile.NamedTemporaryFile(
            prefix=f"practice-{practice_id}-chunk-",
            suffix=suffix,
            dir=settings.upload_root,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            shutil.copyfileobj(audio.file, temp_file)

        converted_path: Path | None = None
        try:
            size = temp_path.stat().st_size
            converted_path = await asyncio.to_thread(convert_to_pcm_wav, temp_path)
            validate_wav_file(converted_path)
            analysis = await asyncio.to_thread(analyze_filler_audio, converted_path)
        finally:
            temp_path.unlink(missing_ok=True)
            if converted_path is not None:
                converted_path.unlink(missing_ok=True)

        return AudioPracticeAnalysisResponse(
            practiceId=practice_id,
            sequence=sequence,
            filename=audio.filename,
            contentType=audio.content_type,
            size=size,
            fillerCount=analysis.filler_count,
            silenceDetected=analysis.silence_detected,
            stutterDetected=analysis.stutter_detected,
            silenceDurationMs=analysis.silence_duration_ms,
            averageWpm=analysis.average_wpm,
            feedback=analysis.feedback,
        )

    async def transcribe_full_audio(
        self,
        interview_id: int,
        audio: UploadFile,
    ) -> FullAudioSttResponse:
        settings.upload_root.mkdir(parents=True, exist_ok=True)
        suffix = Path(audio.filename or "audio").suffix or ".wav"
        started_at = perf_counter()

        with tempfile.NamedTemporaryFile(
            prefix=f"interview-{interview_id}-full-",
            suffix=suffix,
            dir=settings.upload_root,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            shutil.copyfileobj(audio.file, temp_file)

        try:
            from app.domains.stt.service import transcribe_audio

            result = await asyncio.to_thread(transcribe_audio, temp_path, audio.filename)
        finally:
            temp_path.unlink(missing_ok=True)

        return FullAudioSttResponse(
            interviewId=interview_id,
            filename=audio.filename,
            transcript=result.text,
            segments=[
                AudioSttSegment(
                    start=segment.start,
                    end=segment.end,
                    startTimeMs=round(segment.start * 1000),
                    endTimeMs=round(segment.end * 1000),
                    text=segment.text,
                )
                for segment in result.segments
            ],
            processingTimeMs=round((perf_counter() - started_at) * 1000),
        )


def convert_to_pcm_wav(source_path: Path) -> Path:
    with tempfile.NamedTemporaryFile(
        prefix=f"{source_path.stem}-pcm-",
        suffix=".wav",
        dir=settings.upload_root,
        delete=False,
    ) as converted_file:
        converted_path = Path(converted_file.name)

    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(converted_path),
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        converted_path.unlink(missing_ok=True)
        if is_wav_file(source_path):
            return source_path
        raise HTTPException(
            status_code=500,
            detail="ffmpeg is not installed or not available on PATH.",
        ) from exc

    if result.returncode != 0:
        converted_path.unlink(missing_ok=True)
        error_message = (result.stderr or "unsupported audio format").strip()
        raise HTTPException(
            status_code=400,
            detail=f"Audio conversion failed: {error_message[:500]}",
        )

    return converted_path


def validate_wav_file(audio_path: Path) -> None:
    if not is_wav_file(audio_path):
        raise HTTPException(
            status_code=400,
            detail="Audio chunk must be a real PCM WAV file. The uploaded file does not start with RIFF/WAVE.",
        )


def is_wav_file(audio_path: Path) -> bool:
    header = audio_path.read_bytes()[:12]
    return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WAVE"
