import type { TranscriptSegment } from '@/lib/analysis/types';
import { fetchYouTubeCaptions } from './youtube-captions';

export type TranscriptResult = {
  status: 'ready' | 'unavailable';
  segments: TranscriptSegment[];
  message?: string;
  provider?: 'external' | 'youtube-timedtext';
};

/**
 * Transcript acquisition order:
 * 1. External TRANSCRIPT_PROVIDER (if configured)
 * 2. Official YouTube timedtext captions (when the uploader enabled them)
 *
 * Never fabricates transcript text.
 */
export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  const external = await tryExternalProvider(videoId);
  if (external.status === 'ready') return external;

  try {
    const segments = await fetchYouTubeCaptions(videoId);
    if (segments.length) {
      return {
        status: 'ready',
        segments,
        provider: 'youtube-timedtext',
        message: 'Using official YouTube captions published for this video.',
      };
    }
  } catch {
    // fall through
  }

  return {
    status: 'unavailable',
    segments: [],
    message:
      external.message ||
      'No captions are available for this video. Enable YouTube captions or connect TRANSCRIPT_PROVIDER.',
  };
}

async function tryExternalProvider(videoId: string): Promise<TranscriptResult> {
  const providerUrl = process.env.TRANSCRIPT_PROVIDER?.trim();
  if (!providerUrl) {
    return { status: 'unavailable', segments: [] };
  }

  try {
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.TRANSCRIPT_API_KEY
          ? { authorization: `Bearer ${process.env.TRANSCRIPT_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ videoId }),
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`Transcript provider returned ${response.status}`);
    const data = (await response.json()) as { segments?: unknown };
    if (!Array.isArray(data.segments)) throw new Error('Transcript provider returned an invalid response.');

    const segments = data.segments.filter((item): item is TranscriptSegment => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return (
        typeof value.start === 'number' &&
        typeof value.end === 'number' &&
        typeof value.text === 'string' &&
        value.text.trim().length > 0
      );
    });

    return segments.length
      ? { status: 'ready', segments, provider: 'external' }
      : {
          status: 'unavailable',
          segments: [],
          message: 'The transcript provider returned no usable segments.',
        };
  } catch (error) {
    return {
      status: 'unavailable',
      segments: [],
      message: error instanceof Error ? error.message : 'Transcript acquisition failed.',
    };
  }
}
