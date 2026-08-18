# ShortForge Render Worker

Separate Docker service for real FFmpeg rendering.

## Pipeline

1. Authenticated job intake (`Bearer RENDER_WORKER_TOKEN`)
2. Download source with **yt-dlp** (YouTube HTTPS only)
3. Optional Whisper transcription for captions
4. Vertical 9:16 crop / scale to **1080×1920**
5. ASS captions (timed words only — never invented)
6. Upload MP4 to S3-compatible storage
7. Return **signed** download URL (1h)

## Lifecycle

`queued` → `processing` → `completed` | `failed`

Progress is reported as 0–100 when available.

## Run

```bash
cp .env.example .env
# set RENDER_WORKER_TOKEN, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
docker compose up --build
```

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/healthz` | no |
| GET | `/readyz` | no |
| POST | `/jobs` | Bearer |
| GET | `/jobs/:id` | Bearer |

## Required env

- `RENDER_WORKER_TOKEN`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION` (optional)
- `S3_ENDPOINT` (optional, for R2/MinIO)
