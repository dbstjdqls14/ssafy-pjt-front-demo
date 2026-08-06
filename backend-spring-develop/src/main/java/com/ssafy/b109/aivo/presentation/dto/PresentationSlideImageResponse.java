package com.ssafy.b109.aivo.presentation.dto;

import java.net.URI;

public record PresentationSlideImageResponse(
        Integer slideNumber,
        URI imageUrl
) {
}
