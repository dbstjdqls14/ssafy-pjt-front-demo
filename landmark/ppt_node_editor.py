from __future__ import annotations

import argparse
import html
import json
import mimetypes
import os
import posixpath
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import zipfile
from dataclasses import dataclass
from email.parser import BytesParser
from email.policy import default
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


ROOT_DIR = Path(__file__).resolve().parent
STATIC_DIR = ROOT_DIR / "static"
DATA_DIR = ROOT_DIR / "node_editor_data"
MAX_UPLOAD_BYTES = 120 * 1024 * 1024

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"

ET.register_namespace("p", P_NS)
ET.register_namespace("a", A_NS)
ET.register_namespace("r", R_NS)


@dataclass(frozen=True)
class Relationship:
    rel_id: str
    rel_type: str
    target: str
    target_mode: str | None


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class OcrEngine:
    def __init__(self) -> None:
        self.name = "disabled"
        self.reader: Any | None = None
        self.warnings: list[str] = []
        self._load()

    @property
    def enabled(self) -> bool:
        return self.name != "disabled"

    def _load(self) -> None:
        try:
            import easyocr  # type: ignore

            self.reader = easyocr.Reader(["ko", "en"], gpu=False)
            self.name = "easyocr"
            return
        except Exception as exc:
            self.warnings.append(f"EasyOCR unavailable: {exc}")

        try:
            import pytesseract  # type: ignore  # noqa: F401
            from PIL import Image  # type: ignore  # noqa: F401

            self.name = "pytesseract"
            return
        except Exception as exc:
            self.warnings.append(f"pytesseract/Pillow unavailable: {exc}")
            self.name = "disabled"

    def read_image(self, image_path: Path) -> tuple[str, str | None]:
        if not self.enabled:
            return "", "OCR engine is not available."

        try:
            if self.name == "easyocr":
                assert self.reader is not None
                result = self.reader.readtext(str(image_path), detail=0, paragraph=True)
                return "\n".join(str(item).strip() for item in result if str(item).strip()), None

            import pytesseract  # type: ignore
            from PIL import Image  # type: ignore

            image = Image.open(image_path).convert("RGB")
            try:
                text = pytesseract.image_to_string(image, lang="kor+eng")
            except Exception:
                text = pytesseract.image_to_string(image, lang="eng")
            return text.strip(), None
        except Exception as exc:
            return "", f"OCR failed for {image_path.name}: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Node canvas PPT order editor")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--no-ocr", action="store_true", help="Skip OCR even if OCR packages are installed")
    args = parser.parse_args()

    args.data_dir.mkdir(parents=True, exist_ok=True)
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    handler = make_handler(args.data_dir.resolve(), STATIC_DIR.resolve(), enable_ocr=not args.no_ocr)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    url = f"http://{args.host}:{args.port}/"
    print(f"PPT node editor is running at {url}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping PPT node editor.", flush=True)
    finally:
        server.server_close()
    return 0


