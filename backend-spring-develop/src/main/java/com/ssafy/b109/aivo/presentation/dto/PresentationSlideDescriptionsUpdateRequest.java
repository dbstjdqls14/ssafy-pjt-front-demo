package com.ssafy.b109.aivo.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record PresentationSlideDescriptionsUpdateRequest(
        @NotEmpty
        List<@Valid PresentationSlideDescriptionUpdate> slides
) {
}