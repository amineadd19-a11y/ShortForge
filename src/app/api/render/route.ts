import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getYouTubeVideoId } from '@/lib/video/url';
import { createRenderPlan } from '@/lib/render/plan';
import { createRenderWorker } from '@/lib/render/worker';

const schema = z.object({
  url: z.string().url().max(500),
  start: z.number().finite().min(0).max(86_400),
  end: z.number().finite().min(0).max(86_400),
  platform: z.enum(['youtube', 'tiktok', 'reels']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid render request.' }, { status: 400 });
    }

    const videoId = getYouTubeVideoId(parsed.data.url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
    }

    if (parsed.data.end <= parsed.data.start) {
      return NextResponse.json({ error: 'Clip end must be after start.' }, { status: 400 });
    }

    const plan = createRenderPlan(parsed.data.platform, parsed.data.start, parsed.data.end);
    const worker = createRenderWorker();
    const job = await worker.submit({
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      plan,
    });

    return NextResponse.json({ ...job, videoId, plan }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render request failed.';
    const status =
      message.includes('not configured') || message.includes('Unauthorized') ? 503 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
