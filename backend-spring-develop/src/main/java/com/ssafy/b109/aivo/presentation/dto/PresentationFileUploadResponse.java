package com.ssafy.b109.aivo.presentation.dto;

import com.ssafy.b109.aivo.presentation.entity.PresentationProcessingStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class PresentationFileUploadResponse {
    private Long presentationId;
    private Long practiceId;
    private PresentationProcessingStatus status;
}
