'use client';

import { useEffect, useState } from 'react';

type Result = {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  outputUrl?: string;
  error?: string;
  transcriptStatus?: string;
  cropStatus?: string;
};

export function RenderStatus({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<Result>({ status: 'queued', progress: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/render/status/${encodeURIComponent(jobId)}`, {
          cache: 'no-store',
        });
        const data = (await response.json()) as Result & { error?: string };
        if (!active) return;
        if (!response.ok) {
          setError(data.error || 'Unable to read render status.');
          return;
        }
        setError('');
        setResult(data);
        if (data.status === 'queued' || data.status === 'processing') {
          window.setTimeout(poll, 2000);
        }
      } catch {
        if (active) window.setTimeout(poll, 4000);
      }
    };
    void poll();
    return () => {
      active = false;
    };
  }, [jobId]);

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-rose-300">{error}</p>
        <p className="text-xs text-white/40">Job id: {jobId}</p>
      </div>
    );
  }

  if (result.status === 'completed' && result.outputUrl) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-emerald-200">Render completed — MP4 ready.</p>
        <a
          href={result.outputUrl}
          className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
          target="_blank"
          rel="noreferrer"
        >
          Download Short
        </a>
      </div>
    );
  }

  if (result.status === 'failed') {
    return (
      <p className="text-sm text-rose-300">Render failed: {result.error ?? 'Unknown error.'}</p>
    );
  }

  const progress = Math.max(0, Math.min(100, Number(result.progress) || 0));

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        {result.status === 'processing' ? 'Rendering your Short…' : 'Render job queued…'}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white transition-all duration-500"
          style={{ width: `${progress || (result.status === 'processing' ? 15 : 5)}%` }}
        />
      </div>
      <p className="text-xs text-white/35">
        {[`progress ${progress}%`, result.transcriptStatus && `transcript: ${result.transcriptStatus}`, result.cropStatus && `crop: ${result.cropStatus}`]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}
