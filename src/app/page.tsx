'use client';

import { useState } from 'react';
import { getYouTubeVideoId } from '@/lib/video/url';

const platforms = [
  ['YouTube Shorts', 'Retention-first cuts, titles and hooks'],
  ['TikTok', 'Fast hooks, native pacing and shareability'],
  ['Reels', 'Clean vertical edits and discovery copy'],
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const submit = () => {
    const id = getYouTubeVideoId(url);
    setMessage(id ? `Ready to analyze video ${id}.` : 'Paste a valid YouTube video URL.');
  };

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-black text-black">SF</div><span className="font-semibold tracking-tight">ShortForge</span></div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">AI video studio</span>
        </nav>

        <section className="mx-auto max-w-4xl pb-20 pt-20 text-center sm:pt-28">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Long video → short-form intelligence</p>
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">Find the moments<br /><span className="text-white/45">people want to watch.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Drop a YouTube link. ShortForge analyzes the story, identifies high-potential moments and prepares platform-specific short-form concepts.</p>

          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.045] p-2 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input aria-label="YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Paste a YouTube URL…" className="min-h-14 flex-1 rounded-xl bg-transparent px-4 text-sm outline-none placeholder:text-white/25" />
              <button onClick={submit} className="min-h-14 rounded-xl bg-white px-7 text-sm font-bold text-black transition hover:bg-white/90">Analyze video</button>
            </div>
            {message && <p className="px-4 pb-2 pt-3 text-left text-xs text-white/55">{message}</p>}
          </div>
          <p className="mt-4 text-xs text-white/30">Analysis is a prediction, not a promise of virality. Only process content you have rights to use.</p>
        </section>

        <section className="grid gap-4 pb-20 md:grid-cols-3">
          {platforms.map(([name, desc], i) => <article key={name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"><div className="mb-8 flex items-center justify-between"><span className="text-sm font-semibold">0{i + 1}</span><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/45">Optimizer</span></div><h2 className="text-xl font-bold">{name}</h2><p className="mt-2 text-sm leading-6 text-white/45">{desc}</p></article>)}
        </section>
      </div>
    </main>
  );
}
