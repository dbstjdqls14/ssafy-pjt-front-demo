package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.CompanyBest;

public record CompanyBestResponse(String content) {

    public static CompanyBestResponse from(CompanyBest companyBest) {
        return new CompanyBestResponse(companyBest.getContent());
    }
}
