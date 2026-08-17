'use client';

import { useState } from 'react';
import { getYouTubeVideoId } from '@/lib/video/url';

type Platform = 'youtube' | 'tiktok' | 'reels';
type Analysis = {
  status: string;
  source: { videoId: string; title?: string; author?: string; thumbnailUrl?: string };
  transcript: { status: string; message?: string };
  clips: Array<{ id: string; start: number; end: number; title: string; hook: string; scoresByPlatform: Record<Platform, number> }>;
  limitations: string[];
};

const platforms: Array<[Platform, string, string]> = [
  ['youtube', 'YouTube Shorts', 'Retention-first packaging'],
  ['tiktok', 'TikTok', 'Hook + native pacing'],
  ['reels', 'Instagram Reels', 'Clean discovery packaging'],
];

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function Home() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const submit = async () => {
    setError('');
    setAnalysis(null);
    if (!getYouTubeVideoId(url)) return setError('Paste a valid YouTube video URL.');
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, platform }) });
      const data = await response.json() as Analysis & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Analysis failed.');
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black text-black">SF</div><span className="text-lg font-bold tracking-tight">ShortForge</span></div>
          <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/55 sm:block">AI short-form studio</div>
        </nav>

        <section className="grid gap-12 pb-16 pt-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Research-driven video intelligence</div>
            <h1 className="max-w-4xl text-5xl font-black tracking-[-.055em] sm:text-7xl">Turn long videos into <span className="text-white/45">short-form opportunities.</span></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Paste an authorized YouTube video. ShortForge enriches the source, acquires a transcript when configured, detects candidate moments and scores each one for the platform you want.</p>

            <div className="mt-8 flex flex-wrap gap-2">
              {platforms.map(([id, name]) => <button key={id} onClick={() => setPlatform(id)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${platform === id ? 'border-white/30 bg-white text-black' : 'border-white/10 bg-white/[.03] text-white/55 hover:bg-white/[.07]'}`}>{name}</button>)}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.045] p-2 shadow-2xl shadow-black/30">
              <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="https://youtube.com/watch?v=…" className="min-h-14 flex-1 rounded-xl bg-transparent px-4 text-sm outline-none placeholder:text-white/25" /><button disabled={loading} onClick={submit} className="min-h-14 rounded-xl bg-white px-7 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-60">{loading ? 'Analyzing…' : 'Analyze video'}</button></div>
              {error && <p role="alert" className="px-4 pb-2 pt-3 text-xs text-rose-300">{error}</p>}
            </div>
            <p className="mt-3 text-xs text-white/30">Predictions are heuristics, not guarantees of reach. Only process content you have rights or permission to use.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[['01', 'Analyze', 'Understand the source and story'], ['02', 'Find', 'Surface candidate moments'], ['03', 'Optimize', 'Adapt for each platform']].map(([n, t, d]) => <div key={n} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><span className="text-xs text-white/30">{n}</span><h2 className="mt-6 text-lg font-bold">{t}</h2><p className="mt-1 text-sm text-white/40">{d}</p></div>)}
          </div>
        </section>

        {analysis && <section className="border-t border-white/10 pb-20 pt-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs uppercase tracking-[.22em] text-white/35">Analysis result</p><h2 className="mt-2 text-3xl font-black tracking-tight">{analysis.source.title || 'YouTube source'}</h2><p className="mt-1 text-sm text-white/40">{analysis.source.author ? `${analysis.source.author} · ` : ''}{analysis.source.videoId}</p></div><div className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs text-white/55">{analysis.clips.length} candidate moments</div></div>

          {analysis.transcript.status !== 'ready' && <div className="mt-6 rounded-2xl border border-amber-300/10 bg-amber-300/[.04] p-5"><p className="font-semibold text-amber-100">Transcript provider needed</p><p className="mt-1 text-sm leading-6 text-white/45">{analysis.transcript.message || 'Connect a server-side transcript provider to enable real clip detection.'}</p></div>}

          {analysis.clips.length > 0 && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{analysis.clips.map((clip, index) => <article key={clip.id} className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-0.5 hover:bg-white/[.055]"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-white/35">#{String(index + 1).padStart(2, '0')} · {formatTime(clip.start)}–{formatTime(clip.end)}</span><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-black">{clip.scoresByPlatform[platform]}/100</span></div><h3 className="mt-5 text-lg font-bold leading-6">{clip.title}</h3><p className="mt-3 text-sm leading-6 text-white/45">{clip.hook}</p><div className="mt-5 flex gap-2"><button className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black">Open clip</button><button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/55">Optimize</button></div></article>)}</div>}

          {analysis.limitations.length > 0 && <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-white/35">Transparency</p><ul className="mt-3 space-y-2 text-sm text-white/40">{analysis.limitations.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
        </section>}

        <footer className="border-t border-white/10 py-8 text-xs text-white/25">ShortForge AI · Build content intelligence, not fake virality.</footer>
      </div>
    </main>
  );
}
