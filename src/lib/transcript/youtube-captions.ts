import type { TranscriptSegment } from '@/lib/analysis/types';

/**
 * Fetch official YouTube timedtext captions when the uploader enabled them.
 * This uses the public timedtext endpoint — never invents text.
 */
export async function fetchYouTubeCaptions(videoId: string): Promise<TranscriptSegment[]> {
  const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
  const headers = {
    'user-agent':
      'Mozilla/5.0 (compatible; ShortForge/0.3; +https://github.com/amineadd19-a11y/ShortForge)',
    accept: 'application/xml,text/xml,*/*',
  };
  const listRes = await fetch(listUrl, { cache: 'no-store', headers });
  if (!listRes.ok) return [];

  const listXml = await listRes.text();
  const tracks = [...listXml.matchAll(/<track[^>]*lang_code="([^"]+)"[^>]*(?:name="([^"]*)")?/g)].map((m) => ({
    lang: m[1],
    name: m[2] || '',
  }));

  if (!tracks.length) return [];

  const preferred =
    tracks.find((t) => t.lang === 'en') ||
    tracks.find((t) => t.lang.startsWith('en')) ||
    tracks.find((t) => t.lang === 'fr') ||
    tracks.find((t) => t.lang === 'ar') ||
    tracks[0];

  const captionUrl = new URL('https://www.youtube.com/api/timedtext');
  captionUrl.searchParams.set('v', videoId);
  captionUrl.searchParams.set('lang', preferred.lang);
  captionUrl.searchParams.set('fmt', 'srv3');
  if (preferred.name) captionUrl.searchParams.set('name', preferred.name);

  const captionRes = await fetch(captionUrl.toString(), { cache: 'no-store', headers });
  if (!captionRes.ok) return [];
  const xml = await captionRes.text();
  return parseSrv3(xml);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSrv3(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const pTags = [...xml.matchAll(/<p[^>]*t="(\d+)"[^>]*(?:d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g)];

  for (const match of pTags) {
    const startMs = Number(match[1]);
    const durationMs = Number(match[2] || 2000);
    const inner = match[3]
      .replace(/<s[^>]*>/g, '')
      .replace(/<\/s>/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    const text = decodeEntities(inner);
    if (!text) continue;
    segments.push({
      start: startMs / 1000,
      end: (startMs + Math.max(durationMs, 400)) / 1000,
      text,
    });
  }

  if (!segments.length) {
    for (const match of xml.matchAll(/<text start="([\d.]+)"[^>]*dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) {
      const text = decodeEntities(match[3]);
      if (!text) continue;
      const start = Number(match[1]);
      const dur = Number(match[2]);
      segments.push({ start, end: start + Math.max(dur, 0.4), text });
    }
  }

  return mergeCloseSegments(segments);
}

function mergeCloseSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (!segments.length) return [];
  const out: TranscriptSegment[] = [];
  let current = { ...segments[0] };
  for (let i = 1; i < segments.length; i += 1) {
    const next = segments[i];
    if (next.start - current.end < 0.35 && current.text.length < 140) {
      current = {
        start: current.start,
        end: next.end,
        text: `${current.text} ${next.text}`.replace(/\s+/g, ' ').trim(),
      };
    } else {
      out.push(current);
      current = { ...next };
    }
  }
  out.push(current);
  return out;
}
