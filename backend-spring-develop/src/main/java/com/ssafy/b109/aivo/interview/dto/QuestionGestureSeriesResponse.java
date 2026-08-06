package com.ssafy.b109.aivo.interview.dto;

import java.util.List;

public record QuestionGestureSeriesResponse(
        List<QuestionGestureBucketResponse> buckets,
        Integer gazeCount,
        List<QuestionGestureEventResponse> gazeEvents
) {
}
