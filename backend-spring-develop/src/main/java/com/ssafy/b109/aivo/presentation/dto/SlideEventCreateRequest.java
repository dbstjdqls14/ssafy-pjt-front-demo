package com.ssafy.b109.aivo.presentation.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record SlideEventCreateRequest(
        @NotNull
        Long toSlideId,

        @NotNull
        @PositiveOrZero
        Long occurredTimeMs
) {
}