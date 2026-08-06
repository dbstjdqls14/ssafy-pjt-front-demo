package com.ssafy.b109.aivo.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PresentationSlideDescriptionUpdate(
        @NotNull
        Long slideId,

        @NotBlank
        @Size(max = 500)
        String description
) {
}