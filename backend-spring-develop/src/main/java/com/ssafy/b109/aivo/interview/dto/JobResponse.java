package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.Job;

public record JobResponse(Long id, String name) {

    public static JobResponse from(Job job) {
        return new JobResponse(job.getId(), job.getName());
    }
}
