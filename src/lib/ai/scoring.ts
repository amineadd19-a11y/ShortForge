export type Platform = 'youtube' | 'tiktok' | 'reels';

export type ClipCandidate = {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  transcript: string;
  scores: {
    hook: number;
    clarity: number;
    payoff: number;
    retention: number;
    shareability: number;
  };
  scoreReasons?: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const PLATFORM_WEIGHTS: Record<Platform, [number, number, number, number, number]> = {
  youtube: [0.24, 0.2, 0.21, 0.25, 0.1],
  tiktok: [0.28, 0.16, 0.18, 0.25, 0.13],
  reels: [0.25, 0.18, 0.2, 0.24, 0.13],
};

export function scoreClip(candidate: ClipCandidate, platform: Platform): number {
  const { hook, clarity, payoff, retention, shareability } = candidate.scores;
  const [a, b, c, d, e] = PLATFORM_WEIGHTS[platform];
  return clamp(hook * a + clarity * b + payoff * c + retention * d + shareability * e);
}

export function explainScore(candidate: ClipCandidate, platform: Platform): string[] {
  const s = candidate.scores;
  const duration = candidate.end - candidate.start;
  const reasons: string[] = [];

  if (s.hook >= 70) reasons.push('Strong opening hook');
  else if (s.hook < 50) reasons.push('Weak opening hook');

  if (s.retention >= 70) reasons.push('Good retention profile');
  if (s.payoff >= 70) reasons.push('Clear payoff potential');
  if (s.shareability >= 70) reasons.push('High shareability signal');
  if (s.clarity >= 70) reasons.push('Clear, easy-to-follow message');
  else if (s.clarity < 50) reasons.push('Message may be hard to follow');

  if (duration >= 15 && duration <= 45) reasons.push('Duration fits short-form attention');
  else if (duration > 55) reasons.push('Longer than ideal short-form length');

  if (platform === 'tiktok' && s.hook >= 65) reasons.push('Prioritizes fast hook for TikTok');
  if (platform === 'youtube' && s.retention >= 65) reasons.push('Prioritizes sustained retention for Shorts');
  if (platform === 'reels' && s.shareability >= 65) reasons.push('Prioritizes shareability for Reels');

  reasons.push('Heuristic optimization signal — not a reach guarantee');
  return reasons;
}

export function rankClips(candidates: ClipCandidate[], platform: Platform): ClipCandidate[] {
  return [...candidates]
    .map((c) => ({ ...c, scoreReasons: explainScore(c, platform) }))
    .sort((a, b) => scoreClip(b, platform) - scoreClip(a, platform));
}

export function platformScores(candidate: ClipCandidate): Record<Platform, number> {
  return {
    youtube: scoreClip(candidate, 'youtube'),
    tiktok: scoreClip(candidate, 'tiktok'),
    reels: scoreClip(candidate, 'reels'),
  };
}