def make_handler(data_dir: Path, static_dir: Path, enable_ocr: bool):
    class PptNodeEditorHandler(BaseHTTPRequestHandler):
        server_version = "PptNodeEditor/0.1"

        def do_GET(self) -> None:  # noqa: N802
            try:
                self._handle_get()
            except ApiError as exc:
                self._send_json({"error": exc.message}, exc.status)
            except Exception as exc:
                self._send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

        def do_POST(self) -> None:  # noqa: N802
            try:
                self._handle_post()
            except ApiError as exc:
                self._send_json({"error": exc.message}, exc.status)
            except Exception as exc:
                self._send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

        def log_message(self, fmt: str, *args: Any) -> None:
            print(f"[{self.log_date_time_string()}] {fmt % args}", flush=True)

        def _handle_get(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = urllib.parse.unquote(parsed.path)

            if path in ("/", "/ppt-node-editor"):
                self._send_file(static_dir / "ppt-node-editor.html")
                return

            if path.startswith("/sessions/"):
                relative = path.removeprefix("/sessions/")
                self._send_file(safe_join(data_dir, relative))
                return

            if path.startswith("/downloads/"):
                relative = path.removeprefix("/downloads/")
                file_path = safe_join(data_dir, relative)
                self._send_file(file_path, as_attachment=True)
                return

            raise ApiError(HTTPStatus.NOT_FOUND, "Not found")

        def _handle_post(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = urllib.parse.unquote(parsed.path)

            if path == "/api/presentations":
                self._upload_presentation()
                return

            match = re.fullmatch(r"/api/presentations/([a-f0-9]{16})/save", path)
            if match:
                self._save_presentation(match.group(1))
                return

            raise ApiError(HTTPStatus.NOT_FOUND, "Not found")

        def _upload_presentation(self) -> None:
            length = parse_content_length(self.headers.get("Content-Length"))
            if length <= 0:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Missing request body.")
            if length > MAX_UPLOAD_BYTES:
                raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "PPT upload is too large.")

            content_type = self.headers.get("Content-Type", "")
            body = self.rfile.read(length)
            upload = parse_multipart_file(body, content_type)
            original_name = sanitize_filename(upload["filename"])
            suffix = Path(original_name).suffix.lower()
            if suffix not in {".pptx", ".ppt"}:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Only .pptx and .ppt files are supported.")

            session_id = secrets.token_hex(8)
            session_dir = data_dir / session_id
            session_dir.mkdir(parents=True, exist_ok=True)

            source_path = session_dir / f"source{suffix}"
            source_path.write_bytes(upload["content"])

            warnings: list[str] = []
            pptx_path = source_path
            if suffix == ".ppt":
                pptx_path, convert_warnings = convert_legacy_ppt(source_path, session_dir)
                warnings.extend(convert_warnings)

            manifest = build_manifest(
                session_id=session_id,
                session_dir=session_dir,
                pptx_path=pptx_path,
                original_name=original_name,
                enable_ocr=enable_ocr,
            )
            manifest["warnings"] = warnings + manifest.get("warnings", [])
            (session_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            self._send_json(manifest)

        def _save_presentation(self, session_id: str) -> None:
            session_dir = data_dir / session_id
            if not session_dir.exists():
                raise ApiError(HTTPStatus.NOT_FOUND, "Presentation session was not found.")

            manifest_path = session_dir / "manifest.json"
            if not manifest_path.exists():
                raise ApiError(HTTPStatus.NOT_FOUND, "Presentation manifest was not found.")

            request = read_json_body(self)
            order = request.get("order")
            if not isinstance(order, list) or not all(isinstance(item, str) for item in order):
                raise ApiError(HTTPStatus.BAD_REQUEST, "Save payload must include an order array.")

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            source_pptx = session_dir / manifest["source_pptx"]
            if not source_pptx.exists():
                raise ApiError(HTTPStatus.NOT_FOUND, "Source PPTX was not found.")

            slides = manifest["slides"]
            expected = [slide["uid"] for slide in slides]
            if sorted(order) != sorted(expected):
                raise ApiError(HTTPStatus.BAD_REQUEST, "Order must contain every slide exactly once.")

            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_name = f"{Path(manifest['original_name']).stem}_node_order_{timestamp}.pptx"
            output_path = session_dir / output_name
            reorder_pptx(source_pptx, output_path, order, slides)

            download_url = f"/downloads/{session_id}/{urllib.parse.quote(output_name)}"
            self._send_json({"download_url": download_url, "filename": output_name})

        def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status.value)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _send_file(self, file_path: Path, as_attachment: bool = False) -> None:
            if not file_path.exists() or not file_path.is_file():
                raise ApiError(HTTPStatus.NOT_FOUND, "File not found")

            content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
            data = file_path.read_bytes()
            self.send_response(HTTPStatus.OK.value)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            if as_attachment:
                safe_name = file_path.name.replace('"', "")
                self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
            self.end_headers()
            self.wfile.write(data)

    return PptNodeEditorHandler


def build_manifest(
    session_id: str,
    session_dir: Path,
    pptx_path: Path,
    original_name: str,
    enable_ocr: bool,
) -> dict[str, Any]:
    warnings: list[str] = []
    slides = extract_slides(pptx_path, session_id, session_dir, warnings)
    if not slides:
        raise ApiError(HTTPStatus.BAD_REQUEST, "No slides were found in this PPTX.")

    renderer_name, rendered_files, render_warnings = render_slide_previews(pptx_path, session_dir, len(slides))
    warnings.extend(render_warnings)

    if rendered_files:
        for slide, preview_file in zip(slides, rendered_files, strict=False):
            slide["preview_url"] = session_url(session_id, preview_file.relative_to(session_dir))
            slide["preview_kind"] = "rendered"
            slide["_preview_file"] = str(preview_file)
    else:
        renderer_name = "svg-fallback"
        for slide in slides:
            svg_file = write_svg_preview(session_id, session_dir, slide)
            slide["preview_url"] = session_url(session_id, svg_file.relative_to(session_dir))
            slide["preview_kind"] = "structure"
            slide["_preview_file"] = str(svg_file)

    if enable_ocr:
        ocr = OcrEngine()
        warnings.extend(ocr.warnings)
        for slide in slides:
            ocr_source = Path(slide.get("_preview_file", ""))
            if slide.get("preview_kind") != "rendered":
                media_file = slide.get("_media_file")
                ocr_source = Path(media_file) if media_file else Path()
            if ocr_source.exists():
                text, warning = ocr.read_image(ocr_source)
                slide["ocr_text"] = text
                if warning and ocr.enabled:
                    warnings.append(warning)
        ocr_name = ocr.name
    else:
        ocr_name = "disabled"

    for slide in slides:
        slide.pop("_preview_file", None)
        slide.pop("_media_file", None)

    return {
        "id": session_id,
        "original_name": original_name,
        "source_pptx": pptx_path.relative_to(session_dir).as_posix(),
        "slide_count": len(slides),
        "slides": slides,
        "renderer": renderer_name,
        "ocr": ocr_name,
        "warnings": warnings,
    }


def extract_slides(pptx_path: Path, session_id: str, session_dir: Path, warnings: list[str]) -> list[dict[str, Any]]:
    slides: list[dict[str, Any]] = []
    media_dir = session_dir / "media"
    media_dir.mkdir(exist_ok=True)

    try:
        archive = zipfile.ZipFile(pptx_path)
    except zipfile.BadZipFile as exc:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Uploaded file is not a valid PPTX package.") from exc

    with archive:
        try:
            presentation_xml = archive.read("ppt/presentation.xml")
            presentation_rels = parse_relationships(archive, "ppt/_rels/presentation.xml.rels")
        except KeyError as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, "PPTX is missing presentation metadata.") from exc

        root = ET.fromstring(presentation_xml)
        slide_id_list = root.find(f".//{{{P_NS}}}sldIdLst")
        if slide_id_list is None:
            return []

        for index, sld_id in enumerate(list(slide_id_list), start=1):
            rel_id = sld_id.get(f"{{{R_NS}}}id")
            slide_id_attr = sld_id.get("id") or str(index)
            if not rel_id or rel_id not in presentation_rels:
                warnings.append(f"Slide {index} has no presentation relationship.")
                continue

            slide_path = resolve_package_target("ppt/presentation.xml", presentation_rels[rel_id].target)
            try:
                slide_root = ET.fromstring(archive.read(slide_path))
            except KeyError:
                warnings.append(f"Slide file is missing: {slide_path}")
                continue

            texts = extract_text_lines(slide_root)
            title = extract_title(slide_root, texts) or f"Slide {index}"
            body_text = "\n".join(texts)
            media_file, media_url = copy_primary_media(archive, slide_path, media_dir, session_id, slide_id_attr)

            slides.append(
                {
                    "uid": f"slide-{slide_id_attr}",
                    "number": index,
                    "slide_id": slide_id_attr,
                    "rel_id": rel_id,
                    "source_path": slide_path,
                    "title": title,
                    "text": body_text,
                    "snippet": make_snippet(texts),
                    "ocr_text": "",
                    "media_url": media_url,
                    "_media_file": str(media_file) if media_file else "",
                }
            )

    return slides


