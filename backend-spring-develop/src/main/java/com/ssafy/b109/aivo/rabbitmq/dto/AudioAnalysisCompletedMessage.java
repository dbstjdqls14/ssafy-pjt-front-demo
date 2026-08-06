package com.ssafy.b109.aivo.rabbitmq.dto;

import java.util.List;

public record AudioAnalysisCompletedMessage(
        String eventType,
        String requestId,
        Long practiceId,
        Long audioId,
        List<AudioSttSegment> segments
) {
}
