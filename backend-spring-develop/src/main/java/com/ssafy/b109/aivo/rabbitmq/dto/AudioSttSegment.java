package com.ssafy.b109.aivo.rabbitmq.dto;

public record AudioSttSegment(
        String text,
        Float timestampSt,
        Float timestampEnd
) {
}
