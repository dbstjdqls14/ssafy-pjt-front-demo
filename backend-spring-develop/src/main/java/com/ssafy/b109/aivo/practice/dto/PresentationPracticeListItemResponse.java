package com.ssafy.b109.aivo.practice.dto;

import com.ssafy.b109.aivo.presentation.entity.PresentationProcessingStatus;

import java.time.LocalDateTime;

public record PresentationPracticeListItemResponse(
        Long practiceId,
        Long presentationId,
        String title,
        String description,
        Long durationSec,
        LocalDateTime createdAt

) {
}