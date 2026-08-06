package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class PdfBoxSlideImageExtractor implements SlideImageExtractor {

    /*
     * OCR 정확도와 이미지 크기의 균형을 고려한 초기값.
     * DPI를 높이면 이미지 품질과 메모리 사용량이 함께 증가한다.
     */
    private static final float IMAGE_DPI = 200F;

    private static final String IMAGE_FORMAT = "png";

    @Override
    public boolean supports(String extension) {
        return "pdf".equalsIgnoreCase(extension);
    }

    @Override
    public List<ExtractedSlideImage> extract(InputStream inputStream) {

        try (RandomAccessReadBuffer buffer = new RandomAccessReadBuffer(inputStream);
             PDDocument document =
                     Loader.loadPDF(buffer)) {

            int pageCount = document.getNumberOfPages();

            if (pageCount == 0) {
                throw new CustomException(ErrorCode.EMPTY_PRESENTATION_SLIDES);
            }

            PDFRenderer renderer =
                    new PDFRenderer(document);

            List<ExtractedSlideImage> results =
                    new ArrayList<>(pageCount);

            for (int pageIndex = 0;
                 pageIndex < pageCount;
                 pageIndex++) {

                int slideNumber = pageIndex + 1;

                BufferedImage image =
                        renderer.renderImageWithDPI(
                                pageIndex,
                                IMAGE_DPI,
                                ImageType.RGB
                        );

                byte[] imageData =
                        convertToPngBytes(image);

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

    private byte[] convertToPngBytes(
            BufferedImage image
    ) {
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

            byte[] imageData =
                    outputStream.toByteArray();

            if (imageData.length == 0) {
                throw new CustomException(
                        ErrorCode.PRESENTATION_SLIDE_IMAGE_CREATE_FAILED
                );
            }

            return imageData;

        } catch (IOException e) {
            throw new CustomException(
                    ErrorCode.PRESENTATION_SLIDE_IMAGE_CREATE_FAILED
            );
        }
    }

}