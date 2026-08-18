import { describe, expect, it } from 'vitest';
import { buildAnalysis, detectBaselineClips } from './engine';
import type { TranscriptSegment } from './types';

const segments: TranscriptSegment[] = [
  { start: 0, end: 4, text: 'Why does everyone get this wrong?' },
  { start: 4, end: 9, text: 'Here is the real secret nobody talks about.' },
  { start: 9, end: 15, text: 'First you need to stop doing this common mistake.' },
  { start: 15, end: 22, text: 'Then you start with a simple system that actually works.' },
  { start: 22, end: 30, text: 'Watch what happens when you apply it for seven days.' },
  { start: 30, end: 40, text: 'The payoff is clearer retention and better results overall.' },
];

describe('detectBaselineClips', () => {
  it('returns candidates from transcript segments', () => {
    const clips = detectBaselineClips(segments);
    expect(clips.length).toBeGreaterThan(0);
    expect(clips[0].transcript.length).toBeGreaterThan(0);
  });

  it('does not invent clips without transcript', () => {
    expect(detectBaselineClips([])).toEqual([]);
  });
});

describe('buildAnalysis', () => {
  it('returns ranked clips with platform scores', () => {
    const result = buildAnalysis(
      { videoId: 'abc', url: 'https://www.youtube.com/watch?v=abc', title: 'Demo' },
      segments,
      'youtube',
    );
    expect(result.transcript.status).toBe('ready');
    expect(result.clips.length).toBeGreaterThan(0);
    expect(result.clips[0].scoresByPlatform.youtube).toBeGreaterThan(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
