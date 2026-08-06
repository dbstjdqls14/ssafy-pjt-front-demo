package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class SlideImageExtractorResolverTest {

    @Autowired
    private SlideImageExtractorResolver resolver;

    @Test
    void pdf_확장자는_PDF_변환기를_선택한다() {
        SlideImageExtractor extractor =
                resolver.resolve("pdf");

        assertThat(extractor)
                .isInstanceOf(
                        PdfBoxSlideImageExtractor.class
                );
    }

    @Test
    void pptx_확장자는_PPTX_변환기를_선택한다() {
        SlideImageExtractor extractor =
                resolver.resolve("PPTX");

        assertThat(extractor)
                .isInstanceOf(
                        PoiPptxSlideImageExtractor.class
                );
    }

    @Test
    void 지원하지_않는_확장자는_예외가_발생한다() {
        assertThatThrownBy(() ->
                resolver.resolve("ppt")
        )
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(
                        ErrorCode.UNSUPPORTED_PRESENTATION_FILE_TYPE
                );
    }
}