# ShortForge AI

Production-oriented long-form → short-form video studio.

**URL → metadata → transcript → candidate moments → scoring → export package → render**

Targets: **YouTube Shorts**, **TikTok**, **Instagram Reels**.

Scores and packaging are **optimization helpers**, not guarantees of reach.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| Next.js app | UI, analysis APIs, render orchestration |
| Transcript | Official YouTube timedtext **or** `TRANSCRIPT_PROVIDER` |
| Analysis | Deterministic clip detection + platform-weighted scores |
| AI enrichment | Optional HTTPS provider (`AI_PROVIDER`) — never required |
| Render worker | Docker service: download, cut, 9:16, captions, upload |

Media processing stays **outside** the web app.

## What works without secrets

- YouTube URL validation
- oEmbed metadata + thumbnail
- Official captions when the uploader enabled them
- Clip ranking + score explanations
- Export package (title, alt title, description, CTA, hashtags, keywords)

## What requires environment variables

| Goal | Variables |
|------|-----------|
| Basic analysis (captions exist) | none |
| Custom transcript | `TRANSCRIPT_PROVIDER`, optional `TRANSCRIPT_API_KEY` |
| Real MP4 render | `RENDER_WORKER_URL`, `RENDER_WORKER_TOKEN` (+ worker storage) |
| Optional AI packaging hints | `AI_PROVIDER` (HTTPS), `AI_API_KEY` |

Never use `NEXT_PUBLIC_*` for secrets.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Quality gate:

```bash
npm run quality-gate
```

## Docker render worker

```bash
cd worker
cp .env.example .env
# set RENDER_WORKER_TOKEN, S3_BUCKET, S3 credentials
docker compose up --build
```

Worker endpoints:

- `GET /healthz`
- `GET /readyz`
- `POST /jobs` (Bearer token)
- `GET /jobs/:id` (Bearer token)

The worker:

1. Validates YouTube HTTPS URLs only
2. Downloads with yt-dlp
3. Cuts the requested range
4. Outputs **1080×1920** 9:16
5. Burns timed captions when transcript words exist
6. Uploads to object storage
7. Returns real status (`queued` / `processing` / `completed` / `failed`)

Failed jobs return structured errors — **no fake success**.

## API

- `POST /api/analyze`
- `POST /api/auto-short`
- `POST /api/auto-short/render`
- `POST /api/render`
- `GET /api/render/status/[jobId]`
- `GET /api/health`

## Security notes

- YouTube hostname allowlist only
- Worker bearer token required
- Request body size limits on the worker
- Duration caps (≤ 180s)
- Path-safe temp files under `WORK_DIR`
- No secrets in client bundles

## Rights

You must have rights or permission to process and reuse the source video.

## Version

`0.3.0`
