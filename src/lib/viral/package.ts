import type { Platform } from '@/lib/ai/scoring';

export type ExportPackage = {
  platform: Platform;
  title: string;
  alternativeTitle: string;
  description: string;
  hook: string;
  cta: string;
  hashtags: string[];
  keywords: string[];
  durationSeconds: number;
  score: number;
  scoreExplanation: string[];
  sourceTitle?: string;
  sourceCreator?: string;
  sourceUrl: string;
  disclaimer: string;
};

function clean(text: string, max = 100): string {
  return text.replace(/[#\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function keywordsFrom(text: string): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'your', 'you', 'are', 'was', 'were', 'have', 'has',
    'what', 'when', 'where', 'how', 'why', 'who', 'not', 'but', 'all', 'can', 'will', 'just',
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
  return Array.from(new Set(words)).slice(0, 8);
}

const PLATFORM_TAGS: Record<Platform, string[]> = {
  youtube: ['#Shorts', '#YouTubeShorts', '#ViralShorts'],
  tiktok: ['#TikTok', '#FYP', '#ForYou'],
  reels: ['#Reels', '#InstagramReels', '#Explore'],
};

const PLATFORM_CTA: Record<Platform, string> = {
  youtube: 'Follow for more. Comment your take below.',
  tiktok: 'Follow for part 2. Save this for later.',
  reels: 'Save this Reel. Share with someone who needs it.',
};

export function buildExportPackage(input: {
  platform: Platform;
  title: string;
  hook: string;
  transcript?: string;
  durationSeconds: number;
  score: number;
  scoreExplanation?: string[];
  sourceTitle?: string;
  sourceCreator?: string;
  sourceUrl: string;
}): ExportPackage {
  const hook = clean(input.hook || input.title, 120);
  const title = clean(input.title || hook, 90);
  const alternativeTitle = clean(
    hook.endsWith('?') ? hook : `${hook} — watch this`,
    90,
  );
  const body = clean(input.transcript || hook, 280);
  const description = [body, PLATFORM_CTA[input.platform], input.sourceTitle ? `Source: ${input.sourceTitle}` : '']
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 500);

  return {
    platform: input.platform,
    title,
    alternativeTitle,
    description,
    hook,
    cta: PLATFORM_CTA[input.platform],
    hashtags: PLATFORM_TAGS[input.platform],
    keywords: keywordsFrom(`${title} ${hook} ${body}`),
    durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    scoreExplanation: input.scoreExplanation?.length
      ? input.scoreExplanation
      : ['Heuristic optimization signal — not a guarantee of reach.'],
    sourceTitle: input.sourceTitle,
    sourceCreator: input.sourceCreator,
    sourceUrl: input.sourceUrl,
    disclaimer:
      'Titles, hashtags and scores are optimization helpers only. They do not guarantee views, reach or engagement.',
  };
}

/** @deprecated use buildExportPackage */
export function buildViralPackage(title: string, hook: string, platform: Platform) {
  return buildExportPackage({
    platform,
    title,
    hook,
    durationSeconds: 0,
    score: 0,
    sourceUrl: '',
  });
}

export function formatExportPackageText(pkg: ExportPackage): string {
  return [
    `Platform: ${pkg.platform}`,
    `Title: ${pkg.title}`,
    `Alt title: ${pkg.alternativeTitle}`,
    `Hook: ${pkg.hook}`,
    `CTA: ${pkg.cta}`,
    `Description:\n${pkg.description}`,
    `Hashtags: ${pkg.hashtags.join(' ')}`,
    `Keywords: ${pkg.keywords.join(', ')}`,
    `Duration: ${pkg.durationSeconds}s`,
    `Score: ${pkg.score}/100`,
    `Score notes: ${pkg.scoreExplanation.join('; ')}`,
    pkg.sourceTitle ? `Source: ${pkg.sourceTitle}` : '',
    pkg.sourceCreator ? `Creator: ${pkg.sourceCreator}` : '',
    `Source URL: ${pkg.sourceUrl}`,
    pkg.disclaimer,
  ]
    .filter(Boolean)
    .join('\n');
}
