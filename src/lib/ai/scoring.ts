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

export const PLATFORM_WEIGHTS: Record<Platform, [number, number, number, number, number]> = {
  youtube: [0.24, 0.20, 0.21, 0.25, 0.10],
  tiktok: [0.28, 0.16, 0.18, 0.25, 0.13],
  reels: [0.25, 0.18, 0.20, 0.24, 0.13],
};

export function scoreClip(candidate: ClipCandidate, platform: Platform): number {
  const { hook, clarity, payoff, retention, shareability } = candidate.scores;
  const [wHook, wClarity, wPayoff, wRetention, wShare] = PLATFORM_WEIGHTS[platform];
  return clamp(hook * wHook + clarity * wClarity + payoff * wPayoff + retention * wRetention + shareability * wShare);
}

export function rankClips(candidates: ClipCandidate[], platform: Platform): ClipCandidate[] {
  return [...candidates].sort((a, b) => scoreClip(b, platform) - scoreClip(a, platform));
}

export function platformScores(candidate: ClipCandidate): Record<Platform, number> {
  return {
    youtube: scoreClip(candidate, 'youtube'),
    tiktok: scoreClip(candidate, 'tiktok'),
    reels: scoreClip(candidate, 'reels'),
  };
}
