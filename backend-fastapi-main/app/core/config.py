from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.messaging.constants import (
    ANALYSIS_EXCHANGE,
    AUDIO_QUEUE,
    AUDIO_RETRY_QUEUE,
    DEAD_QUEUE,
    LLM_QUEUE,
    LLM_RETRY_QUEUE,
    RESULT_QUEUE,
    RESULT_RETRY_QUEUE,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env", "backend-fastapi/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    whisper_model: str = Field("large-v3-turbo", validation_alias="WHISPER_MODEL")
    whisper_model_path: str | None = Field(None, validation_alias="WHISPER_MODEL_PATH")
    whisper_model_root: Path = Field(
        Path("/workspace/models/faster-whisper"),
        validation_alias="WHISPER_MODEL_ROOT",
    )
    workspace_root: Path = Field(Path("/workspace"), validation_alias="WORKSPACE_ROOT")
    upload_root: Path = Field(Path("/tmp/aivo-uploads"), validation_alias="UPLOAD_ROOT")
    whisper_device: str = Field("cuda", validation_alias="WHISPER_DEVICE")
    whisper_compute_type: str = Field("float16", validation_alias="WHISPER_COMPUTE_TYPE")
    whisper_language: str | None = Field(None, validation_alias="WHISPER_LANGUAGE")
    stt_provider: str = Field("gms", validation_alias="STT_PROVIDER")
    gms_api_key: str | None = Field(None, validation_alias="GMS_KEY")
    gms_base_url: str = Field(
        "https://gms.ssafy.io/gmsapi/api.openai.com/v1",
        validation_alias="GMS_BASE_URL",
    )
    gms_whisper_model: str = Field("whisper-1", validation_alias="GMS_WHISPER_MODEL")
    gms_timeout_seconds: float = Field(120.0, validation_alias="GMS_TIMEOUT_SECONDS")

    rabbitmq_url: str = Field(
        "amqp://guest:guest@localhost:5672/",
        validation_alias="RABBITMQ_URL",
    )
    rabbitmq_exchange: str = Field(ANALYSIS_EXCHANGE, validation_alias="RABBITMQ_EXCHANGE")
    rabbitmq_audio_queue: str = Field(AUDIO_QUEUE, validation_alias="RABBITMQ_AUDIO_QUEUE")
    rabbitmq_llm_queue: str = Field(LLM_QUEUE, validation_alias="RABBITMQ_LLM_QUEUE")
    rabbitmq_backend_result_queue: str = Field(
        RESULT_QUEUE,
        validation_alias="RABBITMQ_BACKEND_RESULT_QUEUE",
    )
    rabbitmq_audio_retry_queue: str = Field(
        AUDIO_RETRY_QUEUE,
        validation_alias="RABBITMQ_AUDIO_RETRY_QUEUE",
    )
    rabbitmq_llm_retry_queue: str = Field(
        LLM_RETRY_QUEUE,
        validation_alias="RABBITMQ_LLM_RETRY_QUEUE",
    )
    rabbitmq_result_retry_queue: str = Field(
        RESULT_RETRY_QUEUE,
        validation_alias="RABBITMQ_RESULT_RETRY_QUEUE",
    )
    rabbitmq_dead_queue: str = Field(DEAD_QUEUE, validation_alias="RABBITMQ_DEAD_QUEUE")
    audio_worker_prefetch: int = Field(1, validation_alias="AUDIO_WORKER_PREFETCH")
    llm_worker_prefetch: int = Field(2, validation_alias="LLM_WORKER_PREFETCH")
    rabbitmq_publish_timeout: float = Field(10.0, validation_alias="RABBITMQ_PUBLISH_TIMEOUT")

    @field_validator("whisper_model_path", "whisper_language", "gms_api_key", mode="before")
    @classmethod
    def empty_string_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value


settings = Settings()
