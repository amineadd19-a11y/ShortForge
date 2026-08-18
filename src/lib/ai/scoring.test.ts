import { describe, expect, it } from 'vitest';
import { explainScore, platformScores, rankClips, scoreClip, type ClipCandidate } from './scoring';

const base: ClipCandidate = {
  id: 'c1',
  start: 0,
  end: 30,
  title: 'Why this matters',
  hook: 'Why this matters right now',
  transcript: 'Why this matters right now. Here is the payoff you need to see.',
  scores: { hook: 80, clarity: 70, payoff: 75, retention: 72, shareability: 68 },
};

describe('scoreClip', () => {
  it('returns a bounded score', () => {
    const score = scoreClip(base, 'youtube');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('weights platforms differently', () => {
    const scores = platformScores(base);
    expect(scores.youtube).toBeDefined();
    expect(scores.tiktok).toBeDefined();
    expect(scores.reels).toBeDefined();
  });

  it('ranks stronger hooks higher', () => {
    const weak = { ...base, id: 'w', scores: { ...base.scores, hook: 40, shareability: 40 } };
    const ranked = rankClips([weak, base], 'tiktok');
    expect(ranked[0].id).toBe('c1');
  });

  it('explains high signal scores', () => {
    const reasons = explainScore(base, 'youtube');
    expect(reasons.length).toBeGreaterThan(0);
  });
});
