# ShortForge AI

Long-form YouTube → short-form **Shorts / TikTok / Reels** studio.

```text
URL → metadata → transcript → clip analysis → export package → render worker → MP4 download
```

Version **0.4.0**

## Architecture

| Component | Role |
|-----------|------|
| **Vercel (Next.js)** | UI, analysis APIs, job orchestration |
| **Transcript** | Official YouTube captions **or** `TRANSCRIPT_PROVIDER` |
| **Analysis** | Deterministic ranking + optional AI packaging hints |
| **Docker worker** | yt-dlp + FFmpeg + captions + S3 upload |
| **Object storage** | Signed MP4 download URLs |

FFmpeg does **not** run on Vercel serverless. Rendering is always the separate worker.

## What works without secrets

- URL validation, metadata, thumbnail
- YouTube captions when the server network can reach them
- Clip ranking + score reasons + export package
- Honest `needs_transcript` / `503 worker not configured` states

## End-to-end render requirements

### App (Vercel env)

```text
RENDER_WORKER_URL=https://your-worker.example
RENDER_WORKER_TOKEN=long-random-secret
TRANSCRIPT_PROVIDER=https://your-transcript-api.example   # recommended on Vercel
TRANSCRIPT_API_KEY=
```

### Worker (Docker host)

```text
RENDER_WORKER_TOKEN=same-as-app
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=
S3_ENDPOINT=          # optional (R2 / MinIO)
```

```bash
cd worker
cp .env.example .env
docker compose up --build
```

## Local app development

```bash
npm install
cp .env.example .env.local
npm run dev
npm run quality-gate
```

## API

- `POST /api/analyze`
- `POST /api/auto-short`
- `POST /api/auto-short/render`
- `POST /api/render`
- `GET /api/render/status/[jobId]`
- `GET /api/health`

## Security

- YouTube host allowlist only
- Transcript provider HTTPS + private-IP block (SSRF)
- Worker Bearer auth
- Spawn args only (no shell) for yt-dlp / FFmpeg
- Signed storage URLs; no browser secrets

## Rights

You must have rights to process and reuse the source video.

Scores and packaging are **optimization helpers**, not reach guarantees.
