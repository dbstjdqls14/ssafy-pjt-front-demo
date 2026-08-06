package com.ssafy.b109.aivo.presentation.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.global.rabbitmq.config.RabbitMQConfig;
import com.ssafy.b109.aivo.media.entity.Audio;
import com.ssafy.b109.aivo.media.entity.MediaDomain;
import com.ssafy.b109.aivo.media.service.MediaService;
import com.ssafy.b109.aivo.feedback.entity.TotalFeedback;
import com.ssafy.b109.aivo.feedback.repository.TotalFeedbackRepository;
import com.ssafy.b109.aivo.llm.service.PresentationQuestionFeedbackGenerator;
import com.ssafy.b109.aivo.llm.service.PresentationQuestionGenerator;
import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.practice.repository.PracticeFolderRepository;
import com.ssafy.b109.aivo.practice.entity.PracticeFolder;
import com.ssafy.b109.aivo.practice.repository.PracticeRepository;
import com.ssafy.b109.aivo.practice.service.PracticeService;
import com.ssafy.b109.aivo.presentation.dto.*;
import com.ssafy.b109.aivo.presentation.entity.*;
import com.ssafy.b109.aivo.presentation.event.PresentationUploadEvent;
import com.ssafy.b109.aivo.presentation.repository.PresentationRepository;
import com.ssafy.b109.aivo.presentation.repository.PresentationQuestionFeedbackRepository;
import com.ssafy.b109.aivo.presentation.repository.PresentationQuestionRepository;
import com.ssafy.b109.aivo.presentation.repository.PresentationSlideRepository;
import com.ssafy.b109.aivo.presentation.util.PresentationFileValidator;
import com.ssafy.b109.aivo.presentation.util.S3PresentationDeleter;
import com.ssafy.b109.aivo.presentation.util.S3PresentationUploader;
import com.ssafy.b109.aivo.rabbitmq.dto.AudioSTTRequest;
import com.ssafy.b109.aivo.rabbitmq.entity.AnalysisEventType;
import com.ssafy.b109.aivo.rabbitmq.entity.EventType;
import com.ssafy.b109.aivo.rabbitmq.publisher.AnalysisMessagePublisher;
import com.ssafy.b109.aivo.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresentationService {


    private final PracticeRepository practiceRepository;
    private final PresentationQuestionGenerator presentationQuestionGenerator;
    private final PresentationQuestionFeedbackGenerator presentationQuestionFeedbackGenerator;
    private final PresentationSlideRepository presentationSlideRepository;
    private final PresentationQuestionRepository presentationQuestionRepository;
    private final PresentationQuestionFeedbackRepository presentationQuestionFeedbackRepository;
    private final TotalFeedbackRepository totalFeedbackRepository;
    private final MediaService mediaService;
    private final AnalysisMessagePublisher analysisMessagePublisher;
    private final PracticeService practiceService;
    private final PresentationFileValidator presentationFileValidator;
    private final S3PresentationUploader s3PresentationUploader;
    private final S3PresentationDeleter s3PresentationDeleter;
    private final ApplicationEventPublisher eventPublisher;
    private final PracticeFolderRepository practiceFolderRepository;
    private final PresentationRepository presentationRepository;

    @Transactional
    public List<AudienceQuestionResponse> generateAudienceQuestion(Long presentationId, Long userId, List<AudienceQuestionRequest> requests) {

        validatePresentationOwner(presentationId, userId);

        Map<Integer, String> userSttByPage = requests.stream()
                .filter(request -> request.page() != null)
                .filter(request -> request.content() != null && !request.content().isBlank())
                .collect(Collectors.groupingBy(
                        AudienceQuestionRequest::page,
                        TreeMap::new,
                        Collectors.mapping(
                                AudienceQuestionRequest::content,
                                Collectors.joining("\n")
                        )
                ));

        List<PresentationSlide> slides = presentationSlideRepository.findByPresentationId(presentationId);

        List<AudienceQuestionLLMDto> generateRequest = slides.stream()
                .filter(slide -> userSttByPage.containsKey(slide.getSlideNumber()))
                .sorted(Comparator.comparing(PresentationSlide::getSlideNumber))
                .map(slide -> new AudienceQuestionLLMDto(
                        slide.getDescription(),
                        userSttByPage.get(slide.getSlideNumber())
                ))
                .toList();

        List<String> audienceQuestions = presentationQuestionGenerator.generate(generateRequest);

        List<PresentationQuestion> presentationQuestions = audienceQuestions.stream()
                .map(questionAndAnswer -> createPresentationQuestion(presentationId, questionAndAnswer))
                .toList();

        List<PresentationQuestion> savedQuestions = presentationQuestionRepository.saveAll(presentationQuestions);

        return savedQuestions.stream()
                .map(question -> new AudienceQuestionResponse(question.getId(), question.getQuestion()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AudienceQuestionResponse> getAudienceQuestions(Long presentationId, Long userId) {
        validatePresentationOwner(presentationId, userId);

        return presentationQuestionRepository.findByPresentationIdOrderByIdAsc(presentationId).stream()
                .map(question -> new AudienceQuestionResponse(question.getId(), question.getQuestion()))
                .toList();
    }

    @Transactional
    public void saveAudienceQuestionAnswers(Long questionId, Long userId, AudienceQuestionAnswerRequest request) {
        PresentationQuestion question = presentationQuestionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("TODO : 커스텀 에러 처리(question을 찾을 수 없습니다.)"));

        Long presentationId = question.getPresentationId();
        Practice practice = validatePresentationOwner(presentationId, userId);

        String userAnswer = request.answer() == null ? "" : request.answer();
        question.setUserAnswer(userAnswer);

        PresentationQuestionFeedbackResult feedbackResult = presentationQuestionFeedbackGenerator.generate(
                question.getQuestion(),
                question.getModelAnswer(),
                userAnswer
        );

        TotalFeedback totalFeedback = getTotalFeedback(practice.getId());

        PresentationQuestionFeedback feedback = presentationQuestionFeedbackRepository.findByQuestionId(questionId)
                .orElseGet(PresentationQuestionFeedback::new);

        feedback.setTotalFeedbackId(totalFeedback.getId());
        feedback.setQuestionId(questionId);
        feedback.setScore(feedbackResult.score());
        feedback.setContent(feedbackResult.content());

        presentationQuestionFeedbackRepository.save(feedback);
    }

    @Transactional(readOnly = true)
    public PresentationQuestionFeedbackResponse getAudienceQuestionFeedback(Long questionId, Long userId) {
        PresentationQuestion question = presentationQuestionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("TODO : 커스텀 에러 처리(question을 찾을 수 없습니다.)"));

        validatePresentationOwner(question.getPresentationId(), userId);

        PresentationQuestionFeedback feedback = presentationQuestionFeedbackRepository.findByQuestionId(questionId)
                .orElseThrow(() -> new RuntimeException("TODO : 커스텀 에러 처리(question feedback을 찾을 수 없습니다.)"));

        return toFeedbackResponse(feedback);
    }

    @Transactional(readOnly = true)
    public List<PresentationQuestionFeedbackResponse> getAudienceQuestionFeedbacks(Long presentationId, Long userId) {
        validatePresentationOwner(presentationId, userId);

        List<Long> questionIds = presentationQuestionRepository.findByPresentationIdOrderByIdAsc(presentationId).stream()
                .map(PresentationQuestion::getId)
                .toList();

        if(questionIds.isEmpty()){
            return List.of();
        }

        return presentationQuestionFeedbackRepository.findByQuestionIdInOrderByQuestionIdAsc(questionIds).stream()
                .map(this::toFeedbackResponse)
                .toList();
    }

    private Practice validatePresentationOwner(Long presentationId, Long userId) {
        Practice practice = practiceRepository.findByPresentationId(presentationId)
                .orElseThrow(()-> new RuntimeException("TODO : 커스텀 에러 처리(practice를 찾을 수 없습니다.)"));

        PracticeFolder practiceFolder = practice.getFolder();

        User user = practiceFolder.getUser();

        if(!userId.equals(user.getId())){
            throw new RuntimeException("TODO : 커스텀 에러 처리 (사용자를 찾을 수 없습니다.)");
        }

        return practice;
    }

    private PresentationQuestion createPresentationQuestion(Long presentationId, String questionAndAnswer) {
        String[] values = questionAndAnswer.split("\\|\\|\\|", 2);

        PresentationQuestion presentationQuestion = new PresentationQuestion();
        presentationQuestion.setPresentationId(presentationId);
        presentationQuestion.setQuestion(values[0].trim());
        presentationQuestion.setModelAnswer(values.length > 1 ? values[1].trim() : "");
        return presentationQuestion;
    }

    private TotalFeedback getTotalFeedback(Long practiceId) {
        return totalFeedbackRepository.findByPracticeId(practiceId)
                .orElseThrow(() -> new RuntimeException("TODO : 커스텀 에러 처리(total feedback을 찾을 수 없습니다.)"));
    }

    private PresentationQuestionFeedbackResponse toFeedbackResponse(PresentationQuestionFeedback feedback) {
        return new PresentationQuestionFeedbackResponse(
                feedback.getId(),
                feedback.getQuestionId(),
                feedback.getScore(),
                feedback.getContent()
        );
    }

    @Transactional
    public PresentationFileUploadResponse createWithFile(Long userId, PresentationCreateRequest request, MultipartFile file) {
        presentationFileValidator.validate(file);

        PracticeFolder folder = practiceFolderRepository.findByIdAndUserId(request.folderId(), userId)
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.NOT_FOUND_PRACTICE_FOLDER
                        )
                );

        Presentation presentation = presentationRepository.save(
                Presentation.create(request.targetDurationSec(), request.aiQnaEnabled())
        );

        Practice practice = practiceService.createForPresentation(
                folder,
                presentation,
                request.title(),
                request.description()
        );

        // 업로드
        String objectKey = s3PresentationUploader.uploadPresentation(presentation.getId(), file);
        presentation.updateTemporaryFileKey(objectKey);

        eventPublisher.publishEvent(
                new PresentationUploadEvent(
                        presentation.getId()
                )
        );

        return new PresentationFileUploadResponse(
                presentation.getId(),
                practice.getId(),
                presentation.getProcessingStatus()
        );
    }

    @Transactional
    public PresentationFileUploadResponse createFromExisting(Long userId, PresentationReuseRequest request) {
        Practice sourcePractice = practiceRepository.findByPresentation_IdAndFolder_IdAndFolder_User_Id(
                request.sourcePresentationId(),
                request.folderId(),
                userId
        ).orElseThrow(
                () -> new CustomException(ErrorCode.PRESENTATION_NOT_FOUND)
        );

        Presentation sourcePresentation = sourcePractice.getPresentation();

        if(!sourcePresentation.isCompleted()) {
            throw new CustomException(ErrorCode.PRESENTATION_NOT_COMPLETED);
        }

        Presentation newPresentation = presentationRepository.save(
                Presentation.create(
                        request.targetDurationSec(),
                        request.aiQnaEnabled()
                )
        );

        Practice newPractice = practiceService.createForPresentation(
                sourcePractice.getFolder(),
                newPresentation,
                request.title(),
                request.description()
        );

        List<PresentationSlide> sourceSlides = presentationSlideRepository
                .findAllByPresentationIdOrderBySlideNumber(
                        sourcePresentation.getId()
                );

        if(sourceSlides.isEmpty()) {
            throw new CustomException(
                    ErrorCode.EMPTY_PRESENTATION_SLIDES
            );
        }

        List<PresentationSlide> copiedSlides = sourceSlides.stream()
                .map(sourceSlide -> PresentationSlide.copyOf(newPresentation, sourceSlide))
                .toList();

        presentationSlideRepository.saveAll(copiedSlides);

        newPresentation.complete();;

        return new PresentationFileUploadResponse(
                newPresentation.getId(),
                newPractice.getId(),
                newPresentation.getProcessingStatus()
        );
    }

    @Transactional
    public void reupload(
            Long userId,
            Long presentationId,
            MultipartFile file
    ) {
        presentationFileValidator.validate(file);
        practiceService.validatePresentationOwner(userId, presentationId);

        Presentation presentation = presentationRepository.findByIdForUpdate(presentationId)
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.PRESENTATION_NOT_FOUND
                        )
                );

        if (presentation.isProcessingInProgress()) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_ALREADY_PROCESSING
            );
        }

        String previousObjectKey = presentation.getTemporaryFileKey();
        String objectKey = s3PresentationUploader.uploadPresentation(presentation.getId(), file);

        deletePreviousFile(
                presentationId,
                previousObjectKey,
                objectKey
        );

        presentation.updateTemporaryFileKey(objectKey);
        presentation.startProcessing();

        eventPublisher.publishEvent(
                new PresentationUploadEvent(
                        presentation.getId()
                )
        );
    }

    private void deletePreviousFile(
            Long presentationId,
            String previousKey,
            String newKey
    ) {
        if(previousKey == null || previousKey.isBlank() || previousKey.equals(newKey)) return;

        try {
            s3PresentationDeleter.delete(
                    previousKey
            );
        } catch (Exception exception) {
            log.error(

                    "이전 발표 파일 삭제 실패 : presentationId={}, key={}",
                    presentationId,
                    previousKey,
                    exception
            );
        }
    }

    public PresentationStatusResponse getStatus(Long userId, Long presentationId) {
        practiceService.validatePresentationOwner(userId, presentationId);

        Presentation presentation = presentationRepository.findById(presentationId)
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.PRESENTATION_NOT_FOUND
                        )
                );

        return new PresentationStatusResponse(
                presentation.getId(),
                presentation.getProcessingStatus()
        );
    }
    
    @Transactional
    public void upload(Long presentationId, MultipartFile audio, MultipartFile video, Long userId) {
        Practice practice = validatePresentationOwner(presentationId, userId);

        if(hasMediaFile(audio)){
            Audio savedAudio = mediaService.uploadAudio(
                    userId,
                    practice,
                    MediaDomain.PRESENTATION,
                    presentationId,
                    audio
            );

            publishAudioAnalysisRequest(practice.getId(), savedAudio);
        }

        if(hasMediaFile(video)){
            mediaService.uploadVideo(
                    userId,
                    practice,
                    MediaDomain.PRESENTATION,
                    presentationId,
                    video
            );
        }
    }

    private boolean hasMediaFile(MultipartFile file) {
        return file != null && !file.isEmpty();
    }

    private void publishAudioAnalysisRequest(Long practiceId, Audio audio) {
        UUID requestId = UUID.randomUUID();

        AudioSTTRequest request = new AudioSTTRequest(
                AnalysisEventType.AUDIO_ANALYSIS_REQUEST,
                requestId,
                practiceId,
                audio.getId(),
                Instant.now(),
                audio.getPath()
        );

        analysisMessagePublisher.publish(
                RabbitMQConfig.AUDIO_ROUTING_KEY,
                EventType.AUDIO_ANALYSIS_REQUEST,
                requestId,
                request
        );
    }

}
