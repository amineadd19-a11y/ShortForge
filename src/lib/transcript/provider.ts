import type { TranscriptSegment } from '@/lib/analysis/types';

export type TranscriptResult = {
  status: 'ready' | 'unavailable';
  segments: TranscriptSegment[];
  message?: string;
};

/**
 * ShortForge never scrapes or fabricates transcript text in the web layer.
 * A server-side provider can be connected through TRANSCRIPT_PROVIDER.
 * The provider contract is intentionally tiny so it can be replaced later.
 */
export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  const providerUrl = process.env.TRANSCRIPT_PROVIDER?.trim();
  if (!providerUrl) {
    return {
      status: 'unavailable',
      segments: [],
      message: 'Transcript provider is not configured. Connect a server-side transcript provider to analyze spoken content.',
    };
  }

  try {
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.TRANSCRIPT_API_KEY ? { authorization: `Bearer ${process.env.TRANSCRIPT_API_KEY}` } : {}),
      },
      body: JSON.stringify({ videoId }),
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`Transcript provider returned ${response.status}`);
    const data = await response.json() as { segments?: unknown };
    if (!Array.isArray(data.segments)) throw new Error('Transcript provider returned an invalid response.');

    const segments = data.segments.filter((item): item is TranscriptSegment => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return typeof value.start === 'number' && typeof value.end === 'number' && typeof value.text === 'string' && value.text.trim().length > 0;
    });

    return segments.length
      ? { status: 'ready', segments }
      : { status: 'unavailable', segments: [], message: 'The transcript provider returned no usable segments.' };
  } catch (error) {
    return { status: 'unavailable', segments: [], message: error instanceof Error ? error.message : 'Transcript acquisition failed.' };
  }
}
