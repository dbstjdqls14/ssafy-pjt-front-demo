package com.ssafy.b109.aivo.rabbitmq.publisher;

import com.ssafy.b109.aivo.global.rabbitmq.config.RabbitMQConfig;
import com.ssafy.b109.aivo.rabbitmq.entity.EventType;
import com.ssafy.b109.aivo.rabbitmq.entity.MsgStatus;
import com.ssafy.b109.aivo.rabbitmq.entity.RabbitmqEvent;
import com.ssafy.b109.aivo.rabbitmq.repository.RabbitmqEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AnalysisMessagePublisher {
    private final RabbitTemplate rabbitTemplate;
    private final RabbitmqEventRepository rabbitmqEventRepository;

    public void publish(String routingKey, Object message){
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ANALYSIS_EXCHANGE,
                routingKey,
                message
        );
    }

    public void publish(String routingKey, EventType eventType, UUID requestId, Object message){
        publish(routingKey, message);
        saveEvent(eventType, requestId, MsgStatus.PROCESS);
    }

    private void saveEvent(EventType eventType, UUID requestId, MsgStatus status) {
        RabbitmqEvent event = new RabbitmqEvent();
        event.setUuid(requestId.toString());
        event.setEventType(eventType);
        event.setStatus(status);

        rabbitmqEventRepository.save(event);
    }
}
