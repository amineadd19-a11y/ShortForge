import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getYouTubeVideoId } from '@/lib/video/url';
import { createRenderPlan } from '@/lib/render/plan';
import { createRenderWorker } from '@/lib/render/worker';

const schema = z.object({
  url: z.string().trim().max(2048),
  start: z.number().finite().min(0).max(180),
  end: z.number().finite().min(0).max(180),
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

    if (parsed.data.end - parsed.data.start > 180) {
      return NextResponse.json({ error: 'Clip duration cannot exceed 180 seconds.' }, { status: 400 });
    }

    const plan = createRenderPlan(parsed.data.platform, parsed.data.start, parsed.data.end);
    const idempotencyKey = createHash('sha256')
      .update(JSON.stringify({ videoId, platform: parsed.data.platform, start: plan.start, end: plan.end }))
      .digest('hex');

    const job = await createRenderWorker().submit({
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      plan,
      idempotencyKey,
    });

    return NextResponse.json({ ...job, videoId, plan }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: { code: 'RENDER_UNAVAILABLE', message: 'Rendering is temporarily unavailable.' } },
      { status: 503 },
    );
  }
}
