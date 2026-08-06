package com.ssafy.b109.aivo.interview.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.b109.aivo.feedback.entity.TotalFeedback;
import com.ssafy.b109.aivo.feedback.repository.TotalFeedbackRepository;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.interview.dto.InterviewAnswerSubmitRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewContentEvaluationResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewMetricItemResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewReportResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewScoreMetricsResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewScoreSectionResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewVideoResponse;
import com.ssafy.b109.aivo.interview.dto.NonverbalSummaryResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionGestureBucketResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionGestureEventResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionGestureSeriesResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionEvaluationResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionVoicePaceRangeResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionVoicePaceResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionVoiceSilenceResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionVideoSegmentResponse;
import com.ssafy.b109.aivo.interview.entity.Company;
import com.ssafy.b109.aivo.interview.entity.CompanyBest;
import com.ssafy.b109.aivo.interview.entity.Interview;
import com.ssafy.b109.aivo.interview.entity.InterviewAnswer;
import com.ssafy.b109.aivo.interview.entity.InterviewFeedback;
import com.ssafy.b109.aivo.interview.entity.InterviewQuestion;
import com.ssafy.b109.aivo.interview.entity.InterviewScore;
import com.ssafy.b109.aivo.interview.entity.QuestionFeedback;
import com.ssafy.b109.aivo.interview.repository.CompanyBestRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewAnswerRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewFeedbackRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewQuestionRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewScoreRepository;
import com.ssafy.b109.aivo.interview.repository.QuestionFeedbackRepository;
import com.ssafy.b109.aivo.interview.util.InterviewReportEvaluator;
import com.ssafy.b109.aivo.interview.util.JsonMetadataUtil;
import com.ssafy.b109.aivo.llm.service.InterviewReportGenerator;
import com.ssafy.b109.aivo.media.entity.Video;
import com.ssafy.b109.aivo.media.repository.VideoRepository;
import com.ssafy.b109.aivo.nonverbal.entity.NonverbalAnalysisLog;
import com.ssafy.b109.aivo.nonverbal.repository.NonverbalAnalysisLogRepository;
import com.ssafy.b109.aivo.portfolio.util.S3PortfolioUploader;
import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.practice.repository.PracticeRepository;
import com.ssafy.b109.aivo.speech.entity.SpeechAnalysisLog;
import com.ssafy.b109.aivo.speech.repository.SpeechAnalysisLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterviewReportService {

    private static final double VOICE_SCORE_WEIGHT = 0.25;
    private static final double VIDEO_SCORE_WEIGHT = 0.15;
    private static final double CONTENT_SCORE_WEIGHT = 0.60;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final InterviewQuestionRepository interviewQuestionRepository;
    private final InterviewAnswerRepository interviewAnswerRepository;
    private final SpeechAnalysisLogRepository speechAnalysisLogRepository;
    private final NonverbalAnalysisLogRepository nonverbalAnalysisLogRepository;
    private final CompanyBestRepository companyBestRepository;
    private final InterviewFeedbackRepository interviewFeedbackRepository;
    private final InterviewScoreRepository interviewScoreRepository;
    private final TotalFeedbackRepository totalFeedbackRepository;
    private final QuestionFeedbackRepository questionFeedbackRepository;
    private final VideoRepository videoRepository;
    private final S3PortfolioUploader s3PortfolioUploader;
    private final PracticeRepository practiceRepository;
    private final InterviewReportEvaluator interviewReportEvaluator;
    private final InterviewReportGenerator interviewReportGenerator;

    @Transactional
    public InterviewReportResponse createReport(
            Interview interview,
            Practice practice,
            List<InterviewAnswerSubmitRequest> submittedAnswers
    ) {
        List<SpeechAnalysisLog> speechLogs = findSpeechLogs(interview.getId(), practice.getId());
        List<NonverbalAnalysisLog> nonverbalLogs = findNonverbalLogs(interview.getId(), practice.getId());
        List<InterviewQuestion> questions = interviewQuestionRepository.findAllByInterviewIdOrderByIdAsc(interview.getId());

        NonverbalSummaryResponse nonverbalSummary = interviewReportEvaluator.buildNonverbalSummary(speechLogs, nonverbalLogs);
        InterviewReportResponse report = interviewReportGenerator.generate(
                interview,
                practice.getId(),
                getCompanyName(interview),
                getOccupationName(interview),
                getJobName(interview),
                getCompanyBestContents(interview.getCompany()),
                nonverbalSummary,
                questions,
                submittedAnswers
        );
        report = enrichReport(interview, practice, report, nonverbalSummary, speechLogs, nonverbalLogs, questions, submittedAnswers);
        saveReport(interview.getId(), report);
        return report;
    }

    @Transactional(readOnly = true)
    public InterviewReportResponse getLatestReport(Long interviewId) {
        InterviewFeedback feedback = interviewFeedbackRepository.findFirstByInterviewIdOrderByCreatedAtDescIdDesc(interviewId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_INTERVIEW_REPORT));
        InterviewReportResponse report = readValue(feedback.getContent(), InterviewReportResponse.class);
        return practiceRepository.findByInterviewSession_Id(interviewId)
                .map(practice -> enrichStoredReport(practice, report))
                .orElse(report);
    }

    @Transactional(readOnly = true)
    public QuestionEvaluationResponse getLatestQuestionFeedback(Long interviewId, Long questionId) {
        QuestionFeedback feedback = questionFeedbackRepository.findFirstByInterviewIdAndQuestionIdOrderByCreatedAtDescIdDesc(interviewId, questionId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_QUESTION_FEEDBACK));
        return readValue(feedback.getContent(), QuestionEvaluationResponse.class);
    }

    private void saveReport(Long interviewId, InterviewReportResponse report) {
        LocalDateTime now = LocalDateTime.now();

        InterviewFeedback interviewFeedback = new InterviewFeedback();
        interviewFeedback.setInterviewId(interviewId);
        interviewFeedback.setContent(writeValue(report));
        interviewFeedback.setCreatedAt(now);
        interviewFeedbackRepository.save(interviewFeedback);
        saveScore(report.practiceId(), report, now);

        List<QuestionFeedback> questionFeedbacks = report.questionEvaluations().stream()
                .filter(questionEvaluation -> questionEvaluation.questionId() != null)
                .map(questionEvaluation -> createQuestionFeedback(interviewId, questionEvaluation, now))
                .toList();

        if (!questionFeedbacks.isEmpty()) {
            questionFeedbackRepository.saveAll(questionFeedbacks);
        }
    }

    private void saveScore(
            Long practiceId,
            InterviewReportResponse report,
            LocalDateTime createdAt
    ) {
        if (practiceId == null) {
            return;
        }

        TotalFeedback totalFeedback = getOrCreateTotalFeedback(practiceId);
        InterviewScoreMetricsResponse metrics = report.metrics();
        int overallScore = clamp(report.overallScore());
        int voiceScore = metrics == null ? 0 : clamp(metrics.voiceScore());
        int videoScore = metrics == null ? 0 : clamp(metrics.videoScore());
        int contentScore = metrics == null ? 0 : clamp(metrics.contentScore());

        InterviewScore score = new InterviewScore();
        score.setTotalFeedbackId(totalFeedback.getId());
        score.setOverallScore(toShort(overallScore));
        score.setVoiceScore(toShort(voiceScore));
        score.setVideoScore(toShort(videoScore));
        score.setContentScore(toShort(contentScore));
        score.setCreatedAt(createdAt);
        interviewScoreRepository.save(score);
    }

    private TotalFeedback getOrCreateTotalFeedback(Long practiceId) {
        return totalFeedbackRepository.findByPracticeId(practiceId)
                .orElseGet(() -> {
                    TotalFeedback totalFeedback = new TotalFeedback();
                    totalFeedback.setPracticeId(practiceId);
                    totalFeedback.setNonverbalFeedback("{}");
                    totalFeedback.setSpeechSpeed(0L);
                    return totalFeedbackRepository.save(totalFeedback);
                });
    }

    private QuestionFeedback createQuestionFeedback(
            Long interviewId,
            QuestionEvaluationResponse questionEvaluation,
            LocalDateTime createdAt
    ) {
        QuestionFeedback questionFeedback = new QuestionFeedback();
        questionFeedback.setInterviewId(interviewId);
        questionFeedback.setQuestionId(questionEvaluation.questionId());
        questionFeedback.setContent(writeValue(questionEvaluation));
        questionFeedback.setCreatedAt(createdAt);
        return questionFeedback;
    }

    private List<SpeechAnalysisLog> findSpeechLogs(Long interviewId, Long practiceId) {
        List<SpeechAnalysisLog> logs = speechAnalysisLogRepository.findAllByPracticeIdOrderByCreatedAtAsc(practiceId);
        if (Objects.equals(interviewId, practiceId) || hasAudioSpeechLogs(logs)) {
            return logs;
        }

        List<SpeechAnalysisLog> legacyLogs = speechAnalysisLogRepository.findAllByPracticeIdOrderByCreatedAtAsc(interviewId);
        return hasAudioSpeechLogs(legacyLogs) ? legacyLogs : logs;
    }

    private List<NonverbalAnalysisLog> findNonverbalLogs(Long interviewId, Long practiceId) {
        List<NonverbalAnalysisLog> logs = nonverbalAnalysisLogRepository.findAllByPracticeIdOrderByCreatedAtAsc(practiceId);
        if (Objects.equals(interviewId, practiceId) || hasAudioNonverbalLogs(logs)) {
            return logs;
        }

        List<NonverbalAnalysisLog> legacyLogs = nonverbalAnalysisLogRepository.findAllByPracticeIdOrderByCreatedAtAsc(interviewId);
        return hasAudioNonverbalLogs(legacyLogs) ? legacyLogs : logs;
    }

    private boolean hasAudioSpeechLogs(List<SpeechAnalysisLog> logs) {
        return logs != null && logs.stream().anyMatch(log -> containsAudioAnalysisMetadata(log.getMetadata()));
    }

    private boolean hasAudioNonverbalLogs(List<NonverbalAnalysisLog> logs) {
        return logs != null && logs.stream()
                .anyMatch(log -> containsAnyToken(log.getEventType(), "AUDIO")
                        && containsAudioAnalysisMetadata(log.getMetadata()));
    }

    private boolean containsAudioAnalysisMetadata(String metadata) {
        return metadata != null && metadata.contains("\"fillerCount\"");
    }

    private InterviewReportResponse enrichStoredReport(Practice practice, InterviewReportResponse report) {
        Interview interview = practice.getInterviewSession();
        List<SpeechAnalysisLog> speechLogs = findSpeechLogs(interview.getId(), practice.getId());
        List<NonverbalAnalysisLog> nonverbalLogs = findNonverbalLogs(interview.getId(), practice.getId());
        List<InterviewQuestion> questions = interviewQuestionRepository.findAllByInterviewIdOrderByIdAsc(interview.getId());
        List<InterviewAnswerSubmitRequest> savedAnswers = buildSubmittedAnswersFromSavedAnswers(questions);
        NonverbalSummaryResponse nonverbalSummary = interviewReportEvaluator.buildNonverbalSummary(speechLogs, nonverbalLogs);

        return enrichReport(interview, practice, report, nonverbalSummary, speechLogs, nonverbalLogs, questions, savedAnswers);
    }

    private InterviewReportResponse enrichReport(
            Interview interview,
            Practice practice,
            InterviewReportResponse report,
            NonverbalSummaryResponse nonverbalSummary,
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs,
            List<InterviewQuestion> questions,
            List<InterviewAnswerSubmitRequest> submittedAnswers
    ) {
        InterviewContentEvaluationResponse contentEvaluation = defaultContentEvaluation(report.contentEvaluation());
        InterviewVideoResponse video = buildVideo(practice.getId());
        List<QuestionEvaluationResponse> enrichedQuestions = buildQuestionEvaluations(
                report.questionEvaluations(),
                questions,
                speechLogs,
                nonverbalLogs,
                practice.getDurationSec(),
                submittedAnswers
        );
        InterviewScoreMetricsResponse metrics = buildScoreMetrics(
                report,
                contentEvaluation,
                nonverbalSummary,
                speechLogs,
                nonverbalLogs,
                practice.getDurationSec(),
                enrichedQuestions
        );
        int overallScore = calculateOverallScore(metrics);
        int totalDuration = reportDurationSeconds(practice.getDurationSec(), speechLogs, nonverbalLogs);
        QuestionVoicePaceResponse voicePace = buildQuestionVoicePace(speechLogs, 0, totalDuration);
        QuestionGestureSeriesResponse gestureSeries = buildQuestionGestureSeries(nonverbalLogs, 0, totalDuration, totalDuration);

        return new InterviewReportResponse(
                interview.getId(),
                practice.getId(),
                emptyIfNull(interview.getTitle()),
                practice.getDurationSec(),
                overallScore,
                metrics,
                buildScoreCards(metrics, contentEvaluation, nonverbalSummary, speechLogs, nonverbalLogs),
                voicePace,
                gestureSeries,
                nonverbalSummary,
                contentEvaluation,
                enrichedQuestions,
                enrichedQuestions,
                video,
                video == null ? null : video.url(),
                video == null ? null : video.url(),
                report.strengths() == null ? List.of() : report.strengths(),
                report.improvements() == null ? List.of() : report.improvements(),
                report.detailedFeedback() == null ? "" : report.detailedFeedback()
        );
    }

    private InterviewScoreMetricsResponse buildScoreMetrics(
            InterviewReportResponse report,
            InterviewContentEvaluationResponse contentEvaluation,
            NonverbalSummaryResponse nonverbalSummary,
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs,
            Long durationSec,
            List<QuestionEvaluationResponse> questionEvaluations
    ) {
        int voiceScore = scoreVoice(nonverbalSummary, speechLogs, durationSec);
        int videoScore = scoreVideo(nonverbalLogs, durationSec);
        int contentScore = scoreContent(questionEvaluations, contentEvaluation);

        return new InterviewScoreMetricsResponse(
                voiceScore,
                videoScore,
                contentScore == 0 ? clamp(report.overallScore()) : contentScore
        );
    }

    private List<InterviewScoreSectionResponse> buildScoreCards(
            InterviewScoreMetricsResponse metrics,
            InterviewContentEvaluationResponse contentEvaluation,
            NonverbalSummaryResponse nonverbalSummary,
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs
    ) {
        int gazeDeviationCount = videoMetric(nonverbalLogs, "VIDEO_GAZE_DEVIATION", "gazeDeviationCount", "GAZE", "EYE");
        int postureTiltPercent = videoMetric(nonverbalLogs, "VIDEO_POSTURE_TILT", "postureTiltPercent", "POSTURE", "MOVEMENT");
        int sampleCount = latestMetadataInt(nonverbalLogs, "sampleCount");
        int expressionAnomalyCount = videoMetric(nonverbalLogs, "VIDEO_EXPRESSION_ANOMALY", "expressionAnomalyCount", "FACE", "EXPRESSION");
        int voiceTrembleCount = speechMetric(speechLogs, "voiceTrembleCount", "TREM", "SHAKE");

        return List.of(
                new InterviewScoreSectionResponse(
                        "voice",
                        "음성",
                        metrics.voiceScore(),
                        List.of(
                                countMetric("filler", "추임새", nonverbalSummary.totalFillerCount(), "회"),
                                countMetric("stutter", "말 더듬음", nonverbalSummary.stutterCount(), "회"),
                                countMetric("speechRate", "말 속도", nonverbalSummary.averageWpm(), "WPM"),
                                countMetric("voiceTremble", "목소리 떨림", voiceTrembleCount, "회"),
                                countMetric("longSilence", "긴 공백", nonverbalSummary.silenceCount(), "회")
                        )
                ),
                new InterviewScoreSectionResponse(
                        "video",
                        "영상",
                        metrics.videoScore(),
                        List.of(
                                countMetric("gazeAway", "시선 이탈", gazeDeviationCount, "회"),
                                countMetric("expressionAnomaly", "표정 이상 감지", expressionAnomalyCount, "회"),
                                countMetric("postureTilt", "자세 기울기", postureTiltPercent, "%"),
                                countMetric("sampleCount", "분석 샘플", sampleCount, "개")
                        )
                ),
                new InterviewScoreSectionResponse(
                        "content",
                        "내용 일치",
                        metrics.contentScore(),
                        List.of(
                                percentMetric("questionUnderstanding", "질문 이해도", contentEvaluation.relevanceScore()),
                                percentMetric("answerRelevance", "답변 적절성", contentEvaluation.clarityScore()),
                                percentMetric("logicStructure", "논리 구성", contentEvaluation.structureScore())
                        )
                )
        );
    }

    private List<InterviewAnswerSubmitRequest> buildSubmittedAnswersFromSavedAnswers(List<InterviewQuestion> questions) {
        if (questions == null || questions.isEmpty()) {
            return List.of();
        }

        List<Long> questionIds = questions.stream()
                .map(InterviewQuestion::getId)
                .filter(Objects::nonNull)
                .toList();
        if (questionIds.isEmpty()) {
            return List.of();
        }

        Map<Long, InterviewAnswer> latestAnswerByQuestionId = interviewAnswerRepository.findAllByQuestionIdInOrderByIdAsc(questionIds).stream()
                .collect(Collectors.toMap(
                        InterviewAnswer::getQuestionId,
                        Function.identity(),
                        (previous, current) -> current
                ));

        return questions.stream()
                .map(question -> {
                    InterviewAnswer answer = latestAnswerByQuestionId.get(question.getId());
                    if (answer == null) {
                        return null;
                    }
                    return new InterviewAnswerSubmitRequest(
                            question.getId(),
                            question.getQuestion(),
                            answer.getAnswer(),
                            answer.getStartTimeMs(),
                            answer.getEndTimeMs()
                    );
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<QuestionEvaluationResponse> buildQuestionEvaluations(
            List<QuestionEvaluationResponse> evaluations,
            List<InterviewQuestion> questions,
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs,
            Long durationSec,
            List<InterviewAnswerSubmitRequest> submittedAnswers
    ) {
        List<QuestionEvaluationResponse> safeEvaluations = evaluations == null ? List.of() : evaluations;
        if (questions == null || questions.isEmpty()) {
            return safeEvaluations;
        }

        Map<Long, QuestionEvaluationResponse> evaluationByQuestionId = safeEvaluations.stream()
                .filter(evaluation -> evaluation.questionId() != null)
                .collect(Collectors.toMap(
                        QuestionEvaluationResponse::questionId,
                        Function.identity(),
                        (left, right) -> left
                ));
        Map<Long, InterviewAnswerSubmitRequest> submittedByQuestionId = submittedAnswers == null ? Map.of() : submittedAnswers.stream()
                .filter(answer -> answer.questionId() != null)
                .collect(Collectors.toMap(
                        InterviewAnswerSubmitRequest::questionId,
                        Function.identity(),
                        (left, right) -> left
                ));

        int totalDuration = durationSec == null || durationSec <= 0
                ? Math.max(questions.size(), 1) * 60
                : durationSec.intValue();

        List<QuestionEvaluationResponse> responses = new java.util.ArrayList<>();
        for (int index = 0; index < questions.size(); index++) {
            InterviewQuestion question = questions.get(index);
            int fallbackStart = Math.round((float) totalDuration * index / questions.size());
            int fallbackEnd = Math.round((float) totalDuration * (index + 1) / questions.size());
            QuestionEvaluationResponse base = evaluationByQuestionId.get(question.getId());
            InterviewAnswerSubmitRequest submitted = submittedByQuestionId.get(question.getId());
            int start = resolveQuestionStartSecond(base, submitted, fallbackStart);
            int end = resolveQuestionEndSecond(base, submitted, fallbackEnd);
            int displayDuration = resolveDisplayDuration(questions, evaluationByQuestionId, submittedByQuestionId, index, start, end, totalDuration);
            responses.add(buildQuestionEvaluation(question, base, submitted, speechLogs, nonverbalLogs, start, end, displayDuration, totalDuration));
        }
        return responses;
    }

    private int resolveDisplayDuration(
            List<InterviewQuestion> questions,
            Map<Long, QuestionEvaluationResponse> evaluationByQuestionId,
            Map<Long, InterviewAnswerSubmitRequest> submittedByQuestionId,
            int index,
            int start,
            int end,
            int totalDuration
    ) {
        if (index + 1 < questions.size()) {
            InterviewQuestion nextQuestion = questions.get(index + 1);
            QuestionEvaluationResponse nextBase = evaluationByQuestionId.get(nextQuestion.getId());
            InterviewAnswerSubmitRequest nextSubmitted = submittedByQuestionId.get(nextQuestion.getId());
            int nextFallbackStart = Math.round((float) totalDuration * (index + 1) / questions.size());
            int nextStart = resolveQuestionStartSecond(nextBase, nextSubmitted, nextFallbackStart);
            return Math.max(0, nextStart - start);
        }
        return Math.max(0, end - start);
    }

    private int resolveQuestionStartSecond(
            QuestionEvaluationResponse base,
            InterviewAnswerSubmitRequest submitted,
            int fallback
    ) {
        if (submitted != null && submitted.startTimeMs() != null) {
            return Math.toIntExact(Math.max(0L, submitted.startTimeMs()) / 1000L);
        }
        if (base != null && base.startTimeSeconds() != null) {
            return Math.max(0, base.startTimeSeconds());
        }
        return fallback;
    }

    private int resolveQuestionEndSecond(
            QuestionEvaluationResponse base,
            InterviewAnswerSubmitRequest submitted,
            int fallback
    ) {
        if (submitted != null && submitted.endTimeMs() != null) {
            return Math.toIntExact(Math.max(0L, Math.round(Math.ceil(submitted.endTimeMs() / 1000.0))));
        }
        if (base != null && base.endTimeSeconds() != null) {
            return Math.max(0, base.endTimeSeconds());
        }
        return fallback;
    }

    private QuestionEvaluationResponse buildQuestionEvaluation(
            InterviewQuestion question,
            QuestionEvaluationResponse base,
            InterviewAnswerSubmitRequest submitted,
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs,
            int start,
            int end,
            int duration,
            int totalDuration
    ) {
        String submittedAnswer = submitted == null || submitted.answer() == null ? "" : submitted.answer();
        String answer = submittedAnswer.isBlank()
                ? base == null || base.answer() == null ? "" : base.answer()
                : submittedAnswer;
        String feedback = base == null || base.feedback() == null ? "" : base.feedback();
        String improvement = base == null || base.improvement() == null ? "" : base.improvement();
        String problem = base == null || base.problem() == null ? firstSentence(answer) : base.problem();

        return new QuestionEvaluationResponse(
                question.getId(),
                question.getQuestion(),
                answer,
                clamp(base == null ? 0 : base.score()),
                feedback,
                improvement,
                problem,
                base == null || base.issueLabel() == null ? "답변 개선" : base.issueLabel(),
                start,
                end,
                duration,
                buildQuestionSegments(speechLogs, start, end),
                buildQuestionVoicePace(speechLogs, start, start + Math.max(1, duration)),
                buildQuestionGestureSeries(nonverbalLogs, start, start + Math.max(1, duration), totalDuration)
        );
    }

    private QuestionVoicePaceResponse buildQuestionVoicePace(List<SpeechAnalysisLog> speechLogs, int start, int end) {
        List<SpeechAnalysisLog> logs = logsInRange(speechLogs, start, end);
        if (logs.isEmpty()) {
            return null;
        }

        int duration = Math.max(1, end - start);
        int fillerTotal = logs.stream()
                .mapToInt(log -> JsonMetadataUtil.extractInt(log.getMetadata(), "fillerCount"))
                .sum();
        int longSilenceCount = (int) logs.stream()
                .filter(log -> JsonMetadataUtil.extractBoolean(log.getMetadata(), "silenceDetected"))
                .count();
        double avgPace = roundPace(logs.stream()
                .mapToInt(this::averageWpmFromLog)
                .filter(value -> value > 0)
                .average()
                .orElse(0.0) / 30.0);

        if (avgPace <= 0) {
            avgPace = 3.6;
        }

        SpeechAnalysisLog slowestLog = logs.stream()
                .filter(log -> averageWpmFromLog(log) > 0)
                .min(Comparator.comparingInt(this::averageWpmFromLog))
                .orElse(logs.get(0));
        SpeechAnalysisLog fastestLog = logs.stream()
                .filter(log -> averageWpmFromLog(log) > 0)
                .max(Comparator.comparingInt(this::averageWpmFromLog))
                .orElse(logs.get(logs.size() - 1));

        double benchmarkMin = roundPace(Math.max(1.0, avgPace - 0.7));
        double benchmarkMax = roundPace(avgPace + 0.6);

        return new QuestionVoicePaceResponse(
                avgPace,
                benchmarkMin,
                benchmarkMax,
                paceRange(slowestLog, start, duration),
                paceRange(fastestLog, start, duration),
                fillerTotal,
                fillerBreakdown(fillerTotal),
                longSilenceCount,
                silenceRanges(logs, start, duration),
                List.of()
        );
    }

    private QuestionGestureSeriesResponse buildQuestionGestureSeries(
            List<NonverbalAnalysisLog> nonverbalLogs,
            int start,
            int end,
            int totalDuration
    ) {
        if (nonverbalLogs == null || nonverbalLogs.isEmpty()) {
            return null;
        }

        int duration = Math.max(1, end - start);
        double ratio = Math.min(1.0, Math.max(0.0, duration / (double) Math.max(1, totalDuration)));
        int totalGazeCount = countVideoEvents(nonverbalLogs, "GAZE", "EYE");
        int tiltPct = Math.max(0, Math.min(100, countVideoEvents(nonverbalLogs, "POSTURE", "MOVEMENT")));
        int gazeCount = totalGazeCount <= 0 ? 0 : Math.max(1, (int) Math.round(totalGazeCount * ratio));

        List<QuestionGestureBucketResponse> buckets = new java.util.ArrayList<>();
        for (int bucketStart = 0; bucketStart < duration; bucketStart += 10) {
            buckets.add(new QuestionGestureBucketResponse(
                    bucketStart,
                    Math.min(duration, bucketStart + 10),
                    tiltPct
            ));
        }

        List<QuestionGestureEventResponse> gazeEvents = new java.util.ArrayList<>();
        if (gazeCount > 0) {
            double step = duration / (double) (gazeCount + 1);
            for (int index = 0; index < gazeCount; index++) {
                gazeEvents.add(new QuestionGestureEventResponse((int) Math.round(step * (index + 1))));
            }
        }

        return new QuestionGestureSeriesResponse(buckets, gazeCount, gazeEvents);
    }

    private List<SpeechAnalysisLog> logsInRange(List<SpeechAnalysisLog> speechLogs, int start, int end) {
        if (speechLogs == null || speechLogs.isEmpty()) {
            return List.of();
        }
        return speechLogs.stream()
                .filter(log -> log.getStartTimeMs() != null)
                .filter(log -> {
                    int absoluteSecond = Math.toIntExact(log.getStartTimeMs() / 1000L);
                    return absoluteSecond >= start && absoluteSecond < end;
                })
                .toList();
    }

    private QuestionVoicePaceRangeResponse paceRange(SpeechAnalysisLog log, int questionStart, int duration) {
        int start = Math.min(duration, Math.max(0, Math.toIntExact(log.getStartTimeMs() / 1000L) - questionStart));
        int end = Math.min(duration, Math.max(start + 1, Math.toIntExact((log.getEndTimeMs() == null ? log.getStartTimeMs() + 10_000L : log.getEndTimeMs()) / 1000L) - questionStart));
        return new QuestionVoicePaceRangeResponse(start, end, roundPace(averageWpmFromLog(log) / 30.0));
    }

    private List<List<Object>> fillerBreakdown(int fillerTotal) {
        if (fillerTotal <= 0) {
            return List.of();
        }
        int eo = Math.max(0, Math.round(fillerTotal * 0.7f));
        int geu = Math.max(0, Math.round(fillerTotal * 0.2f));
        int eum = Math.max(0, fillerTotal - eo - geu);
        List<List<Object>> breakdown = new java.util.ArrayList<>();
        if (eo > 0) {
            breakdown.add(List.of("어", eo));
        }
        if (geu > 0) {
            breakdown.add(List.of("그", geu));
        }
        if (eum > 0) {
            breakdown.add(List.of("음", eum));
        }
        return breakdown;
    }

    private List<QuestionVoiceSilenceResponse> silenceRanges(List<SpeechAnalysisLog> logs, int questionStart, int duration) {
        return logs.stream()
                .filter(log -> JsonMetadataUtil.extractBoolean(log.getMetadata(), "silenceDetected"))
                .map(log -> {
                    int relativeStart = Math.min(duration, Math.max(0, Math.toIntExact(log.getStartTimeMs() / 1000L) - questionStart));
                    int silenceSeconds = Math.max(1, Math.toIntExact(Math.round(Math.ceil(JsonMetadataUtil.extractInt(log.getMetadata(), "silenceDurationMs") / 1000.0))));
                    return new QuestionVoiceSilenceResponse(relativeStart, Math.min(duration, relativeStart + silenceSeconds));
                })
                .toList();
    }

    private int averageWpmFromLog(SpeechAnalysisLog log) {
        int metadataValue = JsonMetadataUtil.extractInt(log.getMetadata(), "averageWpm");
        if (metadataValue > 0) {
            return metadataValue;
        }
        return log.getMetricValue() == null ? 0 : Math.round(log.getMetricValue());
    }

    private double roundPace(double value) {
        return Math.round(Math.max(0.1, value) * 10.0) / 10.0;
    }

    private List<QuestionVideoSegmentResponse> buildQuestionSegments(List<SpeechAnalysisLog> speechLogs, int start, int end) {
        if (speechLogs == null || speechLogs.isEmpty()) {
            return List.of();
        }

        return speechLogs.stream()
                .filter(log -> log.getStartTimeMs() != null)
                .filter(log -> {
                    int absoluteSecond = Math.toIntExact(log.getStartTimeMs() / 1000);
                    return absoluteSecond >= start && absoluteSecond < end;
                })
                .flatMap(log -> buildSegmentsFromLog(log, start).stream())
                .toList();
    }

    private List<QuestionVideoSegmentResponse> buildSegmentsFromLog(SpeechAnalysisLog log, int questionStart) {
        int absoluteStart = Math.toIntExact(log.getStartTimeMs() / 1000);
        int absoluteEnd = log.getEndTimeMs() == null
                ? absoluteStart + 10
                : Math.toIntExact(log.getEndTimeMs() / 1000);
        int relativeStart = Math.max(0, absoluteStart - questionStart);
        int relativeEnd = Math.max(relativeStart, absoluteEnd - questionStart);
        String metadata = log.getMetadata();

        List<QuestionVideoSegmentResponse> segments = new java.util.ArrayList<>();
        int fillerCount = JsonMetadataUtil.extractInt(metadata, "fillerCount");
        if (fillerCount > 0) {
            segments.add(segment("filler", "추임새", relativeStart, relativeEnd, absoluteStart, "추임새가 %d회 감지되었습니다.".formatted(fillerCount)));
        }
        if (JsonMetadataUtil.extractBoolean(metadata, "stutterDetected")) {
            segments.add(segment("stutter", "말 더듬음", relativeStart, relativeEnd, absoluteStart, "말 더듬음 또는 반복 표현이 감지되었습니다."));
        }
        if (JsonMetadataUtil.extractBoolean(metadata, "silenceDetected")) {
            int silenceDurationMs = JsonMetadataUtil.extractInt(metadata, "silenceDurationMs");
            segments.add(segment("silence", "긴 공백", relativeStart, relativeEnd, absoluteStart, "약 %dms의 공백이 감지되었습니다.".formatted(silenceDurationMs)));
        }
        return segments;
    }

    private QuestionVideoSegmentResponse segment(
            String kind,
            String label,
            int relativeStart,
            int relativeEnd,
            int absoluteStart,
            String feedback
    ) {
        return new QuestionVideoSegmentResponse(
                kind,
                label,
                toClock(relativeStart),
                relativeStart,
                relativeEnd,
                absoluteStart,
                feedback
        );
    }

    private InterviewVideoResponse buildVideo(Long practiceId) {
        return videoRepository.findByPracticeId(practiceId)
                .map(this::toVideoResponse)
                .orElse(null);
    }

    private InterviewVideoResponse toVideoResponse(Video video) {
        return new InterviewVideoResponse(
                video.getId(),
                video.getPath(),
                s3PortfolioUploader.createReadUrl(video.getPath(), video.getType())
        );
    }

    private InterviewMetricItemResponse countMetric(String key, String label, Integer count, String unit) {
        int safeCount = count == null ? 0 : count;
        return new InterviewMetricItemResponse(key, label, safeCount + unit, safeCount, unit);
    }

    private InterviewMetricItemResponse percentMetric(String key, String label, Integer score) {
        int safeScore = clamp(score);
        return new InterviewMetricItemResponse(key, label, safeScore + "%", safeScore, "%");
    }

    private int videoMetric(
            List<NonverbalAnalysisLog> logs,
            String exactEventType,
            String metadataKey,
            String... fallbackTokens
    ) {
        if (logs == null || logs.isEmpty()) {
            return 0;
        }

        return logs.stream()
                .filter(log -> exactEventType.equals(log.getEventType()))
                .max(Comparator.comparing(NonverbalAnalysisLog::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(log -> {
                    int metadataValue = JsonMetadataUtil.extractInt(log.getMetadata(), metadataKey);
                    if (metadataValue > 0) {
                        return metadataValue;
                    }
                    return log.getMetricValue() == null ? 0 : Math.round(log.getMetricValue());
                })
                .filter(value -> value > 0)
                .orElseGet(() -> countVideoEvents(logs, fallbackTokens));
    }

    private int latestMetadataInt(List<NonverbalAnalysisLog> logs, String metadataKey) {
        if (logs == null || logs.isEmpty()) {
            return 0;
        }

        return logs.stream()
                .max(Comparator.comparing(NonverbalAnalysisLog::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(log -> JsonMetadataUtil.extractInt(log.getMetadata(), metadataKey))
                .orElse(0);
    }

    private int speechMetric(List<SpeechAnalysisLog> logs, String metadataKey, String... fallbackTokens) {
        if (logs == null || logs.isEmpty()) {
            return 0;
        }

        int metadataSum = logs.stream()
                .mapToInt(log -> JsonMetadataUtil.extractInt(log.getMetadata(), metadataKey))
                .sum();
        if (metadataSum > 0) {
            return metadataSum;
        }

        return (int) logs.stream()
                .filter(log -> containsAnyToken(log.getEventType(), fallbackTokens))
                .count();
    }

    private int countVideoEvents(List<NonverbalAnalysisLog> logs, String... tokens) {
        if (logs == null || logs.isEmpty()) {
            return 0;
        }

        List<NonverbalAnalysisLog> matchedLogs = logs.stream()
                .filter(log -> containsAnyToken(log.getEventType(), tokens))
                .toList();
        int metricSum = (int) Math.round(matchedLogs.stream()
                .map(NonverbalAnalysisLog::getMetricValue)
                .filter(Objects::nonNull)
                .mapToDouble(Float::doubleValue)
                .sum());
        if (metricSum > 0) {
            return metricSum;
        }

        return (int) matchedLogs.stream()
                .count();
    }

    private int scoreVoice(
            NonverbalSummaryResponse summary,
            List<SpeechAnalysisLog> speechLogs,
            Long durationSec
    ) {
        if (summary == null || summary.analyzedChunks() == null || summary.analyzedChunks() == 0) {
            return 0;
        }

        double minutes = durationMinutes(durationSec, speechLogs);
        double fillerPenalty = Math.min(20, safeInt(summary.totalFillerCount()));
        double silencePenalty = Math.min(30, 5 * safeInt(summary.silenceCount()) / minutes);
        double speedPenalty = calculateSpeedPenalty(summary, speechLogs);

        return clamp((int) Math.round(100 - fillerPenalty - silencePenalty - speedPenalty));
    }

    private int scoreVideo(List<NonverbalAnalysisLog> nonverbalLogs, Long durationSec) {
        if (nonverbalLogs == null || nonverbalLogs.isEmpty()) {
            return 0;
        }

        double minutes = durationMinutes(durationSec, nonverbalLogs);
        double gazeDeviationPerMinute = countVideoEvents(nonverbalLogs, "GAZE", "EYE") / minutes;
        double postureTiltPercent = countVideoEvents(nonverbalLogs, "POSTURE", "MOVEMENT");
        double movementRateProxy = postureTiltPercent / 10.0;
        double gazePenalty = Math.min(50, 10 * gazeDeviationPerMinute);
        double movementPenalty = Math.min(50, 10 * movementRateProxy);

        return clamp((int) Math.round(100 - gazePenalty - movementPenalty));
    }

    private int scoreContent(
            List<QuestionEvaluationResponse> questionEvaluations,
            InterviewContentEvaluationResponse contentEvaluation
    ) {
        if (questionEvaluations != null && !questionEvaluations.isEmpty()) {
            return clamp((int) Math.round(questionEvaluations.stream()
                    .map(QuestionEvaluationResponse::score)
                    .filter(Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .average()
                    .orElse(0)));
        }

        return averageScores(
                contentEvaluation.relevanceScore(),
                contentEvaluation.structureScore(),
                contentEvaluation.clarityScore()
        );
    }

    private int calculateOverallScore(InterviewScoreMetricsResponse metrics) {
        return clamp((int) Math.round(
                safeInt(metrics.voiceScore()) * VOICE_SCORE_WEIGHT
                        + safeInt(metrics.videoScore()) * VIDEO_SCORE_WEIGHT
                        + safeInt(metrics.contentScore()) * CONTENT_SCORE_WEIGHT
        ));
    }

    private double calculateSpeedPenalty(
            NonverbalSummaryResponse summary,
            List<SpeechAnalysisLog> speechLogs
    ) {
        double averageWpm = safeInt(summary.averageWpm());
        if (averageWpm <= 0 || speechLogs == null || speechLogs.isEmpty()) {
            return 0;
        }

        List<Double> wpmValues = speechLogs.stream()
                .map(SpeechAnalysisLog::getMetricValue)
                .filter(Objects::nonNull)
                .map(Float::doubleValue)
                .filter(value -> value > 0)
                .toList();
        if (wpmValues.size() < 2) {
            return 0;
        }

        double highWpm = wpmValues.stream().mapToDouble(Double::doubleValue).max().orElse(averageWpm);
        double lowWpm = wpmValues.stream().mapToDouble(Double::doubleValue).min().orElse(averageWpm);
        return Math.min(50, 50 * (highWpm - lowWpm) / averageWpm);
    }

    private double durationMinutes(Long durationSec, List<?> logs) {
        if (durationSec != null && durationSec > 0) {
            return Math.max(1.0, durationSec / 60.0);
        }
        if (logs == null || logs.isEmpty()) {
            return 1.0;
        }
        return Math.max(1.0, logs.size() / 6.0);
    }

    private int reportDurationSeconds(
            Long durationSec,
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs
    ) {
        if (durationSec != null && durationSec > 0) {
            return Math.toIntExact(durationSec);
        }

        long speechEndMs = speechLogs == null ? 0L : speechLogs.stream()
                .map(SpeechAnalysisLog::getEndTimeMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .max()
                .orElse(0L);
        long nonverbalEndMs = nonverbalLogs == null ? 0L : nonverbalLogs.stream()
                .map(NonverbalAnalysisLog::getEndTimeMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .max()
                .orElse(0L);

        long maxEndMs = Math.max(speechEndMs, nonverbalEndMs);
        if (maxEndMs <= 0) {
            return 1;
        }
        return Math.max(1, (int) Math.ceil(maxEndMs / 1000.0));
    }

    private boolean containsAnyToken(String eventType, String... tokens) {
        if (eventType == null) {
            return false;
        }
        String normalizedEventType = eventType.toUpperCase();
        return List.of(tokens).stream().anyMatch(normalizedEventType::contains);
    }

    private InterviewContentEvaluationResponse defaultContentEvaluation(InterviewContentEvaluationResponse source) {
        if (source == null) {
            return new InterviewContentEvaluationResponse(0, 0, 0, 0, "");
        }
        return source;
    }

    private int averageScores(Integer... scores) {
        List<Integer> validScores = Arrays.stream(scores)
                .filter(Objects::nonNull)
                .toList();
        if (validScores.isEmpty()) {
            return 0;
        }
        return clamp((int) Math.round(validScores.stream().mapToInt(Integer::intValue).average().orElse(0)));
    }

    private int clamp(Integer score) {
        if (score == null) {
            return 0;
        }
        return Math.max(0, Math.min(100, score));
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private short toShort(Integer value) {
        return (short) clamp(value);
    }

    private String toClock(int seconds) {
        return "%d:%02d".formatted(seconds / 60, seconds % 60);
    }

    private String firstSentence(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        int end = value.indexOf('.');
        if (end < 0) {
            return value.length() > 60 ? value.substring(0, 60) : value;
        }
        return value.substring(0, end + 1);
    }

    private String emptyIfNull(String value) {
        return value == null ? "" : value;
    }

    private String writeValue(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new CustomException(ErrorCode.REPORT_GENERATION_FAILED);
        }
    }

    private <T> T readValue(String value, Class<T> type) {
        try {
            return objectMapper.readValue(value, type);
        } catch (JsonProcessingException exception) {
            throw new CustomException(ErrorCode.REPORT_GENERATION_FAILED);
        }
    }

    private String getCompanyName(Interview interview) {
        return interview.getCompany() == null ? null : interview.getCompany().getName();
    }

    private String getOccupationName(Interview interview) {
        return interview.getOccupation() == null ? null : interview.getOccupation().getName();
    }

    private String getJobName(Interview interview) {
        return interview.getJob() == null ? null : interview.getJob().getName();
    }

    private List<String> getCompanyBestContents(Company company) {
        if (company == null) {
            return List.of();
        }

        return companyBestRepository.findAllByCompanyIds(List.of(company.getId())).stream()
                .map(CompanyBest::getContent)
                .toList();
    }
}
