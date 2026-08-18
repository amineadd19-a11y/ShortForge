import type { RenderPlan } from './plan';

export type RenderJob = { sourceUrl: string; plan: RenderPlan };
export type RenderJobResult = { jobId: string; status: 'queued' | 'processing' | 'completed' | 'failed'; outputUrl?: string; error?: string };
export interface RenderWorker { submit(job: RenderJob): Promise<Pick<RenderJobResult, 'jobId' | 'status'>>; status(jobId: string): Promise<RenderJobResult> }

function baseUrl() { const v = process.env.RENDER_WORKER_URL?.trim(); return v ? v.replace(/\/$/, '') : null; }
function token() { const v = process.env.RENDER_WORKER_TOKEN?.trim(); return v || null; }

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const base = baseUrl(); if (!base) throw new Error('RENDER_WORKER_URL is not configured.');
  const auth = token(); if (!auth) throw new Error('RENDER_WORKER_TOKEN is not configured.');
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${auth}`, ...(init.headers ?? {}) }, cache: 'no-store' });
  const body = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && body.error ? body.error : `Render worker returned HTTP ${response.status}.`);
  return body as T;
}

export class HttpRenderWorker implements RenderWorker {
  submit(job: RenderJob) { return request<Pick<RenderJobResult, 'jobId' | 'status'>>('/jobs', { method: 'POST', body: JSON.stringify(job) }); }
  status(jobId: string) { if (!jobId.trim()) throw new Error('Render job id is required.'); return request<RenderJobResult>(`/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' }); }
}
export class MissingRenderWorker implements RenderWorker {
  async submit(_job: RenderJob): Promise<never> { throw new Error('RENDER_WORKER_URL is not configured.'); }
  async status(_jobId: string): Promise<never> { throw new Error('RENDER_WORKER_URL is not configured.'); }
}
export function createRenderWorker(): RenderWorker { return baseUrl() ? new HttpRenderWorker() : new MissingRenderWorker(); }
