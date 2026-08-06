package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record FullAudioTranscriptionResult(
        String transcript,
        List<AudioSttSegmentResponse> segments
) {
    public static FullAudioTranscriptionResult empty() {
        return new FullAudioTranscriptionResult("", List.of());
    }
}
