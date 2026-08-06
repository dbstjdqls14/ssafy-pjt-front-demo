package com.ssafy.b109.aivo.presentation.util;

import java.io.InputStream;
import java.nio.file.Path;
import java.util.List;

public interface SlideImageExtractor {
    boolean supports(String extension);
    List<ExtractedSlideImage> extract(InputStream inputStream);
}
