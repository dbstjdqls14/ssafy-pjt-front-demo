package com.ssafy.b109.aivo.presentation.util;

import com.ssafy.b109.aivo.global.exception.CustomException;
import com.ssafy.b109.aivo.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class SlideImageExtractorResolver {

    private final List<SlideImageExtractor> extractors;

    public SlideImageExtractor resolve(String extension) {
        if (extension == null || extension.isBlank()) {
            throw new CustomException(
                    ErrorCode.MISSING_PRESENTATION_FILE_EXTENSION
            );
        }

        String normalizedExtension = extension.toLowerCase(Locale.ROOT);

        return extractors.stream()
                .filter(extractor ->
                        extractor.supports(normalizedExtension)
                ).findFirst()
                .orElseThrow(() ->
                        new CustomException(
                                ErrorCode.UNSUPPORTED_PRESENTATION_FILE_TYPE
                        )
                );
    }


}
