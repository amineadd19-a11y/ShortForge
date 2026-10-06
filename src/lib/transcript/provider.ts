import type { TranscriptSegment } from '@/lib/analysis/types';
import { fetchYouTubeCaptions } from './youtube-captions';

export type TranscriptUnavailableReason =
  | 'invalid_video_id'
  | 'not_configured'
  | 'invalid_provider_config'
  | 'provider_failed'
  | 'malformed_provider_response'
  | 'no_segments'
  | 'youtube_unavailable';

export type TranscriptResult = {
  status: 'ready' | 'unavailable';
  segments: TranscriptSegment[];
  reason?: TranscriptUnavailableReason;
  message?: string;
  provider?: 'external' | 'youtube-timedtext' | 'youtube-player';
};

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|::1|metadata\.google)/i;

/**
 * Transcript acquisition order:
 * 1. External TRANSCRIPT_PROVIDER (HTTPS only, SSRF-hardened)
 * 2. Official YouTube captions (timedtext + player tracks)
 *
 * Never fabricates transcript text.
 */
export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return { status: 'unavailable', segments: [], reason: 'invalid_video_id', message: 'Invalid video id.' };
  }

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
    reason: external.reason || 'youtube_unavailable',
    message:
      external.message ||
      'No captions are available for this video. Enable YouTube captions or connect TRANSCRIPT_PROVIDER.',
  };
}

function isSafeProviderUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    if (PRIVATE_HOST.test(url.hostname)) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeSegments(raw: unknown[]): TranscriptSegment[] {
  return raw.filter((item): item is TranscriptSegment => {
    if (!item || typeof item !== 'object') return false;
    const value = item as Record<string, unknown>;
    return (
      typeof value.start === 'number' &&
      Number.isFinite(value.start) &&
      typeof value.end === 'number' &&
      Number.isFinite(value.end) &&
      value.end > value.start &&
      typeof value.text === 'string' &&
      value.text.trim().length > 0 &&
      value.text.length < 2000
    );
  });
}

async function tryExternalProvider(videoId: string): Promise<TranscriptResult> {
  const providerUrl = process.env.TRANSCRIPT_PROVIDER?.trim();
  if (!providerUrl) {
    return { status: 'unavailable', segments: [], reason: 'not_configured' };
  }

  if (!isSafeProviderUrl(providerUrl)) {
    return {
      status: 'unavailable',
      segments: [],
      reason: 'invalid_provider_config',
      message: 'TRANSCRIPT_PROVIDER must be a public HTTPS URL.',
    };
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
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        status: 'unavailable',
        segments: [],
        reason: 'provider_failed',
        message: `Transcript provider returned ${response.status}.`,
      };
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 1_000_000) {
      return {
        status: 'unavailable',
        segments: [],
        reason: 'malformed_provider_response',
        message: 'Transcript provider response is too large.',
      };
    }
    const raw = await response.text();
    if (raw.length > 1_000_000) {
      return {
        status: 'unavailable',
        segments: [],
        reason: 'malformed_provider_response',
        message: 'Transcript provider response is too large.',
      };
    }
    let data: { segments?: unknown };
    try {
      data = JSON.parse(raw) as { segments?: unknown };
    } catch {
      return {
        status: 'unavailable',
        segments: [],
        reason: 'malformed_provider_response',
        message: 'Transcript provider returned malformed JSON.',
      };
    }
    if (!Array.isArray(data.segments)) {
      return {
        status: 'unavailable',
        segments: [],
        reason: 'malformed_provider_response',
        message: 'Transcript provider returned an invalid response.',
      };
    }

    const segments = normalizeSegments(data.segments).slice(0, 5000);

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
      reason: 'provider_failed',
      message: error instanceof Error ? error.message : 'Transcript acquisition failed.',
    };
  }
}
