import type { VideoSource } from '@/lib/analysis/types';

export async function getYouTubeMetadata(videoId: string, originalUrl: string): Promise<VideoSource> {
  const fallback: VideoSource = { videoId, url: originalUrl, thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` };
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`, { next: { revalidate: 3600 } });
    if (!response.ok) return fallback;
    const data = await response.json() as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
    return {
      ...fallback,
      title: typeof data.title === 'string' ? data.title : undefined,
      author: typeof data.author_name === 'string' ? data.author_name : undefined,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : fallback.thumbnailUrl,
    };
  } catch {
    return fallback;
  }
}
