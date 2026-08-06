import asyncio
import json
import logging

from aio_pika import IncomingMessage

from app.core.config import settings
from app.messaging.contracts import parse_event_bytes
from app.messaging.rabbitmq import RabbitMQClient, queue_arguments_for

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


async def main() -> None:
    client = RabbitMQClient()
    try:
        await client.connect("aivo-result-test-consumer")
        await client.declare_topology()
        channel = await client.create_consumer_channel(prefetch_count=1)
        queue = await channel.declare_queue(
            settings.rabbitmq_backend_result_queue,
            durable=True,
            auto_delete=False,
            exclusive=False,
            arguments=queue_arguments_for(settings.rabbitmq_backend_result_queue),
        )

        async def on_message(message: IncomingMessage) -> None:
            try:
                event = parse_event_bytes(message.body)
                print("routing key:", message.routing_key)
                print("eventId:", event.eventId)
                print("jobId:", event.jobId)
                print("correlationId:", event.correlationId)
                print("workerType:", event.workerType.value)
                print("taskType:", event.taskType.value)
                print("status:", event.status.value)
                print("payload:", json.dumps(event.payload, ensure_ascii=False, indent=2))
                print("-" * 80)
                await message.ack()
            except Exception:
                logging.exception("Failed to consume result message")
                await message.reject(requeue=False)

        await queue.consume(on_message, no_ack=False)
        logging.info("Result consumer started: queue=%s", settings.rabbitmq_backend_result_queue)
        await asyncio.Event().wait()
    finally:
        await client.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.getLogger(__name__).info("Result consumer interrupted")
