import asyncio
import logging

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import (
    AbstractRobustChannel,
    AbstractRobustConnection,
    AbstractRobustExchange,
)

from app.core.config import settings
from app.messaging.constants import (
    APP_ID,
    AUDIO_RETRY_ROUTING_KEY,
    AUDIO_ROUTING_KEY,
    LLM_RETRY_ROUTING_KEY,
    LLM_ROUTING_KEY,
    RESULT_RETRY_ROUTING_KEY,
    RESULT_ROUTING_KEY,
)
from app.messaging.contracts import AiEvent

logger = logging.getLogger(__name__)


def queue_arguments_for(queue_name: str) -> dict[str, object] | None:
    if queue_name == settings.rabbitmq_audio_queue:
        return {
            "x-dead-letter-exchange": settings.rabbitmq_exchange,
            "x-dead-letter-routing-key": AUDIO_RETRY_ROUTING_KEY,
        }

    if queue_name == settings.rabbitmq_llm_queue:
        return {
            "x-dead-letter-exchange": settings.rabbitmq_exchange,
            "x-dead-letter-routing-key": LLM_RETRY_ROUTING_KEY,
        }

    if queue_name == settings.rabbitmq_backend_result_queue:
        return {
            "x-dead-letter-exchange": settings.rabbitmq_exchange,
            "x-dead-letter-routing-key": RESULT_RETRY_ROUTING_KEY,
        }

    return None


class RabbitMQClient:
    def __init__(self) -> None:
        self._connection: AbstractRobustConnection | None = None
        self._publisher_channel: AbstractRobustChannel | None = None
        self._exchange: AbstractRobustExchange | None = None

    async def connect(self, connection_name: str) -> None:
        self._connection = await aio_pika.connect_robust(
            settings.rabbitmq_url,
            client_properties={"connection_name": connection_name},
        )
        self._publisher_channel = await self._connection.channel(
            publisher_confirms=True,
            on_return_raises=True,
        )
        logger.info("RabbitMQ connected: %s", connection_name)

    async def declare_topology(self) -> None:
        publisher_channel = self._require_publisher_channel()
        exchange = await publisher_channel.declare_exchange(
            settings.rabbitmq_exchange,
            ExchangeType.DIRECT,
            durable=True,
            auto_delete=False,
        )
        self._exchange = exchange

        audio_queue = await publisher_channel.declare_queue(
            settings.rabbitmq_audio_queue,
            durable=True,
            auto_delete=False,
            exclusive=False,
            arguments=queue_arguments_for(settings.rabbitmq_audio_queue),
        )
        await audio_queue.bind(exchange, routing_key=AUDIO_ROUTING_KEY)

        llm_queue = await publisher_channel.declare_queue(
            settings.rabbitmq_llm_queue,
            durable=True,
            auto_delete=False,
            exclusive=False,
            arguments=queue_arguments_for(settings.rabbitmq_llm_queue),
        )
        await llm_queue.bind(exchange, routing_key=LLM_ROUTING_KEY)

        result_queue = await publisher_channel.declare_queue(
            settings.rabbitmq_backend_result_queue,
            durable=True,
            auto_delete=False,
            exclusive=False,
            arguments=queue_arguments_for(settings.rabbitmq_backend_result_queue),
        )
        await result_queue.bind(exchange, routing_key=RESULT_ROUTING_KEY)

        logger.info("RabbitMQ topology declared")

    async def create_consumer_channel(self, prefetch_count: int) -> AbstractRobustChannel:
        connection = self._require_connection()
        channel = await connection.channel(publisher_confirms=False)
        await channel.set_qos(prefetch_count=prefetch_count)
        return channel

    async def publish_event(self, event: AiEvent, routing_key: str) -> None:
        exchange = self._require_exchange()
        body = event.model_dump_json().encode("utf-8")
        message = Message(
            body=body,
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
            content_encoding="utf-8",
            message_id=str(event.eventId),
            correlation_id=str(event.correlationId),
            app_id=APP_ID,
            type=f"{event.taskType.value}.{event.status.value}",
            headers={
                "job_id": str(event.jobId),
                "worker_type": event.workerType.value,
                "task_type": event.taskType.value,
                "event_status": event.status.value,
                "schema_version": event.schemaVersion,
            },
        )

        await asyncio.wait_for(
            exchange.publish(message, routing_key=routing_key, mandatory=True),
            timeout=settings.rabbitmq_publish_timeout,
        )
        logger.info(
            "Published RabbitMQ event: eventId=%s routingKey=%s status=%s",
            event.eventId,
            routing_key,
            event.status.value,
        )

    async def close(self) -> None:
        if self._publisher_channel and not self._publisher_channel.is_closed:
            await self._publisher_channel.close()

        if self._connection and not self._connection.is_closed:
            await self._connection.close()

        logger.info("RabbitMQ connection closed")

    def _require_connection(self) -> AbstractRobustConnection:
        if self._connection is None:
            raise RuntimeError("RabbitMQ connection is not initialized")
        return self._connection

    def _require_publisher_channel(self) -> AbstractRobustChannel:
        if self._publisher_channel is None:
            raise RuntimeError("RabbitMQ publisher channel is not initialized")
        return self._publisher_channel

    def _require_exchange(self) -> AbstractRobustExchange:
        if self._exchange is None:
            raise RuntimeError("RabbitMQ exchange is not initialized")
        return self._exchange
