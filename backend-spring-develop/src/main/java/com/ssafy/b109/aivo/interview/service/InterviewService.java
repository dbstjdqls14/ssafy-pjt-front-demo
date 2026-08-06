package com.ssafy.b109.aivo.interview.service;

import com.ssafy.b109.aivo.feedback.entity.TotalFeedback;
import com.ssafy.b109.aivo.feedback.repository.TotalFeedbackRepository;
import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.interview.dto.AudioSttSegmentResponse;
import com.ssafy.b109.aivo.interview.dto.CompanyBestResponse;
import com.ssafy.b109.aivo.interview.dto.CompanyResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewAnswerSubmitRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewCompleteRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewQuestionCreateRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewQuestionItemResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewReportResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewStartRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewStartResponse;
import com.ssafy.b109.aivo.interview.dto.FullAudioTranscriptionResult;
import com.ssafy.b109.aivo.interview.dto.InterviewerQuestionResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewerResponse;
import com.ssafy.b109.aivo.interview.dto.JobDetailResponse;
import com.ssafy.b109.aivo.interview.dto.JobResponse;
import com.ssafy.b109.aivo.interview.dto.OccupationResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionEvaluationResponse;
import com.ssafy.b109.aivo.interview.entity.Company;
import com.ssafy.b109.aivo.interview.entity.CompanyBest;
import com.ssafy.b109.aivo.interview.entity.Interview;
import com.ssafy.b109.aivo.interview.entity.InterviewAnswer;
import com.ssafy.b109.aivo.interview.entity.InterviewQuestion;
import com.ssafy.b109.aivo.interview.entity.Interviewer;
import com.ssafy.b109.aivo.interview.entity.Job;
import com.ssafy.b109.aivo.interview.entity.Occupation;
import com.ssafy.b109.aivo.interview.repository.CompanyBestRepository;
import com.ssafy.b109.aivo.interview.repository.CompanyRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewAnswerRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewQuestionRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewerQuestionRepository;
import com.ssafy.b109.aivo.interview.repository.InterviewerRepository;
import com.ssafy.b109.aivo.interview.repository.JobRepository;
import com.ssafy.b109.aivo.interview.repository.OccupationRepository;
import com.ssafy.b109.aivo.llm.service.InterviewQuestionGenerator;
import com.ssafy.b109.aivo.portfolio.entity.Portfolio;
import com.ssafy.b109.aivo.portfolio.repository.PortfolioRepository;
import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.practice.entity.PracticeFolder;
import com.ssafy.b109.aivo.practice.repository.PracticeFolderRepository;
import com.ssafy.b109.aivo.practice.repository.PracticeRepository;
import com.ssafy.b109.aivo.resume.entity.Resume;
import com.ssafy.b109.aivo.resume.repository.ResumeRepository;
import com.ssafy.b109.aivo.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterviewService {

    private static final String DEFAULT_INTERVIEW_FOLDER_NAME = "AI 모의 면접";
    private static final String DEFAULT_INTERVIEW_PRACTICE_DESCRIPTION = "AI interview practice";
    private static final int MAX_RESUME_CONTEXT_LENGTH = 12_000;

    private final InterviewRepository interviewRepository;
    private final JobRepository jobRepository;
    private final OccupationRepository occupationRepository;
    private final CompanyRepository companyRepository;
    private final CompanyBestRepository companyBestRepository;
    private final InterviewerRepository interviewerRepository;
    private final InterviewerQuestionRepository interviewerQuestionRepository;
    private final InterviewQuestionRepository interviewQuestionRepository;
    private final InterviewAnswerRepository interviewAnswerRepository;
    private final InterviewQuestionGenerator interviewQuestionGenerator;
    private final InterviewAudioService interviewAudioService;
    private final InterviewReportService interviewReportService;
    private final PracticeFolderRepository practiceFolderRepository;
    private final PracticeRepository practiceRepository;
    private final PortfolioRepository portfolioRepository;
    private final ResumeRepository resumeRepository;
    private final TotalFeedbackRepository totalFeedbackRepository;

    @Transactional
    public InterviewStartResponse startInterview(InterviewStartRequest request, Long userId) {
        validateStartRequest(request);

        Company company = findCompany(request.companyId());
        Occupation occupation = findOccupation(request.occupationId());
        Job job = findJob(request.jobId());
        Interviewer interviewer = findInterviewer(request.interviewerId());
        PracticeFolder practiceFolder = getPracticeFolder(request.folderId(), userId);

        Interview interview = saveInterview(request, company, occupation, job, interviewer);
        Practice practice = savePractice(practiceFolder, interview);
        List<String> questions = generateQuestions(request, company, occupation, job, interviewer, userId);
        List<InterviewQuestion> savedQuestions = saveQuestions(interview, questions);

        return new InterviewStartResponse(
                interview.getId(),
                practice.getId(),
                interviewer == null ? null : interviewer.getId(),
                questions,
                savedQuestions.stream()
                        .map(InterviewQuestionItemResponse::from)
                        .toList()
        );
    }

    @Transactional
    public InterviewReportResponse completeInterview(
            Long interviewId,
            InterviewCompleteRequest request,
            MultipartFile fullAudioFile,
            MultipartFile fullVideoFile,
            Long userId
    ) {
        Practice practice = getAuthorizedPractice(interviewId, userId);
        Interview interview = practice.getInterviewSession();
        List<InterviewAnswerSubmitRequest> submittedAnswers = request == null || request.answers() == null
                ? List.of()
                : request.answers();
        FullAudioTranscriptionResult transcription = hasAudioFile(fullAudioFile)
                ? interviewAudioService.saveFullAudioAndTranscribe(interviewId, practice, fullAudioFile, userId)
                : FullAudioTranscriptionResult.empty();
        String fullTranscript = transcription.transcript();
        if (hasMediaFile(fullVideoFile)) {
            interviewAudioService.saveFullVideo(interviewId, practice, fullVideoFile, userId);
        }

        if (submittedAnswers.isEmpty() && !fullTranscript.isBlank()) {
            submittedAnswers = buildAnswersFromFullTranscript(interview.getId(), fullTranscript);
        }

        if (submittedAnswers.isEmpty() && !fullTranscript.isBlank()) {
            submittedAnswers = List.of(new InterviewAnswerSubmitRequest(null, "전체 면접 STT", fullTranscript));
        }

        if (request != null && request.durationSec() != null) {
            practice.setDurationSec(request.durationSec());
            practice.setUpdatedAt(LocalDateTime.now());
        }
        if (request != null) {
            interviewAudioService.saveVideoNonverbalSummary(practice, request.nonverbal(), request.durationSec());
        }
        saveSubmittedAnswers(submittedAnswers);
        return interviewReportService.createReport(interview, practice, submittedAnswers);
    }

    @Transactional(readOnly = true)
    public FullAudioTranscriptionResult testStt(
            InterviewCompleteRequest request,
            MultipartFile fullAudioFile,
            MultipartFile fullVideoFile
    ) {
        return interviewAudioService.transcribeFullAudioForTest(fullAudioFile);
    }

    private boolean hasAudioFile(MultipartFile audioFile) {
        return hasMediaFile(audioFile);
    }

    private boolean hasMediaFile(MultipartFile file) {
        return file != null && !file.isEmpty();
    }

    @Transactional(readOnly = true)
    public InterviewReportResponse getLatestInterviewReport(Long interviewId, Long userId) {
        getAuthorizedPractice(interviewId, userId);
        return interviewReportService.getLatestReport(interviewId);
    }

    @Transactional(readOnly = true)
    public QuestionEvaluationResponse getLatestQuestionFeedback(Long interviewId, Long questionId, Long userId) {
        getAuthorizedPractice(interviewId, userId);
        if (questionId == null) {
            throw new CustomException(ErrorCode.NOT_FOUND_INTERVIEW_QUESTION);
        }
        if (!interviewQuestionRepository.existsByIdAndInterviewId(questionId, interviewId)) {
            throw new CustomException(ErrorCode.NOT_FOUND_INTERVIEW_QUESTION);
        }
        return interviewReportService.getLatestQuestionFeedback(interviewId, questionId);
    }

    @Transactional(readOnly = true)
    public List<InterviewQuestionItemResponse> getQuestions(Long interviewId, Long userId) {
        getAuthorizedPractice(interviewId, userId);
        return interviewQuestionRepository.findAllByInterviewIdOrderByIdAsc(interviewId).stream()
                .map(InterviewQuestionItemResponse::from)
                .toList();
    }

    @Transactional
    public InterviewQuestionItemResponse addQuestion(
            Long interviewId,
            InterviewQuestionCreateRequest request,
            Long userId
    ) {
        Practice practice = getAuthorizedPractice(interviewId, userId);
        String question = request == null ? null : request.question();
        if (question == null || question.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_INTERVIEW_QUESTION_REQUEST);
        }

        InterviewQuestion interviewQuestion = createQuestion(
                practice.getInterviewSession(),
                question.trim(),
                LocalDateTime.now()
        );
        return InterviewQuestionItemResponse.from(interviewQuestionRepository.saveAndFlush(interviewQuestion));
    }

    @Transactional
    public void deleteQuestion(Long interviewId, Long questionId, Long userId) {
        getAuthorizedPractice(interviewId, userId);
        InterviewQuestion interviewQuestion = interviewQuestionRepository.findByIdAndInterviewId(questionId, interviewId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_INTERVIEW_QUESTION));
        interviewQuestionRepository.delete(interviewQuestion);
    }

    @Transactional(readOnly = true)
    public JobDetailResponse getJob(Long jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_JOB));
        return JobDetailResponse.from(job);
    }

    @Transactional(readOnly = true)
    public List<JobResponse> getJobsByOccupation(Long occupationId) {
        if (!occupationRepository.existsById(occupationId)) {
            throw new CustomException(ErrorCode.NOT_FOUND_OCCUPATION);
        }

        return jobRepository.findAllByOccupationIdOrderByIdAsc(occupationId).stream()
                .map(JobResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OccupationResponse> getOccupations() {
        return occupationRepository.findAllByOrderByIdAsc().stream()
                .map(OccupationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CompanyResponse> getCompanies() {
        List<Company> companies = companyRepository.findAllByOrderByIdAsc();
        if (companies.isEmpty()) {
            return List.of();
        }

        List<Long> companyIds = companies.stream()
                .map(Company::getId)
                .toList();
        Map<Long, List<CompanyBestResponse>> companyBestByCompanyId = companyBestRepository.findAllByCompanyIds(companyIds).stream()
                .collect(Collectors.groupingBy(
                        companyBest -> companyBest.getCompany().getId(),
                        Collectors.mapping(CompanyBestResponse::from, Collectors.toList())
                ));

        return companies.stream()
                .map(company -> CompanyResponse.of(
                        company,
                        companyBestByCompanyId.getOrDefault(company.getId(), List.of())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InterviewerResponse> getInterviewers() {
        List<Interviewer> interviewers = interviewerRepository.findAllByOrderByDisplayOrderAsc();
        if (interviewers.isEmpty()) {
            return List.of();
        }

        List<Long> ids = interviewers.stream()
                .map(Interviewer::getId)
                .toList();
        Map<Long, List<InterviewerQuestionResponse>> questionsByInterviewerId = interviewerQuestionRepository.findAllByInterviewerIds(ids).stream()
                .collect(Collectors.groupingBy(
                        interviewerQuestion -> interviewerQuestion.getInterviewer().getId(),
                        Collectors.mapping(InterviewerQuestionResponse::from, Collectors.toList())
                ));

        return interviewers.stream()
                .map(interviewer -> InterviewerResponse.of(
                        interviewer,
                        questionsByInterviewerId.getOrDefault(interviewer.getId(), List.of())
                ))
                .toList();
    }

    private List<String> generateQuestions(
            InterviewStartRequest request,
            Company company,
            Occupation occupation,
            Job job,
            Interviewer interviewer,
            Long userId
    ) {
        return interviewQuestionGenerator.generate(
                request,
                company == null ? null : company.getName(),
                occupation == null ? null : occupation.getName(),
                job == null ? null : job.getName(),
                interviewer == null ? null : interviewer.getName(),
                getCompanyBestContents(company),
                getPortfolioContext(request.portfolioIds(), userId),
                getResumeContext(request.resumeIds(), userId)
        );
    }

    private List<InterviewQuestion> saveQuestions(Interview interview, List<String> questions) {
        LocalDateTime now = LocalDateTime.now();
        return interviewQuestionRepository.saveAll(questions.stream()
                .map(question -> createQuestion(interview, question, now))
                .toList());
    }

    private Interview saveInterview(InterviewStartRequest request, Company company, Occupation occupation, Job job, Interviewer interviewer) {
        Interview interview = new Interview();
        interview.setCompany(company);
        interview.setOccupation(occupation);
        interview.setJob(job);
        interview.setInterviewer(interviewer);
        interview.setTitle(request.title());
        interview.setWorkExperience(request.workExperience());
        interview.setCreatedAt(LocalDateTime.now());
        return interviewRepository.saveAndFlush(interview);
    }

    private InterviewQuestion createQuestion(Interview interview, String question, LocalDateTime createdAt) {
        InterviewQuestion interviewQuestion = new InterviewQuestion();
        interviewQuestion.setInterview(interview);
        interviewQuestion.setQuestion(question);
        interviewQuestion.setCreatedAt(createdAt);
        return interviewQuestion;
    }

    private Practice savePractice(PracticeFolder folder, Interview interview) {
        LocalDateTime now = LocalDateTime.now();
        Practice practice = new Practice();
        practice.setFolder(folder);
        practice.setInterviewSession(interview);
        practice.setTitle(resolvePracticeTitle(interview));
        practice.setDescription(resolvePracticeDescription(interview));
        practice.setDurationSec(0L);
        practice.setCreatedAt(now);
        practice.setUpdatedAt(now);
        Practice savedPractice = practiceRepository.saveAndFlush(practice);
        createTotalFeedback(savedPractice.getId());
        return savedPractice;
    }

    private void createTotalFeedback(Long practiceId) {
        TotalFeedback totalFeedback = new TotalFeedback();
        totalFeedback.setPracticeId(practiceId);
        totalFeedback.setNonverbalFeedback("{}");
        totalFeedback.setSpeechSpeed(0L);
        totalFeedbackRepository.save(totalFeedback);
    }

    private String resolvePracticeTitle(Interview interview) {
        if (interview != null && interview.getTitle() != null && !interview.getTitle().isBlank()) {
            return interview.getTitle().trim();
        }
        return DEFAULT_INTERVIEW_FOLDER_NAME;
    }

    private String resolvePracticeDescription(Interview interview) {
        String title = resolvePracticeTitle(interview);
        if (!DEFAULT_INTERVIEW_FOLDER_NAME.equals(title)) {
            return title + " practice";
        }
        return DEFAULT_INTERVIEW_PRACTICE_DESCRIPTION;
    }

    private Practice getAuthorizedPractice(Long interviewId, Long userId) {
        if (interviewId == null) {
            throw new CustomException(ErrorCode.NOT_FOUND_INTERVIEW);
        }

        return practiceRepository.findByInterviewSession_IdAndFolder_User_Id(interviewId, userId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_INTERVIEW));
    }

    private PracticeFolder getPracticeFolder(Long folderId, Long userId) {
        if (folderId != null) {
            return practiceFolderRepository.findById(folderId)
                    .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_PRACTICE_FOLDER));
        }

        return practiceFolderRepository.findFirstByUserIdAndNameOrderByIdAsc(userId, DEFAULT_INTERVIEW_FOLDER_NAME)
                .orElseGet(() -> createDefaultPracticeFolder(userId));
    }

    private PracticeFolder createDefaultPracticeFolder(Long userId) {
        User user = new User();
        user.setId(userId);

        PracticeFolder folder = new PracticeFolder();
        folder.setUser(user);
        folder.setName(DEFAULT_INTERVIEW_FOLDER_NAME);
        folder.setDescription("AI 모의 면접 기록");
        return practiceFolderRepository.saveAndFlush(folder);
    }

    private void validateStartRequest(InterviewStartRequest request) {
        if (request == null) {
            throw new CustomException(ErrorCode.INVALID_INTERVIEW_START_REQUEST);
        }
    }

    private Company findCompany(Long companyId) {
        if (companyId == null) {
            return null;
        }

        return companyRepository.findById(companyId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_COMPANY));
    }

    private Occupation findOccupation(Long occupationId) {
        if (occupationId == null) {
            return null;
        }

        return occupationRepository.findById(occupationId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_OCCUPATION));
    }

    private Job findJob(Long jobId) {
        if (jobId == null) {
            return null;
        }

        return jobRepository.findById(jobId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_JOB));
    }

    private Interviewer findInterviewer(Long interviewerId) {
        if (interviewerId == null) {
            return null;
        }

        return interviewerRepository.findById(interviewerId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND_INTERVIEWER));
    }

    private List<String> getCompanyBestContents(Company company) {
        if (company == null) {
            return List.of();
        }

        return companyBestRepository.findAllByCompanyIds(List.of(company.getId())).stream()
                .map(CompanyBest::getContent)
                .toList();
    }

    private void saveSubmittedAnswers(List<InterviewAnswerSubmitRequest> submittedAnswers) {
        LocalDateTime now = LocalDateTime.now();
        List<InterviewAnswer> answers = submittedAnswers.stream()
                .filter(answer -> answer.questionId() != null)
                .filter(answer -> answer.answer() != null && !answer.answer().isBlank())
                .map(answer -> {
                    InterviewAnswer interviewAnswer = new InterviewAnswer();
                    interviewAnswer.setQuestionId(answer.questionId());
                    interviewAnswer.setAnswer(answer.answer());
                    interviewAnswer.setStartTimeMs(answer.startTimeMs());
                    interviewAnswer.setEndTimeMs(answer.endTimeMs());
                    interviewAnswer.setCreatedAt(now);
                    return interviewAnswer;
                })
                .toList();

        if (!answers.isEmpty()) {
            interviewAnswerRepository.saveAll(answers);
        }
    }

    private boolean hasTimedAnswers(List<InterviewAnswerSubmitRequest> submittedAnswers) {
        return submittedAnswers != null && submittedAnswers.stream()
                .anyMatch(answer -> answer.startTimeMs() != null && answer.endTimeMs() != null);
    }

    private List<InterviewAnswerSubmitRequest> buildAnswersFromTimedTranscript(
            Long interviewId,
            String fullTranscript,
            List<AudioSttSegmentResponse> segments,
            List<InterviewAnswerSubmitRequest> submittedAnswers,
            long durationMs
    ) {
        Map<Long, InterviewAnswerSubmitRequest> submittedByQuestionId = submittedAnswers.stream()
                .filter(answer -> answer.questionId() != null)
                .collect(Collectors.toMap(
                        InterviewAnswerSubmitRequest::questionId,
                        answer -> answer,
                        (left, right) -> left
                ));
        List<InterviewQuestion> questions = interviewQuestionRepository.findAllByInterviewIdOrderByIdAsc(interviewId);
        if (questions.isEmpty()) {
            return submittedAnswers;
        }

        return questions.stream()
                .map(question -> {
                    InterviewAnswerSubmitRequest submitted = submittedByQuestionId.get(question.getId());
                    String answer = submitted == null
                            ? ""
                            : sliceTranscriptByTime(
                                    fullTranscript,
                                    segments,
                                    submitted.startTimeMs(),
                                    submitted.endTimeMs(),
                                    durationMs
                            );
                    if (answer.isBlank() && submitted != null && submitted.answer() != null) {
                        answer = submitted.answer();
                    }
                    return new InterviewAnswerSubmitRequest(
                            question.getId(),
                            question.getQuestion(),
                            answer,
                            submitted == null ? null : submitted.startTimeMs(),
                            submitted == null ? null : submitted.endTimeMs()
                    );
                })
                .toList();
    }

    private List<InterviewAnswerSubmitRequest> buildAnswersFromFullTranscript(Long interviewId, String fullTranscript) {
        List<InterviewQuestion> questions = interviewQuestionRepository.findAllByInterviewIdOrderByIdAsc(interviewId);
        if (questions.isEmpty()) {
            return List.of(new InterviewAnswerSubmitRequest(null, "Full interview STT", fullTranscript));
        }

        return questions.stream()
                .map(question -> {
                    int index = questions.indexOf(question);
                    return new InterviewAnswerSubmitRequest(
                        question.getId(),
                        question.getQuestion(),
                        sliceTranscript(fullTranscript, index, questions.size())
                    );
                })
                .toList();
    }

    private String sliceTranscript(String fullTranscript, int index, int count) {
        if (fullTranscript == null || fullTranscript.isBlank()) {
            return "";
        }
        if (count <= 1) {
            return fullTranscript;
        }

        int start = Math.round((float) fullTranscript.length() * index / count);
        int end = Math.round((float) fullTranscript.length() * (index + 1) / count);
        return fullTranscript.substring(start, end).trim();
    }

    private long resolveTranscriptDurationMs(
            InterviewCompleteRequest request,
            Practice practice,
            List<InterviewAnswerSubmitRequest> submittedAnswers
    ) {
        if (request != null && request.durationSec() != null && request.durationSec() > 0) {
            return request.durationSec() * 1000L;
        }
        if (practice.getDurationSec() != null && practice.getDurationSec() > 0) {
            return practice.getDurationSec() * 1000L;
        }
        return submittedAnswers.stream()
                .map(InterviewAnswerSubmitRequest::endTimeMs)
                .filter(Objects::nonNull)
                .max(Long::compareTo)
                .orElse(1L);
    }

    private String sliceTranscriptByTime(
            String fullTranscript,
            List<AudioSttSegmentResponse> segments,
            Long startTimeMs,
            Long endTimeMs,
            long durationMs
    ) {
        if (fullTranscript == null || fullTranscript.isBlank()) {
            return "";
        }
        if (startTimeMs == null || endTimeMs == null || durationMs <= 0 || endTimeMs <= startTimeMs) {
            return "";
        }

        long safeStartMs = Math.max(0L, Math.min(startTimeMs, durationMs));
        long safeEndMs = Math.max(safeStartMs, Math.min(endTimeMs, durationMs));
        String segmentedText = sliceTranscriptBySegments(segments, safeStartMs, safeEndMs);
        if (!segmentedText.isBlank()) {
            return segmentedText;
        }

        int start = Math.round((float) fullTranscript.length() * safeStartMs / durationMs);
        int end = Math.round((float) fullTranscript.length() * safeEndMs / durationMs);
        if (end <= start) {
            return "";
        }
        return fullTranscript.substring(start, end).trim();
    }

    private String sliceTranscriptBySegments(List<AudioSttSegmentResponse> segments, long startTimeMs, long endTimeMs) {
        if (segments == null || segments.isEmpty()) {
            return "";
        }

        return segments.stream()
                .filter(segment -> segment.text() != null && !segment.text().isBlank())
                .filter(segment -> segmentEndMs(segment) > startTimeMs && segmentStartMs(segment) < endTimeMs)
                .map(AudioSttSegmentResponse::text)
                .map(String::trim)
                .collect(Collectors.joining(" "))
                .trim();
    }

    private long segmentStartMs(AudioSttSegmentResponse segment) {
        if (segment.startTimeMs() != null) {
            return segment.startTimeMs();
        }
        return Math.round(safeDouble(segment.start()) * 1000);
    }

    private long segmentEndMs(AudioSttSegmentResponse segment) {
        if (segment.endTimeMs() != null) {
            return segment.endTimeMs();
        }
        return Math.round(safeDouble(segment.end()) * 1000);
    }

    private double safeDouble(Double value) {
        return value == null ? 0.0 : value;
    }

    private String getPortfolioContext(List<Long> portfolioIds, Long userId) {
        if (portfolioIds == null || portfolioIds.isEmpty()) {
            return "선택한 포트폴리오 없음";
        }

        String context = portfolioRepository.findAllByIdInAndUserIdAndDeletedAtIsNull(portfolioIds, userId).stream()
                .map(Portfolio::getSummary)
                .filter(Objects::nonNull)
                .filter(summary -> !summary.isBlank())
                .collect(Collectors.joining("\n\n"));

        return context.isBlank() ? "포트폴리오 요약 없음" : context;
    }

    private String getResumeContext(List<Long> resumeIds, Long userId) {
        if (resumeIds == null || resumeIds.isEmpty()) {
            return "선택한 이력서/자소서 없음";
        }

        String context = resumeRepository.findAllByIdInAndUserIdAndDeletedAtIsNull(resumeIds, userId).stream()
                .map(Resume::getContent)
                .filter(Objects::nonNull)
                .filter(content -> !content.isBlank())
                .collect(Collectors.joining("\n\n"));

        if (context.isBlank()) {
            return "이력서/자소서 본문 없음";
        }

        return context.length() > MAX_RESUME_CONTEXT_LENGTH
                ? context.substring(0, MAX_RESUME_CONTEXT_LENGTH)
                : context;
    }
}
