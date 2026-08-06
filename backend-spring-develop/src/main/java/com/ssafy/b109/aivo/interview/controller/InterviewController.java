package com.ssafy.b109.aivo.interview.controller;

import com.ssafy.b109.aivo.interview.dto.CompanyResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewCompleteRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewQuestionCreateRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewQuestionItemResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewReportResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewStartRequest;
import com.ssafy.b109.aivo.interview.dto.InterviewStartResponse;
import com.ssafy.b109.aivo.interview.dto.InterviewerResponse;
import com.ssafy.b109.aivo.interview.dto.FullAudioTranscriptionResult;
import com.ssafy.b109.aivo.interview.dto.JobDetailResponse;
import com.ssafy.b109.aivo.interview.dto.JobResponse;
import com.ssafy.b109.aivo.interview.dto.OccupationResponse;
import com.ssafy.b109.aivo.interview.dto.QuestionEvaluationResponse;
import com.ssafy.b109.aivo.interview.service.InterviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("${API_VERSION}/interviews")
@RequiredArgsConstructor
@Slf4j
public class InterviewController {

    private final InterviewService interviewService;

    @PostMapping
    public ResponseEntity<InterviewStartResponse> startInterview(
            @RequestBody InterviewStartRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(interviewService.startInterview(request, (Long) authentication.getPrincipal()));
    }

    @PostMapping(value = "/{interviewId}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<InterviewReportResponse> completeInterviewWithAudio(
            @PathVariable Long interviewId,
            @RequestPart(value = "request", required = false) InterviewCompleteRequest request,
            @RequestPart(value = "audio", required = false) MultipartFile audio,
            @RequestPart(value = "video", required = false) MultipartFile video,
            Authentication authentication
    ) {
        return ResponseEntity.ok(interviewService.completeInterview(
                interviewId,
                request,
                audio,
                video,
                (Long) authentication.getPrincipal()
        ));
    }

    @PostMapping(value = "/stt/test", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FullAudioTranscriptionResult> testStt(
            @RequestPart(value = "request", required = false) InterviewCompleteRequest request,
            @RequestPart("audio") MultipartFile audio,
            @RequestPart(value = "video", required = false) MultipartFile video
    ) {
        return ResponseEntity.ok(interviewService.testStt(request, audio, video));
    }

    @GetMapping("/{interviewId}/interview-report")
    public ResponseEntity<InterviewReportResponse> getLatestInterviewReport(
            @PathVariable Long interviewId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(interviewService.getLatestInterviewReport(
                interviewId,
                (Long) authentication.getPrincipal()
        ));
    }

    @GetMapping("/{interviewId}/questions/{questionId}/feedbacks")
    public ResponseEntity<QuestionEvaluationResponse> getLatestQuestionFeedback(
            @PathVariable Long interviewId,
            @PathVariable Long questionId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(interviewService.getLatestQuestionFeedback(
                interviewId,
                questionId,
                (Long) authentication.getPrincipal()
        ));
    }

    @GetMapping("/{interviewId}/questions")
    public ResponseEntity<List<InterviewQuestionItemResponse>> getQuestions(
            @PathVariable Long interviewId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(interviewService.getQuestions(
                interviewId,
                (Long) authentication.getPrincipal()
        ));
    }

    @PostMapping("/{interviewId}/questions")
    public ResponseEntity<InterviewQuestionItemResponse> addQuestion(
            @PathVariable Long interviewId,
            @RequestBody InterviewQuestionCreateRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(interviewService.addQuestion(
                interviewId,
                request,
                (Long) authentication.getPrincipal()
        ));
    }

    @DeleteMapping("/{interviewId}/questions/{questionId}")
    public ResponseEntity<Void> deleteQuestion(
            @PathVariable Long interviewId,
            @PathVariable Long questionId,
            Authentication authentication
    ) {
        interviewService.deleteQuestion(interviewId, questionId, (Long) authentication.getPrincipal());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/jobs/{jobId}")
    public JobDetailResponse getJob(@PathVariable Long jobId) {
        return interviewService.getJob(jobId);
    }

    @GetMapping("/occupations/{occupationId}/jobs")
    public List<JobResponse> getJobsByOccupation(@PathVariable Long occupationId) {
        return interviewService.getJobsByOccupation(occupationId);
    }

    @GetMapping("/occupations")
    public List<OccupationResponse> getOccupations() {
        return interviewService.getOccupations();
    }

    @GetMapping("/companies")
    public List<CompanyResponse> getCompanies() {
        return interviewService.getCompanies();
    }

    @GetMapping("/interviewers")
    public List<InterviewerResponse> getInterviewers() {
        return interviewService.getInterviewers();
    }
}
