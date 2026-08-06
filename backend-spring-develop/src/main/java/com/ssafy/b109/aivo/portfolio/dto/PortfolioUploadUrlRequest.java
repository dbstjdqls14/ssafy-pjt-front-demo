package com.ssafy.b109.aivo.portfolio.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Getter
@Setter
public class PortfolioUploadUrlRequest {

    private String title;
    private MultipartFile file;
}
