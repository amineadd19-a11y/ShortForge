import type { RenderPlan } from './plan';

export type RenderJob = {
  sourceUrl: string;
  plan: RenderPlan;
};

export interface RenderWorker {
  submit(job: RenderJob): Promise<{ jobId: string; status: 'queued' }>;
}

export class MissingRenderWorker implements RenderWorker {
  async submit(_job: RenderJob): Promise<{ jobId: string; status: 'queued' }> {
    throw new Error('RENDER_WORKER_URL is not configured.');
  }
}

export function createRenderWorker(): RenderWorker {
  return new MissingRenderWorker();
}
