from app.messaging.contracts import AiEvent
from app.messaging.rabbitmq import RabbitMQClient
from app.messaging.routing import create_routing_key


class ResultPublisher:
    def __init__(self, rabbitmq_client: RabbitMQClient) -> None:
        self._rabbitmq_client = rabbitmq_client

    async def publish(self, event: AiEvent) -> None:
        routing_key = create_routing_key(
            worker_type=event.workerType,
            task_type=event.taskType,
            status=event.status,
        )
        await self._rabbitmq_client.publish_event(event, routing_key)
