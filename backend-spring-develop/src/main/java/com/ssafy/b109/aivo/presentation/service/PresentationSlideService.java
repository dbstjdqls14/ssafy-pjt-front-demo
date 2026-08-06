package com.ssafy.b109.aivo.presentation.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.presentation.dto.*;
import com.ssafy.b109.aivo.practice.service.PracticeService;
import com.ssafy.b109.aivo.presentation.entity.Presentation;
import com.ssafy.b109.aivo.presentation.entity.PresentationSlide;
import com.ssafy.b109.aivo.presentation.repository.PresentationRepository;
import com.ssafy.b109.aivo.presentation.repository.PresentationSlideRepository;
import com.ssafy.b109.aivo.presentation.util.ExtractedSlideImage;
import com.ssafy.b109.aivo.presentation.util.S3SlideImageStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Slf4j
public class PresentationSlideService {

    private final PresentationRepository presentationRepository;
    private final PresentationSlideRepository presentationSlideRepository;
    private final PracticeService practiceService;
    private final S3SlideImageStorage s3SlideImageStorage;

    @Transactional
    public List<Long> replaceSlides(
            Long presentationId,
            List<ExtractedSlideImage> images,
            List<String> imageKeys
    ) {

        if (images == null ||
                images.isEmpty()) {
            throw new CustomException(
                    ErrorCode.EMPTY_PRESENTATION_SLIDES
            );
        }

        if (imageKeys == null ||
                images.size() != imageKeys.size()) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_IMAGE_KEY
            );
        }

        Presentation presentation =
                presentationRepository.findById(
                        presentationId
                ).orElseThrow(() ->
                        new CustomException(
                                ErrorCode.PRESENTATION_NOT_FOUND
                        )
                );

        presentationSlideRepository
                .deleteAllByPresentationId(
                        presentationId
                );

        presentationSlideRepository.flush();

        List<PresentationSlide> slides =
                IntStream.range(0, images.size())
                        .mapToObj(index ->
                                PresentationSlide.create(
                                        presentation,
                                        images.get(index)
                                                .slideNumber(),
                                        imageKeys.get(index)
                                )
                        )
                        .toList();

        return presentationSlideRepository
                .saveAll(slides)
                .stream()
                .map(PresentationSlide::getId)
                .toList();
    }

    public List<String> uploadSlideImages(
            Long presentationId,
            List<ExtractedSlideImage> images
    ) {
        String uploadVersion =
                UUID.randomUUID().toString();

        List<String> uploadedKeys =
                new ArrayList<>();

        try {
            for (ExtractedSlideImage image : images) {
                String imageKey =
                        s3SlideImageStorage.upload(
                                presentationId,
                                uploadVersion,
                                image.slideNumber(),
                                image.imageData()
                        );

                uploadedKeys.add(imageKey);
            }

            return uploadedKeys;
        } catch (Exception e) {
            // 이번 작업에서 올라간 이미지 정리
            for (String uploadedKey : uploadedKeys) {
                try {
                    s3SlideImageStorage.delete(
                            uploadedKey
                    );
                } catch (Exception deleteException) {
                    log.error(
                            "신규 슬라이드 이미지 정리 실패: key={}",
                            uploadedKey,
                            deleteException
                    );
                }
            }

            throw e;
        }
    }

    @Transactional
    public void saveAnalysisResult(Long presentationId, PresentationSlideAnalysisResult result) {
        List<PresentationSlide> slides = presentationSlideRepository
                .findAllByPresentationIdOrderBySlideNumber(
                        presentationId
                );

        if (slides.isEmpty()) {
            throw new CustomException(
                    ErrorCode.EMPTY_PRESENTATION_SLIDES
            );
        }

        Map<Integer, String> contentBySlideNumber = result.slides()
                .stream()
                .collect(
                        Collectors.toMap(
                                SlideContentAnalysis::slideNumber,
                                SlideContentAnalysis::coreContent,
                                (first, dup) -> {
                                    throw new CustomException(
                                            ErrorCode.PRESENTATION_ANALYSIS_FAILED
                                    );
                                }
                        )
                );

        for (PresentationSlide slide : slides) {
            String coreContent = contentBySlideNumber.get(
                    slide.getSlideNumber()
            );

            if (coreContent == null || coreContent.isBlank()) {
                throw new CustomException(
                        ErrorCode.PRESENTATION_ANALYSIS_FAILED
                );
            }

            slide.updateDescription(coreContent);
        }
    }

    public void deleteSlideImages(
            List<String> imageKeys
    ) {
        for (String imageKey : imageKeys) {
            try {
                s3SlideImageStorage.delete(
                        imageKey
                );
            } catch (Exception e) {
                log.error(
                        "슬라이드 이미지 정리 실패: key={}",
                        imageKey,
                        e
                );
            }
        }
    }

    public PresentationSlidesResponse getSlidesForUser(
            Long userId,
            Long presentationId
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        List<PresentationSlide> slides =
                presentationSlideRepository
                        .findAllByPresentationIdOrderBySlideNumber(
                                presentationId
                        );

        if (slides.isEmpty()) {
            throw new CustomException(
                    ErrorCode.EMPTY_PRESENTATION_SLIDES
            );
        }

        List<PresentationSlideResponse> responses =
                slides.stream()
                        .map(slide ->
                                new PresentationSlideResponse(
                                        slide.getId(),
                                        slide.getSlideNumber(),
                                        s3SlideImageStorage.createReadUrl(
                                                slide.getImageKey()
                                        ),
                                        slide.getDescription() == null
                                                ? ""
                                                : slide.getDescription()
                                )
                        )
                        .toList();

        return new PresentationSlidesResponse(
                responses
        );
    }

    @Transactional
    public void updateDescriptions(
            Long userId,
            Long presentationId,
            PresentationSlideDescriptionsUpdateRequest request
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        Presentation presentation =
                presentationRepository
                        .findByIdForUpdate(
                                presentationId
                        )
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.PRESENTATION_NOT_FOUND
                                )
                        );

        if (!presentation.isCompleted()) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_NOT_COMPLETED
            );
        }

        List<PresentationSlide> slides =
                presentationSlideRepository
                        .findAllByPresentationIdOrderBySlideNumber(
                                presentationId
                        );

        if (slides.isEmpty()) {
            throw new CustomException(
                    ErrorCode.EMPTY_PRESENTATION_SLIDES
            );
        }

        List<PresentationSlideDescriptionUpdate> updates =
                request.slides();

        // 모든 슬라이드를 보내야 함
        if (updates.size() != slides.size()) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_DESCRIPTION_UPDATE
            );
        }

        Map<Long, String> descriptionBySlideId =
                updates.stream()
                        .collect(
                                Collectors.toMap(
                                        PresentationSlideDescriptionUpdate::slideId,
                                        update ->
                                                update.description().trim(),
                                        (first, duplicate) -> {
                                            throw new CustomException(
                                                    ErrorCode.INVALID_PRESENTATION_SLIDE_DESCRIPTION_UPDATE
                                            );
                                        }
                                )
                        );

        for (PresentationSlide slide : slides) {
            String description =
                    descriptionBySlideId.get(
                            slide.getId()
                    );

            if (description == null) {
                throw new CustomException(
                        ErrorCode.INVALID_PRESENTATION_SLIDE_DESCRIPTION_UPDATE
                );
            }

            slide.updateDescription(
                    description
            );
        }
    }

    public URI getImageUrlForUser(
            Long userId,
            Long presentationId,
            Integer slideNumber
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        PresentationSlide slide =
                presentationSlideRepository
                        .findByPresentationIdAndSlideNumber(
                                presentationId,
                                slideNumber
                        )
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.PRESENTATION_SLIDE_NOT_FOUND
                                )
                        );

        return s3SlideImageStorage.createReadUrl(
                slide.getImageKey()
        );
    }

    public PresentationSlideImagesResponse getSlideImagesForUser(
            Long userId,
            Long presentationId
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        List<PresentationSlide> slides =
                presentationSlideRepository
                        .findAllByPresentationIdOrderBySlideNumber(
                                presentationId
                        );

        if (slides.isEmpty()) {
            throw new CustomException(
                    ErrorCode.EMPTY_PRESENTATION_SLIDES
            );
        }

        List<PresentationSlideImageResponse> responses =
                slides.stream()
                        .map(slide ->
                                new PresentationSlideImageResponse(
                                        slide.getSlideNumber(),
                                        s3SlideImageStorage.createReadUrl(
                                                slide.getImageKey()
                                        )
                                )
                        )
                        .toList();

        return new PresentationSlideImagesResponse(
                responses
        );
    }

    public List<String> getImageKeys(
            Long presentationId
    ) {
        return presentationSlideRepository
                .findAllByPresentationIdOrderBySlideNumber(
                        presentationId
                )
                .stream()
                .map(PresentationSlide::getImageKey)
                .toList();
    }
}
