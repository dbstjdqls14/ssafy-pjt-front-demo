package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record QuestionVoicePaceResponse(
        Double avgPace,
        Double benchmarkMin,
        Double benchmarkMax,
        QuestionVoicePaceRangeResponse slowest,
        QuestionVoicePaceRangeResponse fastest,
        Integer fillerTotal,
        List<List<Object>> fillerBreakdown,
        Integer longSilenceCount,
        List<QuestionVoiceSilenceResponse> silences,
        List<QuestionVoiceFillerEventResponse> fillerEvents
) {
}
