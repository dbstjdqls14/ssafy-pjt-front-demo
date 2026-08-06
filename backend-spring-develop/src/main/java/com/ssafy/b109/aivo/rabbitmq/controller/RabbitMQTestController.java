package com.ssafy.b109.aivo.rabbitmq.controller;

import com.ssafy.b109.aivo.global.rabbitmq.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/test/rabbitmq")
@RequiredArgsConstructor
public class RabbitMQTestController {

    private final RabbitTemplate rabbitTemplate;

    @PostMapping
    public ResponseEntity<Void> publish() {

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ANALYSIS_EXCHANGE,
                RabbitMQConfig.LLM_ROUTING_KEY,
                Map.of(
                        "jobId", "test-job-1",
                        "message", "RabbitMQ 연결 테스트"
                )
        );

        return ResponseEntity.ok().build();
    }

    @PostMapping("/result")
    public ResponseEntity<Void> publishResult(
            @RequestBody Map<String, Object> body
    ) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ANALYSIS_EXCHANGE,
                RabbitMQConfig.RESULT_ROUTING_KEY,
                body
        );

        return ResponseEntity.accepted().build();
    }
}
