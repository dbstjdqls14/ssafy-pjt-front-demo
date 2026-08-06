package com.ssafy.b109.aivo.presentation.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PresentationPracticeCompleteRequest(
        @NotNull
        @Positive
        Long durationMs
) {
}