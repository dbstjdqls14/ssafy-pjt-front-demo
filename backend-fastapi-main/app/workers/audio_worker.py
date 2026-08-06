import asyncio
import logging

from app.core.config import settings
from app.messaging.constants import AUDIO_ROUTING_KEY
from app.messaging.contracts import TaskType, WorkerType
from app.services.audio_tasks import AudioTaskService
from app.workers.base import RabbitWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


async def main() -> None:
    service = AudioTaskService()
    service.load_models()

    worker = RabbitWorker(
        worker_name="aivo-audio-worker",
        worker_type=WorkerType.AUDIO,
        queue_name=settings.rabbitmq_audio_queue,
        binding_key=AUDIO_ROUTING_KEY,
        prefetch_count=settings.audio_worker_prefetch,
        handlers={
            TaskType.AUDIO_ANALYSIS: service.handle_audio_analysis,
            TaskType.STT: service.handle_stt,
            TaskType.VOICE_ANALYSIS: service.handle_voice_analysis,
            TaskType.PRONUNCIATION_ANALYSIS: service.handle_pronunciation_analysis,
        },
    )

    await worker.run_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.getLogger(__name__).info("Audio worker interrupted")
