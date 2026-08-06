package com.ssafy.b109.aivo.portfolio.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.llm.service.PortfolioSummaryGenerator;
import com.ssafy.b109.aivo.portfolio.dto.PortfolioResponse;
import com.ssafy.b109.aivo.portfolio.dto.PortfolioUploadUrlRequest;
import com.ssafy.b109.aivo.portfolio.dto.PortfolioUploadUrlResponse;
import com.ssafy.b109.aivo.portfolio.entity.Portfolio;
import com.ssafy.b109.aivo.portfolio.repository.PortfolioRepository;
import com.ssafy.b109.aivo.portfolio.util.PdfTextExtractor;
import com.ssafy.b109.aivo.portfolio.util.S3PortfolioUploader;
import com.ssafy.b109.aivo.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private static final String PDF_EXTENSION = ".pdf";
    private static final int MAX_TITLE_LENGTH = 50;

    private final PortfolioRepository portfolioRepository;
    private final S3PortfolioUploader s3PortfolioUploader;
    private final PdfTextExtractor pdfTextExtractor;
    private final PortfolioSummaryGenerator portfolioSummaryGenerator;

    @Transactional(readOnly = true)
    public List<PortfolioResponse> getPortfolios(Long userId) {
        return portfolioRepository.findAllByUserIdAndDeletedAtIsNullOrderByIdDesc(userId).stream()
                .map(PortfolioResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PortfolioResponse getPortfolio(Long portfolioId, Long userId) {
        return PortfolioResponse.from(getActivePortfolio(portfolioId, userId));
    }

    @Transactional
    public PortfolioUploadUrlResponse upload(PortfolioUploadUrlRequest request, Long userId) {
        validateRequest(request);

        String objectKey = "portfolios/" + userId + "/" + UUID.randomUUID() + PDF_EXTENSION;
        String portfolioPath = s3PortfolioUploader.toPortfolioPath(objectKey);
        String summary = portfolioSummaryGenerator.summarize(pdfTextExtractor.extract(request.getFile()));
        Portfolio portfolio = savePortfolio(request.getTitle(), portfolioPath, summary, userId);
        s3PortfolioUploader.uploadPdf(objectKey, request.getFile());

        return new PortfolioUploadUrlResponse(
                portfolio.getId(),
                portfolio.getPortfolioPath(),
                S3PortfolioUploader.PDF_CONTENT_TYPE
        );
    }

    @Transactional
    public void deletePortfolio(Long portfolioId, Long userId) {
        Portfolio portfolio = getActivePortfolio(portfolioId, userId);
        LocalDateTime now = LocalDateTime.now();
        portfolio.setDeletedAt(now);
        portfolio.setUpdatedAt(now);
    }

    private void validateRequest(PortfolioUploadUrlRequest request) {
        MultipartFile file = request == null ? null : request.getFile();
        if (request == null
                || !StringUtils.hasText(request.getTitle())
                || request.getTitle().length() > MAX_TITLE_LENGTH
                || file == null
                || file.isEmpty()
                || !StringUtils.hasText(file.getOriginalFilename())
                || !file.getOriginalFilename().toLowerCase().endsWith(PDF_EXTENSION)
                || !S3PortfolioUploader.PDF_CONTENT_TYPE.equals(file.getContentType())) {
            throw new CustomException(ErrorCode.INVALID_PORTFOLIO_UPLOAD_REQUEST);
        }
    }

    private Portfolio savePortfolio(String title, String portfolioPath, String summary, Long userId) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setId(userId);

        Portfolio portfolio = new Portfolio();
        portfolio.setUser(user);
        portfolio.setTitle(title);
        portfolio.setPortfolioPath(portfolioPath);
        portfolio.setSummary(summary);
        portfolio.setCreatedAt(now);
        portfolio.setUpdatedAt(now);

        return portfolioRepository.saveAndFlush(portfolio);
    }

    private Portfolio getActivePortfolio(Long portfolioId, Long userId) {
        return portfolioRepository.findByIdAndUserIdAndDeletedAtIsNull(portfolioId, userId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_PORTFOLIO));
    }
}
