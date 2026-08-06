package com.ssafy.b109.aivo.rabbitmq.dto;

import com.ssafy.b109.aivo.rabbitmq.entity.AnalysisEventType;

import java.time.Instant;
import java.util.UUID;

public record AudioSTTRequest(
        AnalysisEventType eventType,
        UUID requestId,
        Long practiceId,
        Long audioId,
        Instant occurredAt,
        String audioUrl
) {
}
