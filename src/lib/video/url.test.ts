import { describe, expect, it } from 'vitest';
import { getYouTubeVideoId } from './url';

describe('getYouTubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc123', 'abc123'],
    ['https://youtu.be/abc123?t=10', 'abc123'],
    ['https://www.youtube.com/shorts/abc123', 'abc123'],
    ['https://www.youtube.com/embed/abc123', 'abc123'],
    ['https://www.youtube.com/live/abc123', 'abc123'],
  ])('%s', (url, expected) => expect(getYouTubeVideoId(url)).toBe(expected));

  it('rejects non-YouTube URLs', () => expect(getYouTubeVideoId('https://example.com/watch?v=abc')).toBeNull());
  it('rejects malformed input', () => expect(getYouTubeVideoId('not a url')).toBeNull());
});
