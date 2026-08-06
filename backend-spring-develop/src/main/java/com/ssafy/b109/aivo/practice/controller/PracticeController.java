package com.ssafy.b109.aivo.practice.controller;

import com.ssafy.b109.aivo.practice.dto.AudioAnalysisResponse;
import com.ssafy.b109.aivo.practice.service.PracticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RequestMapping("${API_VERSION}/practices")
@RestController
@RequiredArgsConstructor
public class PracticeController {

    private final PracticeService practiceService;

    @PostMapping(value = "/{practiceId}/audio-analysis", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AudioAnalysisResponse> analyzeAudio(
            @PathVariable Long practiceId,
            @RequestPart("audio") MultipartFile audio,
            @RequestParam(required = false) Integer sequence,
            Authentication authentication
    ) {
        return ResponseEntity.ok(practiceService.analyzeAudio(
                practiceId,
                audio,
                sequence,
                (Long) authentication.getPrincipal()
        ));
    }

    @PostMapping(value = "/interviews/{interviewId}/audio-analysis", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AudioAnalysisResponse> analyzeInterviewAudio(
            @PathVariable Long interviewId,
            @RequestPart("audio") MultipartFile audio,
            @RequestParam(required = false) Integer sequence,
            Authentication authentication
    ) {
        return ResponseEntity.ok(practiceService.analyzeInterviewAudio(
                interviewId,
                audio,
                sequence,
                (Long) authentication.getPrincipal()
        ));
    }
}
