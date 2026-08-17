export type Platform = 'youtube' | 'tiktok' | 'reels';

export type ClipCandidate = {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  transcript: string;
  scores: { hook: number; clarity: number; payoff: number; retention: number; shareability: number };
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function scoreClip(candidate: ClipCandidate, platform: Platform): number {
  const { hook, clarity, payoff, retention, shareability } = candidate.scores;
  const weights = platform === 'tiktok'
    ? [0.28, 0.16, 0.18, 0.25, 0.13]
    : platform === 'reels'
      ? [0.25, 0.18, 0.20, 0.24, 0.13]
      : [0.24, 0.20, 0.21, 0.25, 0.10];
  return clamp(hook * weights[0] + clarity * weights[1] + payoff * weights[2] + retention * weights[3] + shareability * weights[4]);
}

export function rankClips(candidates: ClipCandidate[], platform: Platform) {
  return [...candidates].sort((a, b) => scoreClip(b, platform) - scoreClip(a, platform));
}
