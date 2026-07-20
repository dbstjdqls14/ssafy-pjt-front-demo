from __future__ import annotations

from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image

from presentation_analysis.config import AnalysisConfig


class OCRProcessor:
    def __init__(self, config: AnalysisConfig) -> None:
        self.config = config
        self.engine_name = "disabled"
        self.reader: Any | None = None
        self.warnings: list[str] = []
        self._load_engine()

    @property
    def enabled(self) -> bool:
        return self.engine_name != "disabled"

    def _load_engine(self) -> None:
        try:
            import easyocr  # type: ignore

            self.reader = easyocr.Reader(["ko", "en"])
            self.engine_name = "easyocr"
            return
        except Exception as exc:
            self.warnings.append(f"EasyOCR을 사용할 수 없어 pytesseract를 확인합니다: {exc}")

        try:
            import pytesseract  # type: ignore  # noqa: F401

            self.engine_name = "pytesseract"
            return
        except Exception as exc:
            self.warnings.append(f"OCR 라이브러리를 사용할 수 없습니다. 이미지 OCR을 건너뜁니다: {exc}")
            self.engine_name = "disabled"

    def extract_text_from_image_blob(self, blob: bytes) -> tuple[str, str | None]:
        try:
            image = Image.open(BytesIO(blob)).convert("RGB")
        except Exception as exc:
            return "", f"이미지를 열 수 없어 OCR을 건너뜁니다: {exc}"

        width, height = image.size
        if width < self.config.min_ocr_image_width or height < self.config.min_ocr_image_height:
            return "", None

        if not self.enabled:
            return "", "OCR 비활성화 상태입니다. easyocr 또는 pytesseract 설치가 필요합니다."

        try:
            if self.engine_name == "easyocr":
                assert self.reader is not None
                result = self.reader.readtext(np.array(image), detail=0, paragraph=True)
                return "\n".join(str(item).strip() for item in result if str(item).strip()), None

            import pytesseract  # type: ignore

            text = pytesseract.image_to_string(image, lang="kor+eng")
            return text.strip(), None
        except Exception as exc:
            return "", f"OCR 처리 실패: {exc}"
