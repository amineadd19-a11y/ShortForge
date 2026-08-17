# ShortForge AI

AI-powered long-form video to short-form content studio.

## Product

ShortForge turns an authorized YouTube video into a research-driven short-form workflow:

**URL → analysis → transcript → candidate moments → retention scoring → platform variants → render/export**

The product is designed for YouTube Shorts, TikTok and Reels. It does not promise viral results; it optimizes for observable content signals and keeps predictions clearly labeled.

## Principles

- Never fabricate transcript facts, timestamps, references or analytics.
- The user must have rights or permission to process/reuse source content.
- Platform recommendations are heuristics, not guarantees.
- Keep provider integrations replaceable.
- Keep media processing isolated from the web application.

## Architecture

- Next.js App Router + TypeScript
- Tailwind CSS
- Zod validation
- Provider-agnostic analysis contracts
- Separate media/render pipeline boundary
- Shared scoring model for Shorts/TikTok/Reels

## Development

```bash
npm install
npm run dev
```

Quality gate:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment

Copy `.env.example` to `.env.local`. Provider keys are server-only and must never be exposed to the browser.
