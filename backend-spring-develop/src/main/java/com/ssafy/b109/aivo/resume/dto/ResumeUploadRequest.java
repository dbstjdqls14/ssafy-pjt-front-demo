package com.ssafy.b109.aivo.resume.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Getter
@Setter
public class ResumeUploadRequest {

    private String title;
    private MultipartFile file;
}
