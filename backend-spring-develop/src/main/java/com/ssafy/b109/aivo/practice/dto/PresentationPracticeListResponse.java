package com.ssafy.b109.aivo.practice.dto;

import java.util.List;

public record PresentationPracticeListResponse(
        List<PresentationPracticeListItemResponse> practices
) {
}
