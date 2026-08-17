import type { Platform } from '@/lib/ai/scoring';

export type RenderPlan = {
  aspectRatio: '9:16';
  width: 1080;
  height: 1920;
  platform: Platform;
  start: number;
  end: number;
  maxDurationSeconds: number;
  captions: { enabled: true; style: 'word-highlight'; safeZone: 'platform-aware' };
  crop: 'smart-speaker';
};

export function createRenderPlan(platform: Platform, startSeconds: number, endSeconds: number): RenderPlan {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) throw new Error('Invalid clip range.');
  const start = Math.max(0, startSeconds);
  const end = Math.max(start, endSeconds);
  const duration = end - start;
  if (duration < 1 || duration > 180) throw new Error('Clip duration must be between 1 and 180 seconds.');
  return {
    aspectRatio: '9:16', width: 1080, height: 1920, platform,
    start, end, maxDurationSeconds: duration,
    captions: { enabled: true, style: 'word-highlight', safeZone: 'platform-aware' },
    crop: 'smart-speaker',
  };
}
