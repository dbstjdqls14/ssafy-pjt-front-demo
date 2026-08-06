package com.ssafy.b109.aivo.portfolio.dto;

public record PortfolioUploadUrlResponse(
        Long portfolioId,
        String portfolioPath,
        String contentType
) {
}