def render_slide_previews(pptx_path: Path, session_dir: Path, slide_count: int) -> tuple[str, list[Path], list[str]]:
    warnings: list[str] = []
    preview_dir = session_dir / "previews"
    preview_dir.mkdir(exist_ok=True)

    renderer, files, render_warnings = render_with_libreoffice_pdf(pptx_path, preview_dir, slide_count)
    warnings.extend(render_warnings)
    if files:
        return renderer, files, warnings

    renderer, files, render_warnings = render_with_powerpoint(pptx_path, preview_dir, slide_count)
    warnings.extend(render_warnings)
    if files:
        return renderer, files, warnings

    return "svg-fallback", [], warnings


def render_with_libreoffice_pdf(pptx_path: Path, preview_dir: Path, slide_count: int) -> tuple[str, list[Path], list[str]]:
    executable = shutil.which("soffice") or shutil.which("libreoffice")
    if not executable:
        return "libreoffice-pdf", [], ["LibreOffice was not found; using generated slide previews."]

    try:
        import fitz  # type: ignore
    except Exception as exc:
        return "libreoffice-pdf", [], [f"PyMuPDF was not found; using generated slide previews. ({exc})"]

    warnings: list[str] = []
    with tempfile.TemporaryDirectory(prefix="ppt_node_render_") as temp_name:
        temp_dir = Path(temp_name)
        command = [
            executable,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp_dir),
            str(pptx_path),
        ]
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
        if completed.returncode != 0:
            message = completed.stderr.strip() or completed.stdout.strip()
            return "libreoffice-pdf", [], [f"LibreOffice render failed: {message}"]

        pdf_candidates = list(temp_dir.glob("*.pdf"))
        if not pdf_candidates:
            return "libreoffice-pdf", [], ["LibreOffice did not create a PDF preview."]

        files: list[Path] = []
        document = fitz.open(str(pdf_candidates[0]))
        try:
            for index, page in enumerate(document, start=1):
                if index > slide_count:
                    break
                pixmap = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
                output = preview_dir / f"rendered_{index:03d}.png"
                pixmap.save(str(output))
                files.append(output)
        finally:
            document.close()

    if len(files) != slide_count:
        warnings.append(f"Rendered {len(files)} of {slide_count} slides; using generated previews instead.")
        for file_path in files:
            file_path.unlink(missing_ok=True)
        return "libreoffice-pdf", [], warnings

    return "libreoffice-pdf", files, warnings


