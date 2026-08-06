package com.ssafy.b109.aivo.interview.dto;

import com.ssafy.b109.aivo.interview.entity.Occupation;

public record OccupationResponse(Long id, String name, String majorCategory, String subCategory) {

    public static OccupationResponse from(Occupation occupation) {
        return new OccupationResponse(
                occupation.getId(),
                occupation.getName(),
                occupation.getMajorCategory(),
                occupation.getSubCategory()
        );
    }
}
