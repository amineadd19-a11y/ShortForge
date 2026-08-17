FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs npm ca-certificates libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*
RUN python -m pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir yt-dlp openai-whisper opencv-python-headless
COPY worker/package.json ./package.json
RUN npm install --omit=dev
COPY worker/*.mjs ./
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.mjs"]
