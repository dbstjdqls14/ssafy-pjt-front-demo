package com.ssafy.b109.aivo.interview.util;

import com.ssafy.b109.aivo.interview.dto.NonverbalSummaryResponse;
import com.ssafy.b109.aivo.nonverbal.entity.NonverbalAnalysisLog;
import com.ssafy.b109.aivo.speech.entity.SpeechAnalysisLog;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class InterviewReportEvaluator {

    public NonverbalSummaryResponse buildNonverbalSummary(List<SpeechAnalysisLog> speechLogs) {
        return buildSummary(toSpeechChunkLogs(speechLogs));
    }

    public NonverbalSummaryResponse buildNonverbalSummary(
            List<SpeechAnalysisLog> speechLogs,
            List<NonverbalAnalysisLog> nonverbalLogs
    ) {
        List<AudioChunkLog> speechChunks = toSpeechChunkLogs(speechLogs);
        List<AudioChunkLog> nonverbalChunks = toAudioNonverbalChunkLogs(nonverbalLogs);
        if (sumFillerCount(nonverbalChunks) > sumFillerCount(speechChunks)) {
            return buildSummary(nonverbalChunks);
        }
        if (speechChunks.isEmpty() && !nonverbalChunks.isEmpty()) {
            return buildSummary(nonverbalChunks);
        }
        return buildSummary(speechChunks);
    }

    private NonverbalSummaryResponse buildSummary(List<AudioChunkLog> chunks) {
        int analyzedChunks = chunks.size();
        int totalFillerCount = sumFillerCount(chunks);
        int silenceCount = (int) chunks.stream()
                .filter(log -> JsonMetadataUtil.extractBoolean(log.metadata(), "silenceDetected"))
                .count();
        int stutterCount = (int) chunks.stream()
                .filter(log -> JsonMetadataUtil.extractBoolean(log.metadata(), "stutterDetected"))
                .count();
        int averageWpm = analyzedChunks == 0
                ? 0
                : (int) Math.round(chunks.stream()
                .mapToInt(this::averageWpm)
                .filter(value -> value > 0)
                .average()
                .orElse(0));

        String feedback = analyzedChunks == 0
                ? "분석된 오디오 청크가 없습니다."
                : "추임새, 침묵, 말더듬 지표를 누적 집계했습니다.";

        return new NonverbalSummaryResponse(
                analyzedChunks,
                totalFillerCount,
                silenceCount,
                stutterCount,
                averageWpm,
                feedback
        );
    }

    private int sumFillerCount(List<AudioChunkLog> chunks) {
        return chunks.stream()
                .mapToInt(log -> JsonMetadataUtil.extractInt(log.metadata(), "fillerCount"))
                .sum();
    }

    private int averageWpm(AudioChunkLog log) {
        int metadataValue = JsonMetadataUtil.extractInt(log.metadata(), "averageWpm");
        if (metadataValue > 0) {
            return metadataValue;
        }
        return log.metricValue() == null ? 0 : Math.round(log.metricValue());
    }

    private List<AudioChunkLog> toSpeechChunkLogs(List<SpeechAnalysisLog> speechLogs) {
        if (speechLogs == null || speechLogs.isEmpty()) {
            return List.of();
        }
        return speechLogs.stream()
                .filter(log -> hasAudioChunkMetadata(log.getMetadata()))
                .map(log -> new AudioChunkLog(log.getMetadata(), log.getMetricValue()))
                .toList();
    }

    private List<AudioChunkLog> toAudioNonverbalChunkLogs(List<NonverbalAnalysisLog> nonverbalLogs) {
        if (nonverbalLogs == null || nonverbalLogs.isEmpty()) {
            return List.of();
        }
        return nonverbalLogs.stream()
                .filter(log -> log.getEventType() != null && log.getEventType().contains("AUDIO"))
                .filter(log -> hasAudioChunkMetadata(log.getMetadata()))
                .map(log -> new AudioChunkLog(log.getMetadata(), null))
                .toList();
    }

    private boolean hasAudioChunkMetadata(String metadata) {
        return metadata != null && metadata.contains("\"fillerCount\"");
    }

    private record AudioChunkLog(String metadata, Float metricValue) {
    }
}
