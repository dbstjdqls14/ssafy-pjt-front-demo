package com.ssafy.b109.aivo.presentation.dto;

import com.ssafy.b109.aivo.presentation.entity.PresentationProcessingStatus;

public record PresentationStatusResponse(
        Long presentationId,
        PresentationProcessingStatus processingStatus
) {
}
