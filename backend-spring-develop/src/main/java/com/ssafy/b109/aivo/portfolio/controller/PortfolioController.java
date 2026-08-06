package com.ssafy.b109.aivo.portfolio.controller;

import com.ssafy.b109.aivo.portfolio.dto.PortfolioResponse;
import com.ssafy.b109.aivo.portfolio.dto.PortfolioUploadUrlRequest;
import com.ssafy.b109.aivo.portfolio.dto.PortfolioUploadUrlResponse;
import com.ssafy.b109.aivo.portfolio.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("${API_VERSION}/portfolios")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService portfolioService;

    @GetMapping
    public List<PortfolioResponse> getPortfolios(Authentication authentication) {
        return portfolioService.getPortfolios((Long) authentication.getPrincipal());
    }

    @GetMapping("/{portfolioId}")
    public PortfolioResponse getPortfolio(
            @PathVariable Long portfolioId,
            Authentication authentication
    ) {
        return portfolioService.getPortfolio(portfolioId, (Long) authentication.getPrincipal());
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PortfolioUploadUrlResponse upload(
            @ModelAttribute PortfolioUploadUrlRequest request,
            Authentication authentication
    ) {
        return portfolioService.upload(request, (Long) authentication.getPrincipal());
    }

    @DeleteMapping("/{portfolioId}")
    public ResponseEntity<Void> deletePortfolio(
            @PathVariable Long portfolioId,
            Authentication authentication
    ) {
        portfolioService.deletePortfolio(portfolioId, (Long) authentication.getPrincipal());
        return ResponseEntity.noContent().build();
    }
}
