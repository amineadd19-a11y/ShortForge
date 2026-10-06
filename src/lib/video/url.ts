import { z } from 'zod';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

export const youtubeUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      YOUTUBE_HOSTS.has(host)
    );
  } catch {
    return false;
  }
}, 'A valid YouTube HTTPS URL is required');

export function getYouTubeVideoId(input: string): string | null {
  const parsed = youtubeUrlSchema.safeParse(input);
  if (!parsed.success) return null;

  const url = new URL(parsed.data);
  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length === 1 && VIDEO_ID.test(parts[0]) ? parts[0] : null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;

  if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) {
    id = parts[1] ?? null;
  }

  if (!id || !VIDEO_ID.test(id)) return null;

  // A playlist URL without a concrete video is never accepted.
  if (!url.searchParams.has('v') && url.searchParams.has('list') && url.pathname === '/watch') {
    return null;
  }

  return id;
}
