import { NextResponse } from 'next/server';
import { getYouTubeVideoId } from '@/lib/video/url';
import { createRenderPlan } from '@/lib/render/plan';
import { createRenderWorker } from '@/lib/render/worker';
import type { Platform } from '@/lib/ai/scoring';

const platforms = new Set<Platform>(['youtube', 'tiktok', 'reels']);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown; start?: unknown; end?: unknown; platform?: unknown };
    if (typeof body.url !== 'string') return NextResponse.json({ error: 'A YouTube URL is required.' }, { status: 400 });
    const videoId = getYouTubeVideoId(body.url);
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
    if (typeof body.start !== 'number' || typeof body.end !== 'number') return NextResponse.json({ error: 'A valid clip range is required.' }, { status: 400 });
    if (typeof body.platform !== 'string' || !platforms.has(body.platform as Platform)) return NextResponse.json({ error: 'Unsupported platform.' }, { status: 400 });

    const plan = createRenderPlan(body.platform as Platform, body.end - body.start);
    const worker = createRenderWorker();
    const job = await worker.submit({ sourceUrl: `https://www.youtube.com/watch?v=${videoId}`, plan });
    return NextResponse.json({ ...job, videoId, plan }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render request failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
