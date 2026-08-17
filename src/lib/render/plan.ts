import type { Platform } from '@/lib/ai/scoring';

export type RenderPlan = {
  aspectRatio: '9:16';
  width: 1080;
  height: 1920;
  platform: Platform;
  maxDurationSeconds: number;
  captions: { enabled: true; style: 'word-highlight'; safeZone: 'platform-aware' };
  crop: 'smart-speaker';
};

export function createRenderPlan(platform: Platform, durationSeconds: number): RenderPlan {
  return {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    platform,
    maxDurationSeconds: Math.min(Math.max(Math.round(durationSeconds), 1), 180),
    captions: { enabled: true, style: 'word-highlight', safeZone: 'platform-aware' },
    crop: 'smart-speaker',
  };
}
