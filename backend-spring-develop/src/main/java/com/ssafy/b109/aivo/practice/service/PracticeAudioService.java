package com.ssafy.b109.aivo.practice.service;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import com.ssafy.b109.aivo.practice.dto.AudioAnalysisResponse;
import com.ssafy.b109.aivo.interview.dto.AudioAnalysisResult;
import com.ssafy.b109.aivo.interview.service.FastApiAudioAnalysisClient;
import com.ssafy.b109.aivo.interview.util.InterviewAudioFileUtil;
import com.ssafy.b109.aivo.nonverbal.entity.NonverbalAnalysisLog;
import com.ssafy.b109.aivo.nonverbal.repository.NonverbalAnalysisLogRepository;
import com.ssafy.b109.aivo.practice.entity.Practice;
import com.ssafy.b109.aivo.rabbitmq.entity.EventType;
import com.ssafy.b109.aivo.rabbitmq.entity.MsgStatus;
import com.ssafy.b109.aivo.rabbitmq.entity.RabbitmqEvent;
import com.ssafy.b109.aivo.rabbitmq.repository.RabbitmqEventRepository;
import com.ssafy.b109.aivo.speech.entity.SpeechAnalysisLog;
import com.ssafy.b109.aivo.speech.repository.SpeechAnalysisLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class PracticeAudioService {
    private final FastApiAudioAnalysisClient fastApiAudioAnalysisClient;
    private final SpeechAnalysisLogRepository speechAnalysisLogRepository;
    private final NonverbalAnalysisLogRepository nonverbalAnalysisLogRepository;
    private final RabbitmqEventRepository rabbitmqEventRepository;

    public AudioAnalysisResponse analyzeChunk(
            Practice practice,
            MultipartFile audioFile,
            Integer sequence
    ) {
        validateAudioFile(audioFile);

        RabbitmqEvent event = saveAudioAnalysisEvent(MsgStatus.PROCESS);
        AudioAnalysisResult result = fastApiAudioAnalysisClient.analyze(practice.getId(), sequence, audioFile);
        saveAnalysisLogs(practice.getId(), result, sequence);
        event.setStatus(MsgStatus.COMPLETE);

        return new AudioAnalysisResponse(
                practice.getId(),
                sequence,
                result.fillerCount(),
                result.silenceDetected(),
                result.stutterDetected(),
                result.silenceDurationMs(),
                result.averageWpm(),
                result.feedback()
        );
    }

    private RabbitmqEvent saveAudioAnalysisEvent(MsgStatus status) {
        RabbitmqEvent event = new RabbitmqEvent();
        event.setUuid(UUID.randomUUID().toString());
        event.setEventType(EventType.AUDIO_ANALYSIS_REQUEST);
        event.setStatus(status);
        return rabbitmqEventRepository.save(event);
    }

    private void saveAnalysisLogs(Long practiceId, AudioAnalysisResult result, Integer sequence) {
        LocalDateTime now = LocalDateTime.now();
        Long startTimeMs = sequence == null ? 0L : sequence * 10_000L;
        Long endTimeMs = startTimeMs + 10_000L;
        String metadata = InterviewAudioFileUtil.analysisMetadata(result);

        SpeechAnalysisLog speechLog = new SpeechAnalysisLog();
        speechLog.setPracticeId(practiceId);
        speechLog.setStartTimeMs(startTimeMs);
        speechLog.setEndTimeMs(endTimeMs);
        speechLog.setEventType("AUDIO_CHUNK_ANALYSIS");
        speechLog.setDetailText(result.feedback());
        speechLog.setMetricValue(result.averageWpm().floatValue());
        speechLog.setMetadata(metadata);
        speechLog.setCreatedAt(now);
        speechAnalysisLogRepository.save(speechLog);

        NonverbalAnalysisLog nonverbalLog = new NonverbalAnalysisLog();
        nonverbalLog.setPracticeId(practiceId);
        nonverbalLog.setStartTimeMs(startTimeMs);
        nonverbalLog.setEndTimeMs(endTimeMs);
        nonverbalLog.setEventType("AUDIO_NONVERBAL_ANALYSIS");
        nonverbalLog.setMetricValue(result.fillerCount().floatValue());
        nonverbalLog.setMetadata(metadata);
        nonverbalLog.setCreatedAt(now);
        nonverbalAnalysisLogRepository.save(nonverbalLog);
    }

    private void validateAudioFile(MultipartFile audioFile) {
        validateMediaFile(audioFile);
    }

    private void validateMediaFile(MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_AUDIO_ANALYSIS_REQUEST);
        }
    }
}
