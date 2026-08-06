package com.ssafy.b109.aivo.resume.controller;

import com.ssafy.b109.aivo.resume.dto.ResumeResponse;
import com.ssafy.b109.aivo.resume.dto.ResumeUploadRequest;
import com.ssafy.b109.aivo.resume.dto.ResumeUploadResponse;
import com.ssafy.b109.aivo.resume.service.ResumeService;
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
@RequestMapping("${API_VERSION}/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    @GetMapping
    public List<ResumeResponse> getResumes(Authentication authentication) {
        return resumeService.getResumes((Long) authentication.getPrincipal());
    }

    @GetMapping("/{resumeId}")
    public ResumeResponse getResume(
            @PathVariable Long resumeId,
            Authentication authentication
    ) {
        return resumeService.getResume(resumeId, (Long) authentication.getPrincipal());
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResumeUploadResponse upload(
            @ModelAttribute ResumeUploadRequest request,
            Authentication authentication
    ) {
        return resumeService.upload(request, (Long) authentication.getPrincipal());
    }

    @DeleteMapping("/{resumeId}")
    public ResponseEntity<Void> deleteResume(
            @PathVariable Long resumeId,
            Authentication authentication
    ) {
        resumeService.deleteResume(resumeId, (Long) authentication.getPrincipal());
        return ResponseEntity.noContent().build();
    }
}
