package com.ssafy.b109.aivo.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PresentationCreateRequest(

        @NotNull
        Long folderId,

        @NotBlank
        @Size(max = 128)
        String title,

        @NotBlank
        @Size(max = 500)
        String description,

        @NotNull
        @Positive
        Long targetDurationSec,

        @NotNull
        Boolean aiQnaEnabled
) {
}
