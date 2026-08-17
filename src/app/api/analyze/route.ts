import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAnalysis } from '@/lib/analysis/engine';
import { getTranscript } from '@/lib/transcript/provider';
import { getYouTubeMetadata } from '@/lib/video/metadata';
import { getYouTubeVideoId } from '@/lib/video/url';

const requestSchema = z.object({
  url: z.string().url(),
  platform: z.enum(['youtube', 'tiktok', 'reels']).default('youtube'),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'A valid YouTube URL is required.' }, { status: 400 });

    const videoId = getYouTubeVideoId(parsed.data.url);
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });

    const source = await getYouTubeMetadata(videoId, parsed.data.url);
    const transcript = await getTranscript(videoId);
    const result = buildAnalysis(source, transcript.segments, parsed.data.platform);

    return NextResponse.json({
      status: transcript.status === 'ready' ? 'complete' : 'needs_transcript_provider',
      ...result,
      transcript: { ...result.transcript, message: transcript.message },
      pipeline: ['source validation', 'metadata enrichment', 'transcript acquisition', 'moment detection', 'platform scoring', 'render planning'],
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Unable to analyze this video right now.' }, { status: 500 });
  }
}
