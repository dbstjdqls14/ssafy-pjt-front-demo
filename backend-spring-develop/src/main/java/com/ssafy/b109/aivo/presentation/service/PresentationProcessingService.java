package com.ssafy.b109.aivo.presentation.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.presentation.dto.PresentationSlideAnalysisResult;
import com.ssafy.b109.aivo.presentation.entity.Presentation;
import com.ssafy.b109.aivo.presentation.repository.PresentationRepository;
import com.ssafy.b109.aivo.presentation.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresentationProcessingService {

    private final PresentationRepository presentationRepository;
    private final S3PresentationReader s3PresentationReader;
    private final S3PresentationDeleter s3PresentationDeleter;
    private final SlideImageExtractorResolver extractorResolver;
    private final PresentationSlideService presentationSlideService;
    private final PresentationAnalysisService presentationAnalysisService;

    public void process(Long presentationId) {

        Presentation presentation = presentationRepository.findById(presentationId)
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.PRESENTATION_NOT_FOUND
                        )
                );

        try {
            convertAndSaveSlides(presentation);
        } catch (Exception e) {
            log.error(
                    "발표 자료 슬라이드 변환 실패: presentationId={}",
                    presentationId,
                    e
            );

            presentation.fail();
            presentationRepository.save(presentation);

            throw new CustomException(
                    ErrorCode.PRESENTATION_SLIDE_CONVERSION_FAILED
            );
        }

        try {
            analyzeAndSaveResult(presentation);
        } catch (Exception e) {
            log.error(
                    "슬라이드 분석 실패: presentationId={}",
                    presentationId,
                    e
            );

            presentation.fail();
            presentationRepository.save(presentation);

            throw new CustomException(
                    ErrorCode.PRESENTATION_ANALYSIS_FAILED
            );
        }


    }

    private void convertAndSaveSlides(Presentation presentation) throws Exception {
        Long presentationId = presentation.getId();
        String fileKey = presentation.getTemporaryFileKey();

        if (fileKey == null || fileKey.isBlank()) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_FILE_NOT_FOUND
            );
        }

        log.info(
                "슬라이드 변환 시작: presentationId={}, thread={}",
                presentationId,
                Thread.currentThread().getName()
        );

        presentation.startProcessing();
        presentationRepository.save(presentation);

        String extension = extractExtension(fileKey);

        SlideImageExtractor extractor = extractorResolver.resolve(extension);

        List<ExtractedSlideImage> images;

        try (InputStream inputStream = s3PresentationReader.open(fileKey)) {
            images = extractor.extract(inputStream);
        }

        List<String> oldImageKeys =
                presentationSlideService
                        .getImageKeys(
                                presentationId
                        );

        List<String> imageKeys = presentationSlideService.uploadSlideImages(
                presentationId,
                images
        );

        try {
            // S3 업로드가 모두 성공한 후 DB 교체
            presentationSlideService.replaceSlides(
                    presentationId,
                    images,
                    imageKeys
            );
        } catch (Exception e) {
            // DB 저장 실패 시 새로 업로드한 S3 이미지 정리
            presentationSlideService.deleteSlideImages(
                    imageKeys
            );

            throw e;
        }

        presentationSlideService.deleteSlideImages(
                oldImageKeys
        );

        log.info(
                "슬라이드 변환 및 저장 성공: presentationId={}, count={}, thread={}",
                presentationId,
                images.size(),
                Thread.currentThread().getName()
        );
    }

    private void analyzeAndSaveResult(Presentation presentation) {
        Long presentationId = presentation.getId();

        log.info(
                "슬라이드 분석 시작: presentationId={}, thread={}",
                presentationId,
                Thread.currentThread().getName()
        );

        presentation.startAnalyzing();
        presentationRepository.save(presentation);

        PresentationSlideAnalysisResult analysisResult =
                presentationAnalysisService.analyze(presentationId);

        presentationSlideService.saveAnalysisResult(presentationId, analysisResult);

        presentation.complete();
        presentationRepository.save(presentation);

        cleanupTemporaryFile(presentation);

        log.info(
                "슬라이드 분석 완료: presentationId={}, count={}, thread={}",
                presentationId,
                analysisResult.slides().size(),
                Thread.currentThread().getName()
        );
    }

    private void cleanupTemporaryFile(Presentation presentation) {
        String fileKey = presentation.getTemporaryFileKey();

        try {
            s3PresentationDeleter.delete(fileKey);

            presentation.clearTemporaryFileKey();
            presentationRepository.save(presentation);

            log.info(
                    "발표 임시 파일 삭제 완료: presentationId={}, key={}",
                    presentation.getId(),
                    fileKey
            );
        } catch (Exception e) {
            log.error(
                    "발표 임시 파일 삭제 실패: presentationId={}, key={}",
                    presentation.getId(),
                    fileKey,
                    e
            );
        }
    }

    private String extractExtension(String fileKey) {
        int dotIndex = fileKey.lastIndexOf('.');

        if (dotIndex < 0 ||
                dotIndex == fileKey.length() - 1) {
            throw new CustomException(
                    ErrorCode.MISSING_PRESENTATION_FILE_EXTENSION
            );
        }

        return fileKey
                .substring(dotIndex + 1)
                .toLowerCase(Locale.ROOT);
    }
}
