import { platformScores, rankClips, type ClipCandidate } from '@/lib/ai/scoring';
import type { AnalysisResult, TranscriptSegment, VideoSource } from './types';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function candidateFromWindow(segments: TranscriptSegment[], index: number, start: number, end: number): ClipCandidate {
  const transcript = segments.filter((s) => s.start < end && s.end > start).map((s) => s.text.trim()).join(' ').replace(/\s+/g, ' ').trim();
  const words = transcript.split(/\s+/).filter(Boolean);
  const first = words.slice(0, 12).join(' ');
  const punctuation = (transcript.match(/[!?]/g) ?? []).length;
  const density = clamp(words.length / Math.max(1, end - start) * 7);
  const hook = clamp(54 + punctuation * 8 + (first.length >= 25 ? 10 : 0));
  const clarity = clamp(58 + Math.min(24, words.length / 5));
  const payoff = clamp(52 + (words.length >= 45 ? 18 : 0) + punctuation * 4);
  const retention = clamp(55 + density * 0.32 + (end - start <= 55 ? 10 : 0));
  const shareability = clamp(50 + punctuation * 6 + (words.length >= 55 ? 12 : 0));

  return {
    id: `clip-${index + 1}`,
    start,
    end,
    title: first.slice(0, 72) || `Candidate moment ${index + 1}`,
    hook: first || 'Review the opening hook',
    transcript,
    scores: { hook, clarity, payoff, retention, shareability },
  };
}

/** Deterministic baseline. When an AI provider is connected, it can replace this step. */
export function detectBaselineClips(segments: TranscriptSegment[]): ClipCandidate[] {
  if (!segments.length) return [];
  const windows: ClipCandidate[] = [];
  for (let i = 0; i < segments.length; i += 3) {
    const start = segments[i].start;
    const end = Math.min(start + 55, segments[Math.min(i + 5, segments.length - 1)].end);
    if (end - start >= 12) windows.push(candidateFromWindow(segments, windows.length, start, end));
    if (windows.length >= 12) break;
  }
  return windows;
}

export function buildAnalysis(source: VideoSource, segments: TranscriptSegment[], platform: AnalysisResult['platform'] = 'youtube'): AnalysisResult {
  const candidates = rankClips(detectBaselineClips(segments), platform).map((clip) => ({ ...clip, scoresByPlatform: platformScores(clip) }));
  return {
    source,
    transcript: segments.length ? { status: 'ready', segments } : { status: 'unavailable', segments: [] },
    clips: candidates,
    platform,
    limitations: segments.length ? ['Baseline scoring is heuristic until an AI analysis provider is connected.', 'Scores predict content fit; they do not guarantee reach or virality.'] : ['No transcript was available, so clip detection was not fabricated.'],
  };
}
