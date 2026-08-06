import asyncio
import logging

from app.core.config import settings
from app.messaging.constants import LLM_ROUTING_KEY
from app.messaging.contracts import TaskType, WorkerType
from app.services.llm_tasks import LlmTaskService
from app.workers.base import RabbitWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


async def main() -> None:
    service = LlmTaskService()
    service.load_models()

    worker = RabbitWorker(
        worker_name="aivo-llm-worker",
        worker_type=WorkerType.LLM,
        queue_name=settings.rabbitmq_llm_queue,
        binding_key=LLM_ROUTING_KEY,
        prefetch_count=settings.llm_worker_prefetch,
        handlers={
            TaskType.AUDIENCE_QUESTION_GENERATION: service.handle_audience_question,
            TaskType.FEEDBACK_GENERATION: service.handle_feedback,
            TaskType.REPORT_GENERATION: service.handle_report,
        },
    )

    await worker.run_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.getLogger(__name__).info("LLM worker interrupted")
