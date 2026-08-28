'use client';

import { useMemo, useState } from 'react';
import { getYouTubeVideoId } from '@/lib/video/url';
import { RenderStatus } from '@/components/render-status';
import { ExportPackagePanel } from '@/components/export-package';
import { buildExportPackage, type ExportPackage } from '@/lib/viral/package';

type Platform = 'youtube' | 'tiktok' | 'reels';
type Tab = 'overview' | 'clips' | 'export';

type Analysis = {
  status: string;
  source: { videoId: string; title?: string; author?: string; thumbnailUrl?: string; url?: string };
  transcript: { status: string; message?: string; provider?: string };
  clips: Array<{ id: string; start: number; end: number; title: string; hook: string; transcript?: string; scores?: Record<string, number>; scoreReasons?: string[]; scoresByPlatform: Record<Platform, number> }>;
  limitations: string[];
};

const platforms: Array<[Platform, string]> = [['youtube', 'YouTube Shorts'], ['tiktok', 'TikTok'], ['reels', 'Instagram Reels']];
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Home() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const selected = useMemo(() => analysis?.clips.find((c) => c.id === selectedClip) ?? null, [analysis, selectedClip]);
  const exportPkg: ExportPackage | null = useMemo(() => {
    if (!analysis || !selected) return null;
    return buildExportPackage({ platform, title: selected.title, hook: selected.hook, transcript: selected.transcript, durationSeconds: selected.end - selected.start, score: selected.scoresByPlatform[platform], scoreExplanation: selected.scoreReasons, sourceTitle: analysis.source.title, sourceCreator: analysis.source.author, sourceUrl: analysis.source.url || url });
  }, [analysis, selected, platform, url]);

  const submit = async () => {
    setError(''); setAnalysis(null); setSelectedClip(null); setRenderJob(null);
    if (!getYouTubeVideoId(url)) return setError('Paste a valid YouTube video URL.');
    setLoading(true);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, platform }) });
      const d = (await r.json()) as Analysis & { error?: string };
      if (!r.ok) throw new Error(d.error || 'Analysis failed.');
      setAnalysis(d); setTab('clips'); if (d.clips[0]) setSelectedClip(d.clips[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed.'); }
    finally { setLoading(false); }
  };

  const generateAuto = async () => {
    setError(''); setAuto(true); setRenderJob(null);
    try {
      const r = await fetch('/api/auto-short/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, platform }) });
      const d = (await r.json()) as { job?: { jobId?: string }; error?: string };
      if (!r.ok || !d.job?.jobId) throw new Error(d.error || 'Unable to start automatic render.');
      setRenderJob(d.job.jobId); setTab('export');
    } catch (e) { setError(e instanceof Error ? e.message : 'Automatic render failed.'); }
    finally { setAuto(false); }
  };

  const generate = async () => {
    if (!analysis || !selected) return;
    setError(''); setRendering(true);
    try {
      const r = await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, start: selected.start, end: selected.end, platform }) });
      const d = (await r.json()) as { jobId?: string; error?: string };
      if (!r.ok || !d.jobId) throw new Error(d.error || 'Unable to start render.');
      setRenderJob(d.jobId); setTab('export');
    } catch (e) { setError(e instanceof Error ? e.message : 'Render failed.'); }
    finally { setRendering(false); }
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black text-black">SF</div><div><div className="text-lg font-bold leading-none">ShortForge</div><div className="mt-1 text-[11px] text-white/40">AI short-form studio</div></div></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 sm:block">● Studio ready</span><span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 md:block">Shorts · TikTok · Reels</span></div>
        </nav>

        <section className="pb-10 pt-12 lg:pt-16">
          <div className="max-w-4xl"><div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/55">Research-driven video intelligence</div><h1 className="text-4xl font-black tracking-[-0.045em] sm:text-6xl">Turn long videos into <span className="text-white/40">short-form assets.</span></h1><p className="mt-5 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">Analyze a YouTube source, let AI rank the strongest moments, then generate a platform-ready 9:16 short.</p></div>
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.045] p-2 shadow-2xl shadow-black/20"><div className="flex flex-col gap-2 lg:flex-row"><input aria-label="YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Paste a YouTube URL…" className="min-h-14 flex-1 rounded-xl bg-transparent px-4 text-sm outline-none placeholder:text-white/25"/><div className="flex gap-2 overflow-x-auto"><button type="button" disabled={loading || auto} onClick={submit} className="min-h-14 whitespace-nowrap rounded-xl border border-white/10 bg-white/10 px-5 text-sm font-bold disabled:opacity-60">{loading ? 'Analyzing…' : 'Analyze video'}</button><button type="button" disabled={loading || auto} onClick={generateAuto} className="min-h-14 whitespace-nowrap rounded-xl bg-white px-6 text-sm font-black text-black disabled:opacity-60">{auto ? 'Finding best Short…' : 'Auto-Short'}</button></div></div>{error && <p role="alert" className="px-4 pb-2 pt-3 text-xs text-rose-300">{error}</p>}</div>
          <div className="mt-4 flex flex-wrap gap-2">{platforms.map(([id, name]) => <button key={id} type="button" onClick={() => setPlatform(id)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${platform === id ? 'border-white/30 bg-white text-black' : 'border-white/10 bg-white/[.03] text-white/50 hover:border-white/20'}`}>{name}</button>)}</div>
        </section>

        {analysis ? <section className="border-t border-white/10 pb-20 pt-7">
          <div className="mb-7 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[.025] p-1">
            {([['overview', 'Overview'], ['clips', `AI clips · ${analysis.clips.length}`], ['export', 'Export'] ] as [Tab, string][]).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold ${tab === id ? 'bg-white text-black' : 'text-white/45 hover:text-white'}`}>{label}</button>)}
          </div>

          {tab === 'overview' && <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">{analysis.source.thumbnailUrl ? <img src={analysis.source.thumbnailUrl} alt={analysis.source.title || 'Video thumbnail'} className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center text-sm text-white/30">No thumbnail</div>}<div className="p-5"><p className="text-[10px] uppercase tracking-[.22em] text-white/30">Source</p><h2 className="mt-2 text-lg font-bold">{analysis.source.title || 'YouTube source'}</h2><p className="mt-1 text-sm text-white/40">{analysis.source.author || 'Unknown creator'}</p><div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs"><span className="text-white/35">Transcript</span><span className="font-semibold text-white/65">{analysis.transcript.status}</span></div></div></div>
            <div className="grid gap-4 sm:grid-cols-3"><div className="sf-glass rounded-2xl p-5"><p className="text-xs text-white/35">AI candidates</p><p className="mt-2 text-3xl font-black">{analysis.clips.length}</p><p className="mt-1 text-xs text-white/30">ranked moments</p></div><div className="sf-glass rounded-2xl p-5"><p className="text-xs text-white/35">Best score</p><p className="mt-2 text-3xl font-black">{analysis.clips[0]?.scoresByPlatform[platform] ?? '—'}</p><p className="mt-1 text-xs text-white/30">for {platform}</p></div><div className="sf-glass rounded-2xl p-5"><p className="text-xs text-white/35">Output</p><p className="mt-2 text-3xl font-black">9:16</p><p className="mt-1 text-xs text-white/30">vertical short</p></div><div className="sf-glass rounded-2xl p-5 sm:col-span-3"><p className="text-xs uppercase tracking-[.18em] text-white/30">Workflow</p><div className="mt-5 grid gap-3 sm:grid-cols-4">{['Analyze source','Rank moments','Generate short','Track render'].map((x, i) => <div key={x} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-black">{i + 1}</span><span className="text-xs font-semibold text-white/70">{x}</span></div>)}</div></div></div>
          </div>}

          {tab === 'clips' && <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <div><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[.22em] text-white/30">AI analysis</p><h2 className="mt-1 text-2xl font-black">Best moments</h2></div><span className="text-xs text-white/35">Sorted by {platform}</span></div><div className="grid gap-3">{analysis.clips.map((clip, i) => <article key={clip.id} onClick={() => setSelectedClip(clip.id)} onKeyDown={(e) => e.key === 'Enter' && setSelectedClip(clip.id)} role="button" tabIndex={0} className={`cursor-pointer rounded-2xl border p-5 transition ${selectedClip === clip.id ? 'border-white/35 bg-white/[.08]' : 'border-white/10 bg-white/[.03] hover:border-white/20'}`}><div className="flex items-start justify-between gap-4"><div><span className="text-[11px] text-white/30">#{String(i + 1).padStart(2, '0')} · {formatTime(clip.start)}–{formatTime(clip.end)}</span><h3 className="mt-2 text-base font-bold">{clip.title}</h3><p className="mt-1 text-sm leading-6 text-white/45">{clip.hook}</p></div><span className="rounded-lg bg-white px-3 py-2 text-sm font-black text-black">{clip.scoresByPlatform[platform]}</span></div><div className="mt-4 flex flex-wrap gap-1.5">{clip.scoreReasons?.slice(0, 4).map((reason) => <span key={reason} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/45">{reason}</span>)}</div></article>)}</div></div>
            <aside className="sf-glass h-fit rounded-2xl p-5 lg:sticky lg:top-5"><p className="text-[10px] uppercase tracking-[.2em] text-white/30">Selected clip</p>{selected ? <><h3 className="mt-3 text-xl font-black">{selected.title}</h3><p className="mt-2 text-sm leading-6 text-white/45">{selected.hook}</p><div className="mt-5 rounded-xl bg-black/30 p-4"><p className="text-xs text-white/30">Timeline</p><p className="mt-1 font-mono text-sm">{formatTime(selected.start)} → {formatTime(selected.end)}</p></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-white/40">Platform score</span><b>{selected.scoresByPlatform[platform]}/100</b></div><button type="button" onClick={generate} disabled={rendering} className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black disabled:opacity-60">{rendering ? 'Starting render…' : 'Generate this Short'}</button></> : <p className="mt-3 text-sm text-white/35">Select a candidate to continue.</p>}</aside>
          </div>}

          {tab === 'export' && <div className="max-w-3xl">{exportPkg && <ExportPackagePanel pkg={exportPkg} />}{renderJob ? <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="mb-4"><p className="text-[10px] uppercase tracking-[.2em] text-white/30">Render pipeline</p><h2 className="mt-1 text-xl font-black">Your Short is being prepared</h2></div><RenderStatus jobId={renderJob} /></div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center"><p className="font-semibold">Nothing rendering yet</p><p className="mt-1 text-sm text-white/35">Select a clip and generate it to start the render pipeline.</p></div>}</div>}

          {analysis.limitations.length > 0 && <div className="mt-8 border-t border-white/10 pt-5 text-xs text-white/30"><span className="font-semibold text-white/45">Analysis notes: </span>{analysis.limitations.join(' · ')}</div>}
        </section> : <section className="grid gap-4 pb-20 sm:grid-cols-3"><div className="sf-glass rounded-2xl p-5"><div className="text-xs font-semibold text-white/35">01 · Analyze</div><p className="mt-3 text-lg font-bold">Understand the source</p><p className="mt-2 text-sm leading-6 text-white/40">Official captions and source metadata feed the analysis pipeline.</p></div><div className="sf-glass rounded-2xl p-5"><div className="text-xs font-semibold text-white/35">02 · Rank</div><p className="mt-3 text-lg font-bold">Find strong moments</p><p className="mt-2 text-sm leading-6 text-white/40">AI scores hooks, clarity, payoff, retention and shareability.</p></div><div className="sf-glass rounded-2xl p-5"><div className="text-xs font-semibold text-white/35">03 · Generate</div><p className="mt-3 text-lg font-bold">Render a real Short</p><p className="mt-2 text-sm leading-6 text-white/40">Choose a moment or let Auto-Short start the existing render workflow.</p></div></section>}
      </div>
    </main>
  );
}
