export const youtubeUrlSchema = z.string().trim().min(1).max(2048).url().refine((value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return false;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|::1|metadata\.google)/i.test(url.hostname)) {
      return false;
    }
    if (!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(url.hostname)) return false;
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0] || '';
      return /^[A-Za-z0-9_-]{6,20}$/.test(id);
    }
    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v') || '';
      return Boolean(videoId) && /^[A-Za-z0-9_-]{6,20}$/.test(videoId) && !url.searchParams.has('list');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (['shorts','embed','live'].includes(parts[0] || '')) {
      const videoId = parts[1] || '';
      return /^[A-Za-z0-9_-]{6,20}$/.test(videoId);
    }
    return false;
  } catch {
    return false;
  }
}, 'A valid YouTube URL is required');
