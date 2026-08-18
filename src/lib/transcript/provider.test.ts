import { describe, expect, it } from 'vitest';
import { parseCaptionXml } from './youtube-captions';

describe('parseCaptionXml', () => {
  it('parses srv3 paragraph captions', () => {
    const xml = `<timedtext><body><p t="1000" d="2000">Hello world</p><p t="3000" d="1500">Second line</p></body></timedtext>`;
    const segments = parseCaptionXml(xml);
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0].text).toContain('Hello');
    expect(segments[0].start).toBe(1);
  });

  it('returns empty for empty xml', () => {
    expect(parseCaptionXml('')).toEqual([]);
  });

  it('parses legacy text nodes', () => {
    const xml = `<transcript><text start="1.5" dur="2.0">Legacy caption</text></transcript>`;
    const segments = parseCaptionXml(xml);
    expect(segments[0]?.text).toBe('Legacy caption');
    expect(segments[0]?.start).toBe(1.5);
  });
});
