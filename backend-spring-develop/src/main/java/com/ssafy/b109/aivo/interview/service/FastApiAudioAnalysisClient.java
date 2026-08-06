package com.ssafy.b109.aivo.interview.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.interview.dto.AudioAnalysisResult;
import com.ssafy.b109.aivo.interview.dto.AudioSttSegmentResponse;
import com.ssafy.b109.aivo.interview.dto.FullAudioTranscriptionResult;
import com.ssafy.b109.aivo.interview.util.InterviewAudioFileUtil;
import com.ssafy.b109.aivo.media.util.MediaFileUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class FastApiAudioAnalysisClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${fastapi.base-url:http://localhost:8090}")
    private String fastApiBaseUrl;

    public AudioAnalysisResult analyze(Long practiceId, Integer sequence, MultipartFile audioFile) {
        try {
            FastApiAudioAnalysisResponse response = restClientBuilder.build()
                    .post()
                    .uri(buildAudioAnalysisUri(practiceId, sequence))
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(buildMultipartBody(audioFile, "audio.wav"))
                    .retrieve()
                    .body(FastApiAudioAnalysisResponse.class);

            if (response == null) {
                throw new CustomException(ErrorCode.AUDIO_ANALYSIS_FAILED);
            }
            return response.toResult();
        } catch (CustomException exception) {
            throw exception;
        } catch (RestClientResponseException exception) {
            log.warn(
                    "FastAPI audio analysis failed: status={} body={}",
                    exception.getStatusCode(),
                    exception.getResponseBodyAsString()
            );
            throw new CustomException(ErrorCode.AUDIO_ANALYSIS_FAILED);
        } catch (Exception exception) {
            log.warn("FastAPI audio analysis failed: {}", exception.getMessage());
            throw new CustomException(ErrorCode.AUDIO_ANALYSIS_FAILED);
        }
    }

    public FullAudioTranscriptionResult transcribeFullAudio(Long interviewId, MultipartFile audioFile) {
        try {
            FastApiFullAudioSttResponse response = restClientBuilder.build()
                    .post()
                    .uri(UriComponentsBuilder.fromUriString(fastApiBaseUrl)
                            .path("/api/v1/interviews/{interviewId}/stt")
                            .buildAndExpand(interviewId)
                            .toUri())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(buildMultipartBody(audioFile, resolveFilename(audioFile)))
                    .retrieve()
                    .body(FastApiFullAudioSttResponse.class);

            if (response == null || response.transcript() == null) {
                throw new CustomException(ErrorCode.AUDIO_STT_FAILED);
            }
            return response.toResult();
        } catch (CustomException exception) {
            throw exception;
        } catch (RestClientResponseException exception) {
            log.warn(
                    "FastAPI full audio STT failed: status={} body={}",
                    exception.getStatusCode(),
                    exception.getResponseBodyAsString()
            );
            throw new CustomException(ErrorCode.AUDIO_STT_FAILED);
        } catch (Exception exception) {
            log.warn("FastAPI full audio STT failed: {}", exception.getMessage());
            throw new CustomException(ErrorCode.AUDIO_STT_FAILED);
        }
    }

    private URI buildAudioAnalysisUri(Long practiceId, Integer sequence) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(fastApiBaseUrl)
                .path("/api/v1/practices/{practiceId}/audio-analysis");

        if (sequence != null) {
            builder.queryParam("sequence", sequence);
        }

        return builder.buildAndExpand(practiceId).toUri();
    }

    private MultiValueMap<String, Object> buildMultipartBody(MultipartFile audioFile, String filename) throws Exception {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(MediaFileUtil.resolveContentType(audioFile)));
        headers.setContentDisposition(ContentDisposition.formData()
                .name("audio")
                .filename(filename)
                .build());
        body.add("audio", new HttpEntity<>(new ByteArrayResource(audioFile.getBytes()) {
            @Override
            public String getFilename() {
                return filename;
            }
        }, headers));
        return body;
    }

    private String resolveFilename(MultipartFile audioFile) {
        return audioFile.getOriginalFilename() == null || audioFile.getOriginalFilename().isBlank()
                ? "audio.wav"
                : audioFile.getOriginalFilename();
    }

    private record FastApiAudioAnalysisResponse(
            Integer fillerCount,
            Boolean silenceDetected,
            Boolean stutterDetected,
            Integer silenceDurationMs,
            Integer averageWpm,
            String feedback
    ) {

        private AudioAnalysisResult toResult() {
            return new AudioAnalysisResult(
                    fillerCount == null ? 0 : fillerCount,
                    Boolean.TRUE.equals(silenceDetected),
                    Boolean.TRUE.equals(stutterDetected),
                    silenceDurationMs == null ? 0 : silenceDurationMs,
                    averageWpm == null ? 0 : averageWpm,
                    feedback == null ? "" : feedback
            );
        }
    }

    private record FastApiFullAudioSttResponse(
            String transcript,
            List<AudioSttSegmentResponse> segments
    ) {
        private FullAudioTranscriptionResult toResult() {
            return new FullAudioTranscriptionResult(
                    transcript == null ? "" : transcript,
                    segments == null ? List.of() : segments
            );
        }
    }
}
