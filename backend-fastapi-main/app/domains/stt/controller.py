import asyncio
import html
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core.config import settings
from app.core.html import render_page
from app.domains.stt.service import transcribe_audio

router = APIRouter()


@router.get("/")
async def root():
    return RedirectResponse(url="/upload")


@router.get("/upload", response_class=HTMLResponse)
def upload_page() -> HTMLResponse:
    return render_page(
        "Aivo STT Upload",
        f"""
<h1>오디오 STT</h1>
<div class="card">
  <form action="/transcribe" method="post" enctype="multipart/form-data">
    <label for="audio">오디오 파일 업로드</label>
    <input id="audio" name="audio" type="file" accept="audio/*,video/*" required />
    <button type="submit">STT 실행</button>
  </form>
  <p class="muted">
    모델 기본값: <code>{html.escape(settings.whisper_model)}</code><br />
    모델 탐색/다운로드 위치: <code>{html.escape(str(settings.whisper_model_root))}</code><br />
    환경변수로 <code>WHISPER_MODEL</code>, <code>WHISPER_MODEL_PATH</code>,
    <code>WHISPER_DEVICE</code>, <code>WHISPER_COMPUTE_TYPE</code> 조정 가능
  </p>
</div>
""",
    )


@router.post("/transcribe", response_class=HTMLResponse)
async def transcribe_page(audio: UploadFile = File(...)) -> HTMLResponse:
    settings.upload_root.mkdir(parents=True, exist_ok=True)
    suffix = Path(audio.filename or "audio").suffix

    with tempfile.NamedTemporaryFile(
        prefix="upload-",
        suffix=suffix,
        dir=settings.upload_root,
        delete=False,
    ) as temp_file:
        temp_path = Path(temp_file.name)
        shutil.copyfileobj(audio.file, temp_file)

    try:
        result = await asyncio.to_thread(transcribe_audio, temp_path, audio.filename)
    except Exception as exception:
        return render_page(
            "STT Error",
            f"""
<h1>STT 실패</h1>
<div class="card">
  <p>처리 중 오류가 발생했습니다.</p>
  <pre>{html.escape(str(exception))}</pre>
  <p><a href="/upload">다시 업로드</a></p>
</div>
""",
        )
    finally:
        temp_path.unlink(missing_ok=True)
        await audio.close()

    segment_html = "\n".join(
        f"<li><code>{segment.start:.2f}s - {segment.end:.2f}s</code> "
        f"{html.escape(segment.text)}</li>"
        for segment in result.segments
    )

    return render_page(
        "STT Result",
        f"""
<h1>STT 결과</h1>
<div class="card">
  <p class="muted">STT 변환 시간: <strong>{result.details["transcribe_elapsed_seconds"]}초</strong></p>

  <h2>전체 텍스트</h2>
  <pre>{html.escape(result.text or "(전사된 텍스트 없음)")}</pre>

  <h2>세그먼트</h2>
  <ol>{segment_html}</ol>

  <h2>처리 정보</h2>
  <pre>{html.escape(format_details(result.details))}</pre>

  <p><a href="/upload">다른 파일 업로드</a></p>
</div>
""",
    )


def format_details(details: dict[str, object]) -> str:
    return "\n".join(f"{key}: {value}" for key, value in details.items())
