FROM nvidia/cuda:12.9.2-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

ENV HF_HOME=/workspace/cache/huggingface
ENV XDG_CACHE_HOME=/workspace/cache
ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

RUN rm -rf /var/lib/apt/lists/* \
    && apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends --fix-missing -o Acquire::Retries=5 \
        python3 \
        python3-pip \
        python3-venv \
        ffmpeg \
        curl \
    && python3 -m venv /opt/venv \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --timeout 120 --retries 10 --upgrade pip setuptools wheel \
    && pip install --timeout 120 --retries 10 -r requirements.txt

COPY . .

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
