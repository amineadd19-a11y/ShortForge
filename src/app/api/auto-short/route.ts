import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAnalysis } from '@/lib/analysis/engine';
import { getTranscript } from '@/lib/transcript/provider';
import { getYouTubeMetadata } from '@/lib/video/metadata';
import { getYouTubeVideoId } from '@/lib/video/url';

const schema = z.object({ url: z.string().url(), platform: z.enum(['youtube','tiktok','reels']).default('youtube') });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'A valid YouTube URL is required.' }, { status: 400 });
    const videoId = getYouTubeVideoId(parsed.data.url);
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
    const source = await getYouTubeMetadata(videoId, parsed.data.url);
    const transcript = await getTranscript(videoId);
    const analysis = buildAnalysis(source, transcript.segments, parsed.data.platform);
    const best = analysis.clips[0];
    if (!best) return NextResponse.json({ status: 'needs_transcript', message: 'A transcript is required before an automatic clip can be selected.' }, { status: 422 });
    return NextResponse.json({
      status: 'planned', platform: parsed.data.platform, source,
      selection: { clipId: best.id, start: best.start, end: best.end, title: best.title, viralScore: best.viralScore, scoresByPlatform: best.scoresByPlatform },
      renderPlan: { start: best.start, end: best.end, aspectRatio: '9:16', resolution: '1080x1920', captions: 'word-synced', reframe: 'speaker-aware', safeZone: parsed.data.platform === 'youtube' ? 'youtube-shorts' : parsed.data.platform === 'tiktok' ? 'tiktok' : 'instagram-reels' }
    });
  } catch { return NextResponse.json({ error: 'Unable to create an automatic short plan right now.' }, { status: 500 }); }
}
