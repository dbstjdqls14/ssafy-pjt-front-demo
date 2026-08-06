package com.ssafy.b109.aivo.presentation.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.b109.aivo.feedback.entity.TotalFeedback;
import com.ssafy.b109.aivo.feedback.repository.TotalFeedbackRepository;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.llm.service.PresentationFeedbackGenerator;
import com.ssafy.b109.aivo.media.entity.Audio;
import com.ssafy.b109.aivo.media.entity.AudioStt;
import com.ssafy.b109.aivo.media.repository.AudioRepository;
import com.ssafy.b109.aivo.media.repository.AudioSttRepository;
import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.practice.repository.PracticeRepository;
import com.ssafy.b109.aivo.presentation.dto.PresentationSlideAnalysisResult;
import com.ssafy.b109.aivo.presentation.dto.PresentationSlideFeedbackResult;
import com.ssafy.b109.aivo.presentation.dto.SlideContentAnalysis;
import com.ssafy.b109.aivo.presentation.entity.PresentationSlide;
import com.ssafy.b109.aivo.presentation.entity.PresentationSlideFeedback;
import com.ssafy.b109.aivo.presentation.repository.PresentationSlideFeedbackRepository;
import com.ssafy.b109.aivo.presentation.repository.PresentationSlideRepository;
import com.ssafy.b109.aivo.presentation.util.S3SlideImageStorage;
import com.ssafy.b109.aivo.rabbitmq.dto.AudioAnalysisCompletedMessage;
import com.ssafy.b109.aivo.rabbitmq.dto.AudioSttSegment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.content.Media;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.MimeTypeUtils;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresentationAnalysisService {

    private final ChatClient.Builder chatClientBuilder;
    private final PresentationSlideRepository presentationSlideRepository;
    private final S3SlideImageStorage s3SlideImageStorage;
    private final PracticeRepository practiceRepository;
    private final AudioRepository audioRepository;
    private final AudioSttRepository audioSttRepository;
    private final TotalFeedbackRepository totalFeedbackRepository;
    private final PresentationSlideFeedbackRepository presentationSlideFeedbackRepository;
    private final PresentationFeedbackGenerator presentationFeedbackGenerator;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PresentationSlideAnalysisResult analyze(Long presentationId) {
        List<PresentationSlide> slides = getSlides(presentationId);
        List<Media> mediaList = getSlideMediaForAnalysis(slides);

        int slideCount = slides.size();

        log.info(
                "슬라이드 AI 분석 요청: presentationId={}, slideCount={}",
                presentationId,
                slideCount
        );

        PresentationSlideAnalysisResult result =
                chatClientBuilder.build()
                        .prompt()
                        .user(user -> user
                                .text(createPrompt(
                                        slideCount
                                ))
                                .media(
                                        mediaList.toArray(
                                                Media[]::new
                                        )
                                ))
                        .call()
                        .entity(
                                PresentationSlideAnalysisResult.class
                        );

        validateResult(
                result,
                slideCount
        );

        for (SlideContentAnalysis s : result.slides()) {
            log.info("{}, {}", s.slideNumber(), s.coreContent());
        }

        return result;
    }

    @Transactional
    public void generateSlideFeedbacks(Long presentationId, Long userId){
        Practice practice = practiceRepository.findByPresentation_IdAndFolder_User_Id(
                        presentationId,
                        userId
                )
                .orElseThrow(() -> new CustomException(
                        ErrorCode.PRESENTATION_NOT_FOUND
                ));

        generateSlideFeedbacks(practice);
    }

    @Transactional
    public void generateSlideFeedbacksIfPresentationPractice(Long practiceId) {
        Practice practice = practiceRepository.findById(practiceId)
                .orElseThrow(() -> new CustomException(
                        ErrorCode.NOT_FOUND_PRACTICE
                ));

        if (practice.getPresentation() == null) {
            log.info(
                    "발표 practice가 아니므로 슬라이드 피드백 생성을 건너뜁니다: practiceId={}",
                    practiceId
            );
            return;
        }

        generateSlideFeedbacks(practice);
    }

    private void generateSlideFeedbacks(Practice practice) {
        Long presentationId = practice.getPresentation().getId();

        Audio audio = audioRepository.findByPracticeId(practice.getId())
                .orElseThrow(() -> new CustomException(
                        ErrorCode.INVALID_AUDIO_ANALYSIS_REQUEST
                ));

        AudioStt audioStt = audioSttRepository.findFirstByAudioIdOrderByIdDesc(audio.getId())
                .orElseThrow(() -> new CustomException(
                        ErrorCode.AUDIO_STT_FAILED
                ));

        List<AudioSttSegment> segments = parseSegments(audioStt.getContent());
        List<PresentationSlide> slides = getSlides(presentationId);
        TotalFeedback totalFeedback = totalFeedbackRepository.findByPracticeId(practice.getId())
                .orElseThrow(() -> new CustomException(
                        ErrorCode.REPORT_GENERATION_FAILED
                ));

        List<PresentationSlideFeedback> feedbacks = slides.stream()
                .map(slide -> createSlideFeedback(
                        totalFeedback.getId(),
                        slide,
                        sliceSpeechBySlide(segments, slide)
                ))
                .toList();

        presentationSlideFeedbackRepository.saveAll(feedbacks);
    }

    private PresentationSlideFeedback createSlideFeedback(
            Long totalFeedbackId,
            PresentationSlide slide,
            String userSpeech
    ) {
        PresentationSlideFeedbackResult result =
                presentationFeedbackGenerator.generate(
                        slide.getSlideNumber(),
                        slide.getDescription(),
                        userSpeech
                );

        PresentationSlideFeedback feedback =
                presentationSlideFeedbackRepository.findBySlideId(slide.getId())
                        .orElseGet(PresentationSlideFeedback::new);

        feedback.setTotalFeedbackId(totalFeedbackId);
        feedback.setSlideId(slide.getId());
        feedback.setScore(result.score());
        feedback.setContent(result.content());

        return feedback;
    }

    private List<AudioSttSegment> parseSegments(String content) {
        try {
            AudioAnalysisCompletedMessage message = objectMapper.readValue(
                    content,
                    AudioAnalysisCompletedMessage.class
            );

            if (message.segments() == null) {
                return List.of();
            }

            return message.segments();
        } catch (JsonProcessingException e) {
            return parseLegacySegments(content, e);
        }
    }

    private List<AudioSttSegment> parseLegacySegments(
            String content,
            JsonProcessingException cause
    ) {
        try {
            return objectMapper.readValue(
                    content,
                    new TypeReference<List<AudioSttSegment>>() {
                    }
            );
        } catch (JsonProcessingException e) {
            log.error("발표 음성 STT JSON 파싱 실패", cause);
            throw new CustomException(
                    ErrorCode.AUDIO_STT_FAILED
            );
        }
    }

    private String sliceSpeechBySlide(
            List<AudioSttSegment> segments,
            PresentationSlide slide
    ) {
        if (segments == null ||
                segments.isEmpty() ||
                slide.getStartTime() == null ||
                slide.getEndTime() == null ||
                slide.getEndTime() <= slide.getStartTime()) {
            return "";
        }

        float slideStart = slide.getStartTime();
        float slideEnd = slide.getEndTime();

        return segments.stream()
                .filter(segment -> segment.text() != null && !segment.text().isBlank())
                .filter(segment -> overlaps(
                        segment.timestampSt(),
                        segment.timestampEnd(),
                        slideStart,
                        slideEnd
                ))
                .map(AudioSttSegment::text)
                .map(String::trim)
                .collect(Collectors.joining(" "))
                .trim();
    }

    private boolean overlaps(
            Float segmentStart,
            Float segmentEnd,
            float slideStart,
            float slideEnd
    ) {
        if (segmentStart == null || segmentEnd == null) {
            return false;
        }

        return segmentEnd > slideStart && segmentStart < slideEnd;
    }

    private void validateResult(
            PresentationSlideAnalysisResult result,
            int expectedSlideCount
    ) {
        if (result == null ||
                result.slides() == null ||
                result.slides().isEmpty()) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_ANALYSIS_FAILED
            );
        }

        if (result.slides().size() !=
                expectedSlideCount) {
            log.error(
                    "AI 분석 슬라이드 개수 불일치: expected={}, actual={}",
                    expectedSlideCount,
                    result.slides().size()
            );

            throw new CustomException(
                    ErrorCode.PRESENTATION_ANALYSIS_FAILED
            );
        }

        Set<Integer> actualSlideNumbers =
                result.slides()
                        .stream()
                        .map(
                                SlideContentAnalysis::slideNumber
                        )
                        .collect(
                                Collectors.toSet()
                        );

        boolean hasAllSlideNumbers =
                IntStream.rangeClosed(
                                1,
                                expectedSlideCount
                        )
                        .allMatch(
                                actualSlideNumbers::contains
                        );

        boolean hasInvalidContent =
                result.slides()
                        .stream()
                        .anyMatch(slide ->
                                slide.slideNumber() == null ||
                                        slide.coreContent() == null ||
                                        slide.coreContent().isBlank()
                        );

        if (!hasAllSlideNumbers ||
                hasInvalidContent) {
            log.error(
                    "AI 분석 결과 형식 오류: expectedSlideCount={}, result={}",
                    expectedSlideCount,
                    result
            );

            throw new CustomException(
                    ErrorCode.PRESENTATION_ANALYSIS_FAILED
            );
        }
    }

    private List<PresentationSlide> getSlides(
            Long presentationId
    ) {
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

        return slides;
    }

    private List<Media> getSlideMediaForAnalysis(
            List<PresentationSlide> slides
    ) {
        return slides.stream()
                .map(slide -> {
                    URI imageUrl =
                            s3SlideImageStorage.createReadUrl(
                                    slide.getImageKey()
                            );

                    return new Media(
                            MimeTypeUtils.IMAGE_PNG,
                            imageUrl
                    );
                })
                .toList();
    }

    private String createPrompt(
            int slideCount
    ) {
        return """                                                                                                                                                    
                첨부된 이미지들은 하나의 발표 자료를                                                                                                                  
                슬라이드 순서대로 나열한 것입니다.                                                                                                                    
                                                                                                                                                                      
                총 슬라이드 수는 %d개입니다.                                                                                                                          
                                                                                                                                                                      
                각 슬라이드에서 발표자가 전달하려는 핵심 내용을                                                                                                       
                한두 문장으로 요약하세요.                                                                                                                             
                                                                                                                                                                      
                반드시 다음 규칙을 지키세요.                                                                                                                          
                                                                                                                                                                      
                1. 첫 번째 이미지는 1번 슬라이드입니다.                                                                                                               
                2. 이후 이미지는 전달된 순서대로                                                                                                                      
                   2번, 3번 슬라이드입니다.                                                                                                                           
                3. 모든 슬라이드의 결과를 반환하세요.                                                                                                                 
                4. slideNumber는 반드시 1부터 %d까지 사용하세요.                                                                                                      
                5. 이미지에 없는 내용을 임의로 추가하지 마세요.
                6. 화면에 있는 문장을 그대로 나열하지 말고                                                                                                            
                   핵심 의미를 요약하세요.                                                                                                                            
                7. 각 coreContent는 한두 문장으로 작성하세요.                                                                                                         
                """.formatted(
                slideCount,
                slideCount
        );
    }
}
