import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'shortforge',
    version: '0.4.0',
    providers: {
      transcript: Boolean(process.env.TRANSCRIPT_PROVIDER?.trim()),
      renderWorker: Boolean(
        process.env.RENDER_WORKER_URL?.trim() && process.env.RENDER_WORKER_TOKEN?.trim(),
      ),
      aiEnrichment: Boolean(process.env.AI_PROVIDER?.trim() && process.env.AI_API_KEY?.trim()),
    },
    pipeline: {
      analysis: true,
      exportPackage: true,
      render: Boolean(
        process.env.RENDER_WORKER_URL?.trim() && process.env.RENDER_WORKER_TOKEN?.trim(),
      ),
    },
    timestamp: new Date().toISOString(),
  });
}
