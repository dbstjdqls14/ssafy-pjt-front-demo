# PPT Node Editor

PPT/PPTX 파일을 업로드하면 슬라이드를 노드 캔버스로 보여주고, 노드 연결을 바꿔 슬라이드 순서를 재정렬한 뒤 새 PPTX로 저장하는 웹 도구입니다.

## Run

```powershell
cd landmark
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python ppt_node_editor.py
```

Open:

```text
http://127.0.0.1:8765/
```

OCR이 너무 느리면 다음처럼 끌 수 있습니다.

```powershell
python ppt_node_editor.py --no-ocr
```

## How It Works

- Uploads are stored under `node_editor_data/sessions/<session_id>/`.
- PPTX slide order is changed by reordering `ppt/presentation.xml` slide ids. The original slide XML, media, notes, layouts, and relationships stay in the package.
- The editor requires one continuous chain before saving. Disconnected chains are shown on the canvas but cannot be saved until reconnected.
- `.ppt` files require LibreOffice so they can be converted to `.pptx`.

## Slide Preview And OCR

The preview pipeline tries these options in order:

1. LibreOffice converts PPTX to PDF, then PyMuPDF renders each page to PNG.
2. PowerPoint COM export is attempted on Windows when available.
3. If neither renderer works, the server creates a generated SVG preview from PPTX text and embedded media.

OCR is optional at runtime. If `easyocr` is installed, it is used first. If not, `pytesseract` with Pillow is attempted. If no OCR engine is available, the editor still works with native PPTX text extraction.
