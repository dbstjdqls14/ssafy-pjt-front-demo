package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.Job;

public record JobDetailResponse(Long id, String name, OccupationResponse occupation) {

    public static JobDetailResponse from(Job job) {
        return new JobDetailResponse(
                job.getId(),
                job.getName(),
                OccupationResponse.from(job.getOccupation())
        );
    }
}
