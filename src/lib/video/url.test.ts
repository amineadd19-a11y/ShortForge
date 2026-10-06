import { describe, expect, it } from 'vitest';
import { getYouTubeVideoId, youtubeUrlSchema } from './url';

const VALID_ID = 'dQw4w9WgXcQ';

describe('getYouTubeVideoId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${VALID_ID}`, VALID_ID],
    [`https://youtu.be/${VALID_ID}?t=10`, VALID_ID],
    [`https://www.youtube.com/shorts/${VALID_ID}`, VALID_ID],
    [`https://www.youtube.com/embed/${VALID_ID}`, VALID_ID],
    [`https://www.youtube.com/live/${VALID_ID}`, VALID_ID],
    [`https://www.youtube-nocookie.com/embed/${VALID_ID}`, VALID_ID],
  ])('%s', (url, expected) => expect(getYouTubeVideoId(url)).toBe(expected));

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?list=PL123',
    'https://www.youtube.com/watch?v=abc123',
    `https://youtu.be/${VALID_ID}/extra`,
    `https://user:pass@www.youtube.com/watch?v=${VALID_ID}`,
    'javascript:alert(1)',
    'data:text/plain,hello',
  ])('rejects unsafe or non-video URLs: %s', (url) => {
    expect(getYouTubeVideoId(url)).toBeNull();
  });

  it('rejects malformed input', () => expect(getYouTubeVideoId('not a url')).toBeNull());

  it('normalizes surrounding whitespace but keeps HTTPS enforcement', () => {
    expect(getYouTubeVideoId(`  https://youtu.be/${VALID_ID}  `)).toBe(VALID_ID);
    expect(youtubeUrlSchema.safeParse(`http://youtu.be/${VALID_ID}`).success).toBe(false);
  });
});
