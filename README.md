# ShortForge AI

Long-form YouTube → short-form **Shorts / TikTok / Reels** studio.

```text
URL → metadata → transcript → clip analysis → export package → render worker → MP4 download → TikTok Direct Post
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
| **TikTok Content Posting API** | OAuth connection, creator validation, consent-gated Direct Post |

FFmpeg does **not** run on Vercel serverless. Rendering is always the separate worker.

## TikTok publishing

ShortForge now includes server-side TikTok OAuth and Direct Post endpoints:

- `GET /api/tiktok/connect` — start TikTok OAuth
- `GET /api/tiktok/callback` — exchange the authorization code and securely store the token
- `GET /api/tiktok/creator` — fetch the latest creator profile and privacy options
- `POST /api/tiktok/publish` — publish a rendered HTTPS video with explicit user consent
- `POST /api/tiktok/status` — check asynchronous publish status

The integration uses TikTok's official Content Posting API. TikTok requires creator information to be queried before Direct Post, and the integration validates the selected privacy level against the creator's current options. citehttps://developers.tiktok.com/doc/content-posting-api-reference-direct-post

For `PULL_FROM_URL`, TikTok requires the video URL to be publicly accessible and its domain/URL prefix verified in the TikTok developer configuration. Unaudited clients are restricted to private viewing until TikTok audits the API client. citehttps://developers.tiktok.com/doc/content-posting-api-reference-direct-post

## TikTok configuration

Set these server-only environment variables:

```text
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://your-domain.example/api/tiktok/callback
TIKTOK_SCOPES=user.info.basic,video.publish
TIKTOK_COOKIE_SECRET=
```

Register the exact redirect URI in TikTok Login Kit and enable the Content Posting API + `video.publish` scope. TikTok's web Login Kit requires an HTTPS static redirect URI and server-side token handling. citehttps://developers.tiktok.com/docs/en/login-kit-overview

`TIKTOK_COOKIE_SECRET` must be a long random secret. Access and refresh tokens are encrypted into an HttpOnly, Secure cookie and are never exposed through `NEXT_PUBLIC_*` variables.

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
- `GET /api/tiktok/connect`
- `GET /api/tiktok/callback`
- `GET /api/tiktok/creator`
- `POST /api/tiktok/publish`
- `POST /api/tiktok/status`

## Security

- YouTube host allowlist only
- Transcript provider HTTPS + private-IP block (SSRF)
- Worker Bearer auth
- Spawn args only (no shell) for yt-dlp / FFmpeg
- Signed storage URLs; no browser secrets
- TikTok OAuth state protection
- TikTok tokens encrypted server-side
- TikTok publishing requires explicit consent

## Rights

You must have rights to process and reuse the source video.

Scores and packaging are **optimization helpers**, not reach guarantees.
