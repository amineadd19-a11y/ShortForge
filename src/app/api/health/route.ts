import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'shortforge',
    version: '0.1.0',
    providers: {
      transcript: Boolean(process.env.TRANSCRIPT_PROVIDER?.trim()),
    },
    timestamp: new Date().toISOString(),
  });
}
