package com.ssafy.b109.aivo.presentation.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.practice.repository.PracticeRepository;
import com.ssafy.b109.aivo.practice.service.PracticeService;
import com.ssafy.b109.aivo.presentation.dto.PresentationPracticeCompleteRequest;
import com.ssafy.b109.aivo.presentation.dto.PresentationPracticeStartResponse;
import com.ssafy.b109.aivo.presentation.dto.SlideEventCreateRequest;
import com.ssafy.b109.aivo.presentation.entity.Presentation;
import com.ssafy.b109.aivo.presentation.entity.PresentationSlide;
import com.ssafy.b109.aivo.presentation.repository.PresentationSlideRepository;
import com.ssafy.b109.aivo.slide.entity.SlideActionType;
import com.ssafy.b109.aivo.slide.entity.SlideClickLog;
import com.ssafy.b109.aivo.slide.repository.SlideClickLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PresentationPracticeService {

    private final PracticeService practiceService;
    private final PracticeRepository practiceRepository;
    private final PresentationSlideRepository
            presentationSlideRepository;
    private final SlideClickLogRepository
            slideClickLogRepository;

    @Transactional
    public PresentationPracticeStartResponse start(
            Long userId,
            Long presentationId
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        Practice practice =
                findPractice(presentationId);

        Presentation presentation =
                practice.getPresentation();

        if (!presentation.isCompleted()) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_NOT_COMPLETED
            );
        }

        if (slideClickLogRepository.existsByPracticeId(
                practice.getId()
        )) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_PRACTICE_ALREADY_STARTED
            );
        }

        PresentationSlide firstSlide =
                presentationSlideRepository
                        .findByPresentationIdAndSlideNumber(
                                presentationId,
                                1
                        )
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.PRESENTATION_SLIDE_NOT_FOUND
                                )
                        );

        SlideClickLog startLog =
                SlideClickLog.createStart(
                        practice,
                        firstSlide.getId()
                );

        slideClickLogRepository.save(
                startLog
        );

        return new PresentationPracticeStartResponse(
                practice.getId(),
                firstSlide.getId(),
                firstSlide.getSlideNumber()
        );
    }

    @Transactional
    public void createSlideEvent(
            Long userId,
            Long presentationId,
            SlideEventCreateRequest request
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        Practice practice = findPractice(presentationId);

        SlideClickLog lastLog =
                slideClickLogRepository
                        .findTopByPracticeIdOrderByIdDesc(
                                practice.getId()
                        )
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.PRESENTATION_PRACTICE_NOT_STARTED
                                )
                        );

        if (SlideActionType.END.name()
                .equals(lastLog.getActionType())) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_PRACTICE_ALREADY_COMPLETED
            );
        }

        if (request.occurredTimeMs() <=
                lastLog.getOccurredTimeMs()) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_EVENT
            );
        }

        PresentationSlide toSlide =
                presentationSlideRepository
                        .findByIdAndPresentationId(
                                request.toSlideId(),
                                presentationId
                        )
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.PRESENTATION_SLIDE_NOT_FOUND
                                )
                        );

        Long currentSlideId =
                lastLog.getToSlideId();

        if (currentSlideId.equals(
                toSlide.getId()
        )) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_EVENT
            );
        }

        SlideClickLog moveLog =
                SlideClickLog.createMove(
                        lastLog.getId() + 1,
                        practice,
                        currentSlideId,
                        toSlide.getId(),
                        request.occurredTimeMs()
                );

        slideClickLogRepository.save(
                moveLog
        );
    }

    private Practice findPractice(
            Long presentationId
    ) {
        return practiceRepository
                .findByPresentationId(
                        presentationId
                )
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.PRESENTATION_NOT_FOUND
                        )
                );
    }

    @Transactional
    public void complete(
            Long userId,
            Long presentationId,
            PresentationPracticeCompleteRequest request
    ) {
        practiceService.validatePresentationOwner(
                userId,
                presentationId
        );

        Practice practice =
                findPractice(presentationId);

        SlideClickLog lastLog =
                slideClickLogRepository
                        .findTopByPracticeIdOrderByIdDesc(
                                practice.getId()
                        )
                        .orElseThrow(() ->
                                new CustomException(
                                        ErrorCode.PRESENTATION_PRACTICE_NOT_STARTED
                                )
                        );

        if (SlideActionType.END.name()
                .equals(lastLog.getActionType())) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_PRACTICE_ALREADY_COMPLETED
            );
        }

        if (request.durationMs() <=
                lastLog.getOccurredTimeMs()) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_EVENT
            );
        }

        SlideClickLog endLog =
                SlideClickLog.createEnd(
                        lastLog.getId() + 1,
                        practice,
                        lastLog.getToSlideId(),
                        request.durationMs()
                );

        slideClickLogRepository.save(
                endLog
        );

        updateSlideTimelines(
                practice.getId(),
                presentationId
        );

        practice.setDurationSec(
                request.durationMs() / 1000L
        );
        practice.setUpdatedAt(
                LocalDateTime.now()
        );
    }

    private void updateSlideTimelines(
            Long practiceId,
            Long presentationId
    ) {
        List<SlideClickLog> logs =
                slideClickLogRepository
                        .findAllByPracticeIdOrderByOccurredTimeMsAsc(
                                practiceId
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

        Map<Long, PresentationSlide> slideById =
                slides.stream()
                        .collect(Collectors.toMap(
                                PresentationSlide::getId,
                                slide -> slide
                        ));

        slides.forEach(PresentationSlide::clearTimeline);

        for (SlideClickLog log : logs) {
            float occurredTimeSec =
                    log.getOccurredTimeMs() / 1000.0f;

            SlideActionType actionType =
                    SlideActionType.valueOf(
                            log.getActionType()
                    );

            switch (actionType) {
                case START -> {
                    PresentationSlide slide =
                            getSlide(
                                    slideById,
                                    log.getToSlideId()
                            );

                    slide.updateStartTime(occurredTimeSec);
                }

                case MOVE -> {
                    PresentationSlide fromSlide =
                            getSlide(
                                    slideById,
                                    log.getFromSlideId()
                            );

                    PresentationSlide toSlide =
                            getSlide(
                                    slideById,
                                    log.getToSlideId()
                            );

                    fromSlide.updateEndTime(occurredTimeSec);
                    toSlide.updateStartTime(occurredTimeSec);
                }

                case END -> {
                    PresentationSlide slide =
                            getSlide(
                                    slideById,
                                    log.getFromSlideId()
                            );

                    slide.updateEndTime(occurredTimeSec);
                }
            }
        }
    }

    private PresentationSlide getSlide(
            Map<Long, PresentationSlide> slideById,
            Long slideId
    ) {
        PresentationSlide slide =
                slideById.get(slideId);

        if (slide == null) {
            throw new CustomException(
                    ErrorCode.INVALID_PRESENTATION_SLIDE_EVENT
            );
        }

        return slide;
    }

}