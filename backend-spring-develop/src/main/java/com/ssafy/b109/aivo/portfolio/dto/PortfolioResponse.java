package com.ssafy.b109.aivo.portfolio.dto;

import com.ssafy.b109.aivo.portfolio.entity.Portfolio;

import java.time.LocalDateTime;

public record PortfolioResponse(
        Long id,
        String title,
        String portfolioPath,
        String summary,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    public static PortfolioResponse from(Portfolio portfolio) {
        return new PortfolioResponse(
                portfolio.getId(),
                portfolio.getTitle(),
                portfolio.getPortfolioPath(),
                portfolio.getSummary(),
                portfolio.getCreatedAt(),
                portfolio.getUpdatedAt()
        );
    }
}
