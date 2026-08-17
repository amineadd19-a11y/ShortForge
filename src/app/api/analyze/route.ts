import { NextResponse } from 'next/server';
import { getYouTubeVideoId } from '@/lib/video/url';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== 'string') return NextResponse.json({ error: 'A YouTube URL is required.' }, { status: 400 });
    const videoId = getYouTubeVideoId(body.url);
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });

    return NextResponse.json({
      status: 'accepted',
      videoId,
      pipeline: ['source validation', 'transcript acquisition', 'moment detection', 'platform scoring', 'render planning'],
      message: 'Analysis job accepted. Connect a server-side transcript/AI provider and media worker to execute the pipeline.',
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
