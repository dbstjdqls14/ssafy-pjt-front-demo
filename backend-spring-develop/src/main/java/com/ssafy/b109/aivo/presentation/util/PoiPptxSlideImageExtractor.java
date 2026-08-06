package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import org.apache.poi.sl.draw.Drawable;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFGroupShape;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class PoiPptxSlideImageExtractor implements SlideImageExtractor{

    private static final double SCALE = 2.0;
    private static final String IMAGE_FORMAT = "png";
    private static final String KOREAN_GLYPH_SAMPLE = "가나다라마바사아자차카타파하";
    private static final List<String> KOREAN_FONT_CANDIDATES = List.of(
            "Noto Sans CJK KR",
            "Noto Sans KR",
            "NanumGothic",
            "나눔고딕",
            "Malgun Gothic",
            "맑은 고딕",
            "Apple SD Gothic Neo",
            Font.SANS_SERIF
    );
    private static final Set<String> COMMON_PRESENTATION_FONTS = Set.of(
            "Aptos",
            "Aptos Display",
            "Arial",
            "Calibri",
            "Pretendard",
            "Noto Sans KR",
            "맑은 고딕",
            "나눔고딕"
    );

    @Override
    public List<ExtractedSlideImage> extract(InputStream inputStream) {

        try (
                XMLSlideShow slideShow = new XMLSlideShow(inputStream)
        ) {
            List<XSLFSlide> slides = slideShow.getSlides();

            if (slides.isEmpty()) {
                throw new CustomException(
                        ErrorCode.EMPTY_PRESENTATION_SLIDES
                );
            }

            Dimension pageSize = slideShow.getPageSize();

            int imageWidth =
                    (int) Math.ceil(pageSize.getWidth() * SCALE);

            int imageHeight =
                    (int) Math.ceil(pageSize.getHeight() * SCALE);

            List<ExtractedSlideImage> results =
                    new ArrayList<>(slides.size());

            for (int index = 0; index < slides.size(); index++) {
                int slideNumber = index + 1;

                byte[] imageData = renderToPngBytes(
                        slides.get(index),
                        imageWidth,
                        imageHeight
                );

                results.add(
                        new ExtractedSlideImage(
                                slideNumber,
                                imageData
                        )
                );
            }

            return results;

        } catch (CustomException e) {
            throw e;
        } catch (IOException e) {
            throw new CustomException(ErrorCode.PRESENTATION_SLIDE_CONVERSION_FAILED);
        }
    }

    private byte[] renderToPngBytes(
            XSLFSlide slide,
            int imageWidth,
            int imageHeight
    ) {
        BufferedImage image = new BufferedImage(
                imageWidth,
                imageHeight,
                BufferedImage.TYPE_INT_RGB
        );

        Graphics2D graphics = image.createGraphics();

        try {
            applyRenderingHints(graphics);
            configureTextRendering(graphics, slide);

            graphics.setColor(Color.WHITE);
            graphics.fillRect(
                    0,
                    0,
                    imageWidth,
                    imageHeight
            );

            graphics.scale(SCALE, SCALE);
            slide.draw(graphics);

        } finally {
            graphics.dispose();
        }

        try (ByteArrayOutputStream outputStream =
                     new ByteArrayOutputStream()) {

            boolean written = ImageIO.write(
                    image,
                    IMAGE_FORMAT,
                    outputStream
            );

            if (!written) {
                throw new CustomException(
                        ErrorCode.PRESENTATION_IMAGE_WRITER_NOT_FOUND
                );
            }

            byte[] imageData = outputStream.toByteArray();

            if (imageData.length == 0) {
                throw new CustomException(ErrorCode.PRESENTATION_SLIDE_IMAGE_CREATE_FAILED);
            }

            return imageData;

        } catch (IOException e) {
            throw new CustomException(ErrorCode.PRESENTATION_SLIDE_IMAGE_CREATE_FAILED);
        }
    }

    private void applyRenderingHints(Graphics2D graphics) {
        graphics.setRenderingHint(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON
        );

        graphics.setRenderingHint(
                RenderingHints.KEY_TEXT_ANTIALIASING,
                RenderingHints.VALUE_TEXT_ANTIALIAS_ON
        );

        graphics.setRenderingHint(
                RenderingHints.KEY_RENDERING,
                RenderingHints.VALUE_RENDER_QUALITY
        );

        graphics.setRenderingHint(
                RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BICUBIC
        );
    }

    void configureTextRendering(Graphics2D graphics, XSLFSlide slide) {
        graphics.setRenderingHint(
                Drawable.TEXT_RENDERING_MODE,
                Drawable.TEXT_AS_SHAPES
        );

        String fallbackFont = resolveKoreanFallbackFont();
        Map<String, String> fallbackMap = new LinkedHashMap<>();
        Set<String> requestedFonts = new LinkedHashSet<>(COMMON_PRESENTATION_FONTS);
        collectRequestedFonts(slide.getShapes(), requestedFonts);
        requestedFonts.forEach(font -> fallbackMap.put(font, fallbackFont));
        graphics.setRenderingHint(Drawable.FONT_FALLBACK, fallbackMap);
    }

    private void collectRequestedFonts(List<XSLFShape> shapes, Set<String> requestedFonts) {
        for (XSLFShape shape : shapes) {
            if (shape instanceof XSLFTextShape textShape) {
                textShape.getTextParagraphs().forEach(paragraph ->
                        paragraph.getTextRuns().forEach(run -> {
                            String family = run.getFontFamily();
                            if (family != null && !family.isBlank()) {
                                requestedFonts.add(family);
                            }
                        })
                );
            }
            if (shape instanceof XSLFGroupShape groupShape) {
                collectRequestedFonts(groupShape.getShapes(), requestedFonts);
            }
            if (shape instanceof XSLFTable table) {
                table.getRows().forEach(row -> row.getCells().forEach(cell ->
                        cell.getTextParagraphs().forEach(paragraph ->
                                paragraph.getTextRuns().forEach(run -> {
                                    String family = run.getFontFamily();
                                    if (family != null && !family.isBlank()) {
                                        requestedFonts.add(family);
                                    }
                                })
                        )
                ));
            }
        }
    }

    private String resolveKoreanFallbackFont() {
        Map<String, String> installedFonts = new LinkedHashMap<>();
        Arrays.stream(GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames(Locale.ROOT))
                .forEach(name -> installedFonts.putIfAbsent(name.toLowerCase(Locale.ROOT), name));

        for (String candidate : KOREAN_FONT_CANDIDATES) {
            String installed = installedFonts.get(candidate.toLowerCase(Locale.ROOT));
            if (installed != null && supportsKorean(installed)) {
                return installed;
            }
        }
        return installedFonts.values().stream()
                .filter(this::supportsKorean)
                .findFirst()
                .orElse(Font.SANS_SERIF);
    }

    private boolean supportsKorean(String fontFamily) {
        return new Font(fontFamily, Font.PLAIN, 12).canDisplayUpTo(KOREAN_GLYPH_SAMPLE) < 0;
    }

    @Override
    public boolean supports(String extension) {
        return "pptx".equalsIgnoreCase(extension);
    }
}
