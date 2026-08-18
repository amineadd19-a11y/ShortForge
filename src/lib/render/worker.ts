import type { RenderPlan } from './plan';

export type RenderJob = { sourceUrl: string; plan: RenderPlan };
export type RenderJobResult = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  outputUrl?: string;
  error?: string;
  transcriptStatus?: string;
  cropStatus?: string;
  faceTrackingStatus?: string;
};
export interface RenderWorker {
  submit(job: RenderJob): Promise<Pick<RenderJobResult, 'jobId' | 'status'>>;
  status(jobId: string): Promise<RenderJobResult>;
}

function baseUrl() {
  const v = process.env.RENDER_WORKER_URL?.trim();
  return v ? v.replace(/\/$/, '') : null;
}
function token() {
  const v = process.env.RENDER_WORKER_TOKEN?.trim();
  return v || null;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const base = baseUrl();
  if (!base) throw new Error('RENDER_WORKER_URL is not configured.');
  const auth = token();
  if (!auth) throw new Error('RENDER_WORKER_TOKEN is not configured.');

  try {
    new URL(base);
  } catch {
    throw new Error('RENDER_WORKER_URL is invalid.');
  }
  if (!base.startsWith('https://') && !base.startsWith('http://127.0.0.1') && !base.startsWith('http://localhost')) {
    throw new Error('RENDER_WORKER_URL must be HTTPS (or localhost for development).');
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${auth}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(
      body && typeof body === 'object' && 'error' in body && body.error
        ? body.error
        : `Render worker returned HTTP ${response.status}.`,
    );
  }
  return body as T;
}

export class HttpRenderWorker implements RenderWorker {
  submit(job: RenderJob) {
    return request<Pick<RenderJobResult, 'jobId' | 'status'>>('/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
  }
  status(jobId: string) {
    if (!jobId.trim() || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      throw new Error('Render job id is required.');
    }
    return request<RenderJobResult>(`/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' });
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
  return baseUrl() ? new HttpRenderWorker() : new MissingRenderWorker();
}
