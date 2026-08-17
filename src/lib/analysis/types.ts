import type { ClipCandidate, Platform } from '@/lib/ai/scoring';

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type VideoSource = {
  videoId: string;
  url: string;
  title?: string;
  author?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

export type AnalysisResult = {
  source: VideoSource;
  transcript: { status: 'ready' | 'unavailable'; segments: TranscriptSegment[]; message?: string };
  clips: Array<ClipCandidate & { viralScore: number; scoresByPlatform: Record<Platform, number> }>;
  platform: Platform;
  limitations: string[];
};
