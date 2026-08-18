import { describe, expect, it } from 'vitest';
import { createRenderPlan } from './plan';

describe('createRenderPlan', () => {
  it('builds a 9:16 plan for valid ranges', () => {
    const plan = createRenderPlan('youtube', 10, 40);
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    expect(plan.aspectRatio).toBe('9:16');
    expect(plan.captions.enabled).toBe(true);
  });

  it('rejects invalid durations', () => {
    expect(() => createRenderPlan('tiktok', 0, 0.5)).toThrow();
    expect(() => createRenderPlan('reels', 0, 200)).toThrow();
  });
});
