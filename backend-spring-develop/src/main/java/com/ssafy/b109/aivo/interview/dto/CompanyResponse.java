package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.Company;

import java.util.List;

public record CompanyResponse(Long id, String name, List<CompanyBestResponse> companyBest) {

    public static CompanyResponse of(Company company, List<CompanyBestResponse> companyBest) {
        return new CompanyResponse(company.getId(), company.getName(), companyBest);
    }
}
