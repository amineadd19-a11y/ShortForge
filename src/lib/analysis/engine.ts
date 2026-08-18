import { platformScores, rankClips, type ClipCandidate, scoreClip } from '@/lib/ai/scoring';
import type { AnalysisResult, TranscriptSegment, VideoSource } from './types';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const HOOK_PATTERNS =
  /\b(how to|why|secret|mistake|never|always|stop|start|truth|watch|here's|here is|what if|the real|nobody|everyone|warning|important|wait|listen)\b/i;
const QUESTION_MARK = /[?؟]/;
const ENERGY = /[!]|\b(wow|crazy|insane|amazing|shocking|unbelievable)\b/i;

function scoreWindow(transcript: string, duration: number) {
  const words = transcript.split(/\s+/).filter(Boolean);
  const first = words.slice(0, 14).join(' ');
  const punctuation = (transcript.match(/[!?؟]/g) ?? []).length;
  const density = clamp((words.length / Math.max(1, duration)) * 8);
  const hookBoost =
    (HOOK_PATTERNS.test(first) ? 14 : 0) +
    (QUESTION_MARK.test(first) ? 10 : 0) +
    (ENERGY.test(first) ? 8 : 0);
  const hook = clamp(48 + punctuation * 6 + (first.length >= 20 ? 8 : 0) + hookBoost);
  const clarity = clamp(55 + Math.min(28, words.length / 4) - (words.length > 160 ? 12 : 0));
  const payoff = clamp(50 + (words.length >= 40 ? 16 : 0) + punctuation * 3 + (HOOK_PATTERNS.test(transcript) ? 6 : 0));
  const retention = clamp(52 + density * 0.35 + (duration >= 20 && duration <= 50 ? 12 : 0));
  const shareability = clamp(48 + punctuation * 5 + (ENERGY.test(transcript) ? 12 : 0) + (words.length >= 50 ? 10 : 0));
  return { hook, clarity, payoff, retention, shareability, first, words };
}

function candidateFromWindow(
  segments: TranscriptSegment[],
  index: number,
  start: number,
  end: number,
): ClipCandidate {
  const transcript = segments
    .filter((s) => s.start < end && s.end > start)
    .map((s) => s.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const scored = scoreWindow(transcript, end - start);
  return {
    id: `clip-${index + 1}`,
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
    title: scored.first.slice(0, 72) || `Candidate moment ${index + 1}`,
    hook: scored.first || 'Review the opening hook',
    transcript,
    scores: {
      hook: scored.hook,
      clarity: scored.clarity,
      payoff: scored.payoff,
      retention: scored.retention,
      shareability: scored.shareability,
    },
  };
}

/** Sliding windows biased toward strong opening lines and short-form duration. */
export function detectBaselineClips(segments: TranscriptSegment[]): ClipCandidate[] {
  if (!segments.length) return [];

  const windows: ClipCandidate[] = [];
  const seen = new Set<string>();

  const pushWindow = (start: number, end: number) => {
    const duration = end - start;
    if (duration < 12 || duration > 70) return;
    const key = `${Math.floor(start)}-${Math.floor(end)}`;
    if (seen.has(key)) return;
    seen.add(key);
    windows.push(candidateFromWindow(segments, windows.length, start, end));
  };

  // Anchor windows on likely hooks
  for (let i = 0; i < segments.length; i += 1) {
    const text = segments[i].text;
    if (HOOK_PATTERNS.test(text) || QUESTION_MARK.test(text) || ENERGY.test(text)) {
      const start = segments[i].start;
      let end = start;
      for (let j = i; j < segments.length && end - start < 48; j += 1) {
        end = segments[j].end;
      }
      pushWindow(start, Math.min(end, start + 55));
    }
    if (windows.length >= 16) break;
  }

  // Regular sampling to ensure coverage
  for (let i = 0; i < segments.length; i += 2) {
    const start = segments[i].start;
    let end = start;
    for (let j = i; j < segments.length && end - start < 45; j += 1) {
      end = segments[j].end;
    }
    pushWindow(start, Math.min(end, start + 55));
    if (windows.length >= 20) break;
  }

  return windows;
}

export function buildAnalysis(
  source: VideoSource,
  segments: TranscriptSegment[],
  platform: AnalysisResult['platform'] = 'youtube',
): AnalysisResult {
  const ranked = rankClips(detectBaselineClips(segments), platform);
  const candidates = ranked.map((clip) => ({
    ...clip,
    scoresByPlatform: platformScores(clip),
    viralScore: scoreClip(clip, platform),
  }));

  return {
    source,
    transcript: segments.length
      ? { status: 'ready', segments }
      : { status: 'unavailable', segments: [] },
    clips: candidates.slice(0, 6),
    platform,
    limitations: segments.length
      ? [
          'Heuristic viral scoring is an optimization signal, not a prediction or guarantee of reach.',
          'Top candidates are selected deterministically from the available transcript.',
        ]
      : ['No transcript was available, so clip detection was not fabricated.'],
  };
}
