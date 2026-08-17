import type { RenderPlan } from './plan';

export type RenderJob = {
  sourceUrl: string;
  plan: RenderPlan;
};

export type RenderJobResult = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: string;
};

export interface RenderWorker {
  submit(job: RenderJob): Promise<Pick<RenderJobResult, 'jobId' | 'status'>>;
  status(jobId: string): Promise<RenderJobResult>;
}

function workerBaseUrl(): string | null {
  const value = process.env.RENDER_WORKER_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

async function workerRequest<T>(path: string, init: RequestInit): Promise<T> {
  const base = workerBaseUrl();
  if (!base) throw new Error('RENDER_WORKER_URL is not configured.');

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && body.error
      ? body.error
      : `Render worker returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export class HttpRenderWorker implements RenderWorker {
  async submit(job: RenderJob) {
    return workerRequest<Pick<RenderJobResult, 'jobId' | 'status'>>('/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
  }

  async status(jobId: string) {
    if (!jobId.trim()) throw new Error('Render job id is required.');
    return workerRequest<RenderJobResult>(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });
  }
}

export class MissingRenderWorker implements RenderWorker {
  async submit(_job: RenderJob): Promise<never> {
    throw new Error('RENDER_WORKER_URL is not configured.');
  }

  async status(_jobId: string): Promise<never> {
    throw new Error('RENDER_WORKER_URL is not configured.');
  }
}

export function createRenderWorker(): RenderWorker {
  return workerBaseUrl() ? new HttpRenderWorker() : new MissingRenderWorker();
}
