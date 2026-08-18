/**
 * Optional AI enrichment layer.
 * Deterministic analysis always works without this module.
 * AI must never invent transcript text, timestamps, or analytics facts.
 */

export type EnrichmentResult = {
  status: 'skipped' | 'ready' | 'failed';
  suggestions?: string[];
  message?: string;
};

export async function enrichClipHints(input: {
  title: string;
  hook: string;
  transcript: string;
  platform: string;
}): Promise<EnrichmentResult> {
  const provider = process.env.AI_PROVIDER?.trim();
  const key = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();

  if (!provider || !key) {
    return {
      status: 'skipped',
      message: 'AI enrichment is optional and not configured.',
    };
  }

  if (!/^https:\/\//i.test(provider)) {
    return {
      status: 'skipped',
      message: 'AI_PROVIDER must be an HTTPS endpoint for enrichment.',
    };
  }

  try {
    const response = await fetch(provider, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        task: 'clip-hints',
        model: model || undefined,
        platform: input.platform,
        title: input.title,
        hook: input.hook,
        transcriptExcerpt: input.transcript.slice(0, 1200),
        rules: [
          'Do not invent timestamps',
          'Do not invent analytics',
          'Do not invent transcript text',
          'Return only packaging suggestions',
        ],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return { status: 'failed', message: `AI provider returned HTTP ${response.status}.` };
    }

    const data = (await response.json()) as { suggestions?: unknown };
    const suggestions = Array.isArray(data.suggestions)
      ? data.suggestions
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 6)
      : [];

    return suggestions.length
      ? { status: 'ready', suggestions }
      : { status: 'failed', message: 'AI provider returned no usable suggestions.' };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'AI enrichment failed.',
    };
  }
}
