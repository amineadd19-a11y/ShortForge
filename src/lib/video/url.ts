import { z } from 'zod';

export const youtubeUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname);
  } catch {
    return false;
  }
}, 'A valid YouTube URL is required');

export function getYouTubeVideoId(input: string): string | null {
  const parsed = youtubeUrlSchema.safeParse(input.trim());
  if (!parsed.success) return null;
  const url = new URL(parsed.data);
  if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const parts = url.pathname.split('/').filter(Boolean);
  if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) return parts[1] ?? null;
  return null;
}
