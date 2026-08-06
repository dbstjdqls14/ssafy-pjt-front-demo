import asyncio
import logging
from uuid import uuid4

from app.messaging.contracts import AiEvent, EventStatus, TaskType, WorkerType, utc_now
from app.messaging.rabbitmq import RabbitMQClient
from app.messaging.routing import create_routing_key

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


async def main() -> None:
    event_id = uuid4()
    event = AiEvent(
        eventId=event_id,
        jobId=uuid4(),
        correlationId=event_id,
        workerType=WorkerType.AUDIO,
        taskType=TaskType.STT,
        status=EventStatus.REQUESTED,
        schemaVersion=1,
        occurredAt=utc_now(),
        payload={
            "presentationId": 100,
            "audioUrl": "https://example.com/audio/test.webm",
            "language": "ko",
        },
    )
    routing_key = create_routing_key(event.workerType, event.taskType, event.status)

    client = RabbitMQClient()
    try:
        await client.connect("aivo-audio-test-publisher")
        await client.declare_topology()
        await client.publish_event(event, routing_key)
        logging.info("Audio test event published: eventId=%s routingKey=%s", event.eventId, routing_key)
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
