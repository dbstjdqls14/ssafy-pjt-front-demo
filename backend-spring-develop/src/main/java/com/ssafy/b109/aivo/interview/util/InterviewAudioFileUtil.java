package com.ssafy.b109.aivo.interview.util;

import com.ssafy.b109.aivo.interview.dto.AudioAnalysisResult;

public final class InterviewAudioFileUtil {

    private InterviewAudioFileUtil() {
    }

    public static String analysisMetadata(AudioAnalysisResult result) {
        return """
                {"fillerCount":%d,"silenceDetected":%s,"stutterDetected":%s,"silenceDurationMs":%d,"averageWpm":%d}
                """.formatted(
                result.fillerCount(),
                result.silenceDetected(),
                result.stutterDetected(),
                result.silenceDurationMs(),
                result.averageWpm()
        ).trim();
    }
}
