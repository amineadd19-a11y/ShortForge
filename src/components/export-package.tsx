'use client';

import { useState } from 'react';
import type { ExportPackage } from '@/lib/viral/package';
import { formatExportPackageText } from '@/lib/viral/package';

export function ExportPackagePanel({ pkg }: { pkg: ExportPackage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatExportPackageText(pkg));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">Export package</p>
          <h3 className="mt-1 text-lg font-bold">Ready-to-post metadata</h3>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15"
        >
          {copied ? 'Copied' : 'Copy package'}
        </button>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-white/35">Title</dt>
          <dd className="mt-1 font-semibold">{pkg.title}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Alternative title</dt>
          <dd className="mt-1 font-semibold">{pkg.alternativeTitle}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-white/35">Hook</dt>
          <dd className="mt-1 text-white/70">{pkg.hook}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-white/35">Description</dt>
          <dd className="mt-1 whitespace-pre-wrap text-white/70">{pkg.description}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">CTA</dt>
          <dd className="mt-1 text-white/70">{pkg.cta}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Score</dt>
          <dd className="mt-1 font-semibold">{pkg.score}/100</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-white/35">Hashtags</dt>
          <dd className="mt-1 text-white/70">{pkg.hashtags.join(' ')}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-white/35">Keywords</dt>
          <dd className="mt-1 text-white/70">{pkg.keywords.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Duration</dt>
          <dd className="mt-1">{pkg.durationSeconds}s · {pkg.platform}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Source</dt>
          <dd className="mt-1 truncate text-white/70">{pkg.sourceTitle || pkg.sourceUrl}</dd>
        </div>
      </dl>

      {pkg.scoreExplanation.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-white/40">
          {pkg.scoreExplanation.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-5 text-white/30">{pkg.disclaimer}</p>
    </section>
  );
}
