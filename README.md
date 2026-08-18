# ShortForge AI

AI-powered long-form video → short-form content studio.

## Product

ShortForge turns an **authorized** YouTube video into a research-driven short-form workflow:

**URL → metadata → transcript → candidate moments → retention scoring → platform variants → render/export**

Targets: **YouTube Shorts**, **TikTok**, **Instagram Reels**.

Scores are **optimization signals**, not guarantees of reach.

## What works today

| Capability | Status |
|------------|--------|
| YouTube URL validation | ✅ |
| oEmbed metadata + thumbnail | ✅ |
| Official YouTube timedtext captions | ✅ (when uploader enabled captions) |
| External transcript provider hook | ✅ `TRANSCRIPT_PROVIDER` |
| Heuristic moment detection | ✅ |
| Platform-weighted scoring | ✅ Shorts / TikTok / Reels |
| Auto-Short plan + render job API | ✅ (needs `RENDER_WORKER_URL`) |
| Docker media worker | ✅ under `/worker` |

## Principles

- Never fabricate transcript facts, timestamps, references or analytics.
- The user must have rights or permission to process/reuse source content.
- Platform recommendations are heuristics, not guarantees.
- Keep provider integrations replaceable.
- Keep media processing isolated from the web application.

## Architecture

- **App:** Next.js App Router + TypeScript + Tailwind + Zod
- **Analysis:** deterministic clip windows + platform weight matrix
- **Transcript:** external provider **or** official YouTube captions
- **Render:** separate worker (`RENDER_WORKER_URL`) with FFmpeg pipeline

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Quality gate:

```bash
npm run quality-gate
```

## Environment

```text
# Optional external transcript API
TRANSCRIPT_PROVIDER=
TRANSCRIPT_API_KEY=

# Required for actual media rendering
RENDER_WORKER_URL=
RENDER_WORKER_TOKEN=

# Optional future AI enrichment
AI_PROVIDER=
AI_API_KEY=
```

Never expose secrets with `NEXT_PUBLIC_`.

## API

- `POST /api/analyze` — `{ url, platform }` → clips + scores
- `POST /api/auto-short` — plan best clip + packaging
- `POST /api/auto-short/render` — plan + submit render job
- `POST /api/render` — submit clip render job
- `GET /api/render/status/[jobId]` — job status
- `GET /api/health` — health check
