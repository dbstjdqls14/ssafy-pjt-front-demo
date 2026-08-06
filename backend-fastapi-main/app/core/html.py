import html

from fastapi.responses import HTMLResponse


def render_page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <style>
    body {{
      max-width: 860px;
      margin: 40px auto;
      padding: 0 20px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
      color: #111827;
    }}
    a {{ color: #2563eb; }}
    .card {{
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }}
    input, button, select {{
      font: inherit;
    }}
    input[type=file] {{
      display: block;
      margin: 16px 0;
    }}
    button {{
      padding: 10px 16px;
      border: 0;
      border-radius: 10px;
      background: #111827;
      color: white;
      cursor: pointer;
    }}
    pre {{
      white-space: pre-wrap;
      word-break: break-word;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 16px;
    }}
    .muted {{ color: #6b7280; }}
  </style>
</head>
<body>
{body}
</body>
</html>"""
    )
