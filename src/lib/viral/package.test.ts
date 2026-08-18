import { describe, expect, it } from 'vitest';
import { buildExportPackage, formatExportPackageText } from './package';

describe('buildExportPackage', () => {
  it('builds a complete package without claiming viral guarantees', () => {
    const pkg = buildExportPackage({
      platform: 'tiktok',
      title: 'Why this works',
      hook: 'Why does everyone get this wrong?',
      transcript: 'Why does everyone get this wrong? Here is the simple system.',
      durationSeconds: 32,
      score: 78,
      scoreExplanation: ['Strong opening hook'],
      sourceTitle: 'Demo video',
      sourceCreator: 'Creator',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
    });

    expect(pkg.title).toBeTruthy();
    expect(pkg.alternativeTitle).toBeTruthy();
    expect(pkg.hashtags.length).toBeGreaterThan(0);
    expect(pkg.disclaimer.toLowerCase()).toContain('not guarantee');
    expect(formatExportPackageText(pkg)).toContain('Platform: tiktok');
  });
});
