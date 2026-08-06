package com.ssafy.b109.aivo.presentation.util;

import org.apache.poi.sl.draw.Drawable;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.junit.jupiter.api.Test;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PoiPptxSlideImageExtractorTest {

    @Test
    void 한글을_포함한_PPTX는_누락_폰트_대체와_글리프_렌더링을_사용한다() throws Exception {
        PoiPptxSlideImageExtractor extractor = new PoiPptxSlideImageExtractor();

        try (XMLSlideShow slideShow = new XMLSlideShow()) {
            XSLFSlide slide = slideShow.createSlide();
            XSLFTextBox textBox = slide.createTextBox();
            var run = textBox.addNewTextParagraph().addNewTextRun();
            run.setText("한글 발표 자료");
            run.setFontFamily("설치되지 않은 프레젠테이션 폰트");

            BufferedImage image = new BufferedImage(320, 180, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            try {
                extractor.configureTextRendering(graphics, slide);

                assertThat(graphics.getRenderingHint(Drawable.TEXT_RENDERING_MODE))
                        .isEqualTo(Drawable.TEXT_AS_SHAPES);
                assertThat((Map<?, ?>) graphics.getRenderingHint(Drawable.FONT_FALLBACK))
                        .containsKey("설치되지 않은 프레젠테이션 폰트");
            } finally {
                graphics.dispose();
            }
        }
    }
}
