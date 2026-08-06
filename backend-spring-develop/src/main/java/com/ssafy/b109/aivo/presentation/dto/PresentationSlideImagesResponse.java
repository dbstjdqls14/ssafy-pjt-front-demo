package com.ssafy.b109.aivo.presentation.dto;

import java.util.List;

public record PresentationSlideImagesResponse(
        List<PresentationSlideImageResponse> slides
) {
}