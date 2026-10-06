import { NextResponse } from 'next/server';
import { createRenderWorker } from '@/lib/render/worker';

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    if (!jobId?.trim()) return NextResponse.json({ error: 'Job id is required.' }, { status: 400 });
    const result = await createRenderWorker().status(jobId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read render status.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}


export async function DELETE(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    if (!jobId?.trim()) return NextResponse.json({ error: 'Job id is required.' }, { status: 400 });
    const result = await createRenderWorker().cancel(jobId);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel render.';
    const status = message.includes('already finished') ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
