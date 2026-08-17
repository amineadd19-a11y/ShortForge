'use client';

import { useEffect, useState } from 'react';

type Result = { status: 'queued' | 'processing' | 'completed' | 'failed'; outputUrl?: string; error?: string };

export function RenderStatus({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<Result>({ status: 'queued' });

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/render/status/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        const data = await response.json() as Result;
        if (!active) return;
        setResult(data);
        if (data.status === 'queued' || data.status === 'processing') window.setTimeout(poll, 2000);
      } catch {
        if (active) window.setTimeout(poll, 4000);
      }
    };
    void poll();
    return () => { active = false; };
  }, [jobId]);

  if (result.status === 'completed' && result.outputUrl) {
    return <a href={result.outputUrl} className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black" target="_blank" rel="noreferrer">Download Short</a>;
  }
  if (result.status === 'failed') return <p className="text-sm text-red-300">Render failed: {result.error ?? 'Unknown error.'}</p>;
  return <p className="text-sm text-slate-300">{result.status === 'processing' ? 'Rendering your Short…' : 'Render job queued…'}</p>;
}
