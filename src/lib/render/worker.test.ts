import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createRenderWorker, MissingRenderWorker } from './worker';

describe('createRenderWorker', () => {
  const prevUrl = process.env.RENDER_WORKER_URL;
  const prevToken = process.env.RENDER_WORKER_TOKEN;

  beforeEach(() => {
    delete process.env.RENDER_WORKER_URL;
    delete process.env.RENDER_WORKER_TOKEN;
  });

  afterEach(() => {
    process.env.RENDER_WORKER_URL = prevUrl;
    process.env.RENDER_WORKER_TOKEN = prevToken;
  });

  it('returns MissingRenderWorker when URL is absent', () => {
    const worker = createRenderWorker();
    expect(worker).toBeInstanceOf(MissingRenderWorker);
  });

  it('fails submit with a real error when not configured', async () => {
    const worker = createRenderWorker();
    await expect(
      worker.submit({
        sourceUrl: 'https://www.youtube.com/watch?v=abc',
        plan: {
          aspectRatio: '9:16',
          width: 1080,
          height: 1920,
          platform: 'youtube',
          start: 0,
          end: 20,
          maxDurationSeconds: 20,
          captions: {
            enabled: true,
            style: 'word-highlight',
            safeZone: { top: 1, bottom: 1, left: 1, right: 1 },
          },
          crop: 'smart-speaker',
        },
      }),
    ).rejects.toThrow(/RENDER_WORKER_URL/);
  });
});