def render_with_powerpoint(pptx_path: Path, preview_dir: Path, slide_count: int) -> tuple[str, list[Path], list[str]]:
    if os.name != "nt":
        return "powerpoint", [], []

    try:
        import win32com.client  # type: ignore
    except Exception:
        return "powerpoint", [], []

    app = None
    presentation = None
    try:
        app = win32com.client.Dispatch("PowerPoint.Application")
        app.DisplayAlerts = 0
        presentation = app.Presentations.Open(str(pptx_path.resolve()), WithWindow=False)
        files: list[Path] = []
        for index in range(1, min(slide_count, presentation.Slides.Count) + 1):
            output = preview_dir / f"rendered_{index:03d}.png"
            presentation.Slides(index).Export(str(output.resolve()), "PNG", 1280, 720)
            files.append(output)
        if len(files) == slide_count:
            return "powerpoint", files, []
        for file_path in files:
            file_path.unlink(missing_ok=True)
        return "powerpoint", [], [f"PowerPoint rendered {len(files)} of {slide_count} slides."]
    except Exception as exc:
        return "powerpoint", [], [f"PowerPoint render failed: {exc}"]
    finally:
        if presentation is not None:
            presentation.Close()
        if app is not None:
            app.Quit()


def write_svg_preview(session_id: str, session_dir: Path, slide: dict[str, Any]) -> Path:
    preview_dir = session_dir / "previews"
    preview_dir.mkdir(exist_ok=True)
    output = preview_dir / f"{slide['uid']}.svg"

    title_lines = wrap_text(slide["title"], 34, 2)
    snippet_lines = wrap_text(slide.get("snippet") or "No text found on this slide.", 45, 6)
    media_url = slide.get("media_url") or ""

    title_svg = "\n".join(
        f'<text x="72" y="{150 + i * 42}" class="title">{html.escape(line)}</text>'
        for i, line in enumerate(title_lines)
    )
    snippet_svg = "\n".join(
        f'<text x="76" y="{306 + i * 34}" class="body">{html.escape(line)}</text>'
        for i, line in enumerate(snippet_lines)
    )
    image_svg = ""
    if media_url:
        image_svg = (
            f'<image href="{html.escape(media_url)}" x="0" y="0" width="1280" height="720" '
            'preserveAspectRatio="xMidYMid slice" opacity="0.18"/>'
        )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <style>
    .title {{ font: 800 38px Arial, sans-serif; fill: #17212b; }}
    .body {{ font: 600 24px Arial, sans-serif; fill: #435160; }}
    .meta {{ font: 800 23px Arial, sans-serif; fill: #ffffff; }}
  </style>
  <rect width="1280" height="720" fill="#f8fafc"/>
  <rect x="34" y="34" width="1212" height="652" rx="34" fill="#ffffff" stroke="#17212b" stroke-width="8"/>
  <rect x="34" y="34" width="1212" height="112" rx="34" fill="#1e293b"/>
  <rect x="34" y="102" width="1212" height="44" fill="#1e293b"/>
  {image_svg}
  <circle cx="1118" cy="90" r="42" fill="#2f9e75"/>
  <text x="1118" y="99" text-anchor="middle" class="meta">{slide['number']}</text>
  {title_svg}
  <line x1="74" y1="246" x2="1198" y2="246" stroke="#cbd5e1" stroke-width="4"/>
  {snippet_svg}
  <rect x="76" y="584" width="360" height="42" rx="21" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="3"/>
  <text x="98" y="613" style="font: 800 20px Arial, sans-serif; fill: #64748b;">Generated preview</text>
</svg>"""
    output.write_text(svg, encoding="utf-8")
    return output


def reorder_pptx(source_pptx: Path, output_path: Path, order: list[str], slides: list[dict[str, Any]]) -> None:
    uid_to_slide_id = {slide["uid"]: slide["slide_id"] for slide in slides}
    wanted_slide_ids = [uid_to_slide_id[uid] for uid in order]

    with zipfile.ZipFile(source_pptx, "r") as source, zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target:
        presentation_root = ET.fromstring(source.read("ppt/presentation.xml"))
        slide_id_list = presentation_root.find(f".//{{{P_NS}}}sldIdLst")
        if slide_id_list is None:
            raise ApiError(HTTPStatus.BAD_REQUEST, "PPTX has no slide list to reorder.")

        children = list(slide_id_list)
        by_slide_id = {child.get("id"): child for child in children}
        missing = [slide_id for slide_id in wanted_slide_ids if slide_id not in by_slide_id]
        if missing:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Cannot find slide ids in PPTX: {', '.join(missing)}")

        for child in children:
            slide_id_list.remove(child)
        for slide_id in wanted_slide_ids:
            slide_id_list.append(by_slide_id[slide_id])

        presentation_xml = ET.tostring(presentation_root, encoding="utf-8", xml_declaration=True)
        for item in source.infolist():
            if item.filename == "ppt/presentation.xml":
                target.writestr(item, presentation_xml)
            else:
                target.writestr(item, source.read(item.filename))


def convert_legacy_ppt(source_path: Path, session_dir: Path) -> tuple[Path, list[str]]:
    executable = shutil.which("soffice") or shutil.which("libreoffice")
    if not executable:
        raise ApiError(HTTPStatus.BAD_REQUEST, ".ppt upload requires LibreOffice to convert it to .pptx.")

    converted_dir = session_dir / "converted"
    converted_dir.mkdir(exist_ok=True)
    command = [
        executable,
        "--headless",
        "--convert-to",
        "pptx",
        "--outdir",
        str(converted_dir),
        str(source_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip()
        raise ApiError(HTTPStatus.BAD_REQUEST, f"LibreOffice conversion failed: {message}")

    candidates = list(converted_dir.glob("*.pptx"))
    if not candidates:
        raise ApiError(HTTPStatus.BAD_REQUEST, "LibreOffice did not create a .pptx file.")
    return candidates[0], ["Converted .ppt to .pptx with LibreOffice."]


def parse_relationships(archive: zipfile.ZipFile, rels_path: str) -> dict[str, Relationship]:
    try:
        root = ET.fromstring(archive.read(rels_path))
    except KeyError:
        return {}

    relationships: dict[str, Relationship] = {}
    for rel in root.findall(f"{{{REL_NS}}}Relationship"):
        rel_id = rel.get("Id")
        rel_type = rel.get("Type")
        target = rel.get("Target")
        if not rel_id or not rel_type or not target:
            continue
        relationships[rel_id] = Relationship(rel_id, rel_type, target, rel.get("TargetMode"))
    return relationships


def resolve_package_target(source_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def slide_rels_path(slide_path: str) -> str:
    return posixpath.join(posixpath.dirname(slide_path), "_rels", posixpath.basename(slide_path) + ".rels")


def extract_text_lines(root: ET.Element) -> list[str]:
    lines: list[str] = []
    seen: set[str] = set()
    for node in root.iter(f"{{{A_NS}}}t"):
        text = " ".join((node.text or "").split())
        if text and text not in seen:
            lines.append(text)
            seen.add(text)
    return lines


def extract_title(root: ET.Element, texts: list[str]) -> str:
    for shape in root.findall(f".//{{{P_NS}}}sp"):
        ph = shape.find(f".//{{{P_NS}}}ph")
        if ph is None:
            continue
        ph_type = ph.get("type")
        if ph_type in {"title", "ctrTitle", "subTitle"}:
            title = " ".join(extract_text_lines(shape)).strip()
            if title:
                return title[:120]
    return texts[0][:120] if texts else ""


def make_snippet(texts: list[str]) -> str:
    if not texts:
        return ""
    snippet = " / ".join(texts[:8])
    return snippet[:420]


def copy_primary_media(
    archive: zipfile.ZipFile,
    slide_path: str,
    media_dir: Path,
    session_id: str,
    slide_id: str,
) -> tuple[Path | None, str]:
    rels = parse_relationships(archive, slide_rels_path(slide_path))
    candidates: list[tuple[int, str]] = []
    for rel in rels.values():
        if rel.target_mode == "External" or rel.rel_type != IMAGE_REL:
            continue
        package_path = resolve_package_target(slide_path, rel.target)
        try:
            size = archive.getinfo(package_path).file_size
        except KeyError:
            continue
        candidates.append((size, package_path))

    if not candidates:
        return None, ""

    _, package_path = max(candidates, key=lambda item: item[0])
    suffix = Path(package_path).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}:
        suffix = ".bin"
    filename = f"slide_{safe_asset_token(slide_id)}{suffix}"
    output = media_dir / filename
    output.write_bytes(archive.read(package_path))
    return output, session_url(session_id, output.relative_to(media_dir.parent))


def parse_multipart_file(body: bytes, content_type: str) -> dict[str, Any]:
    if "multipart/form-data" not in content_type:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Upload must use multipart/form-data.")

    raw = (
        f"Content-Type: {content_type}\r\n"
        "MIME-Version: 1.0\r\n"
        "\r\n"
    ).encode("utf-8") + body
    message = BytesParser(policy=default).parsebytes(raw)

    for part in message.iter_parts():
        filename = part.get_filename()
        field_name = part.get_param("name", header="content-disposition")
        if filename and field_name in {"file", "ppt", "presentation"}:
            content = part.get_payload(decode=True)
            if not content:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Uploaded file is empty.")
            return {"filename": filename, "content": content}

    raise ApiError(HTTPStatus.BAD_REQUEST, "No PPT file was found in the upload.")


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = parse_content_length(handler.headers.get("Content-Length"))
    if length <= 0:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Missing JSON body.")
    body = handler.rfile.read(length)
    try:
        data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid JSON body.") from exc
    if not isinstance(data, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "JSON body must be an object.")
    return data


def parse_content_length(value: str | None) -> int:
    try:
        return int(value or "0")
    except ValueError:
        return 0


def safe_join(base: Path, relative: str) -> Path:
    candidate = (base / relative).resolve()
    base = base.resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise ApiError(HTTPStatus.FORBIDDEN, "Invalid file path.") from exc
    return candidate


def sanitize_filename(name: str) -> str:
    name = Path(name).name.strip() or "presentation.pptx"
    return re.sub(r"[^A-Za-z0-9._() -]+", "_", name)


def safe_asset_token(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value)


def session_url(session_id: str, relative: Path) -> str:
    return f"/sessions/{session_id}/{urllib.parse.quote(relative.as_posix())}"


def wrap_text(text: str, limit: int, max_lines: int) -> list[str]:
    words = text.replace("\n", " ").split()
    if not words:
        return []

    lines: list[str] = []
    current = ""
    for word in words:
        if not current:
            current = word
            continue
        if len(current) + len(word) + 1 <= limit:
            current += " " + word
        else:
            lines.append(current)
            current = word
            if len(lines) >= max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)

    if len(lines) == max_lines and len(" ".join(words)) > len(" ".join(lines)):
        lines[-1] = lines[-1].rstrip(".") + "..."
    return lines


if __name__ == "__main__":
    raise SystemExit(main())
