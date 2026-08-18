import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAnalysis } from '@/lib/analysis/engine';
import { getTranscript } from '@/lib/transcript/provider';
import { getYouTubeMetadata } from '@/lib/video/metadata';
import { getYouTubeVideoId } from '@/lib/video/url';
import { createRenderPlan } from '@/lib/render/plan';
import { createRenderWorker } from '@/lib/render/worker';
import { buildExportPackage } from '@/lib/viral/package';

const schema = z.object({
  url: z.string().url().max(500),
  platform: z.enum(['youtube', 'tiktok', 'reels']).default('youtube'),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid YouTube URL is required.' }, { status: 400 });
    }

    const videoId = getYouTubeVideoId(parsed.data.url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
    }

    const source = await getYouTubeMetadata(videoId, parsed.data.url);
    const transcript = await getTranscript(videoId);
    const analysis = buildAnalysis(source, transcript.segments, parsed.data.platform);
    const best = analysis.clips[0];

    if (!best) {
      return NextResponse.json(
        {
          status: 'needs_transcript',
          message: 'A transcript is required before an automatic clip can be selected.',
        },
        { status: 422 },
      );
    }

    const plan = createRenderPlan(parsed.data.platform, best.start, best.end);
    const packaging = buildExportPackage({
      platform: parsed.data.platform,
      title: best.title,
      hook: best.hook,
      transcript: best.transcript,
      durationSeconds: best.end - best.start,
      score: best.viralScore,
      scoreExplanation: best.scoreReasons,
      sourceTitle: source.title,
      sourceCreator: source.author,
      sourceUrl: source.url,
    });

    const worker = createRenderWorker();
    const job = await worker.submit({
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      plan,
    });

    return NextResponse.json(
      {
        status: 'rendering',
        platform: parsed.data.platform,
        selection: best,
        packaging,
        plan,
        job,
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start automatic rendering.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
