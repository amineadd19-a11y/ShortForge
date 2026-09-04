'use client';

import { useEffect, useState } from 'react';

type Creator = {
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  max_video_post_duration_sec?: number;
};

export function TikTokPublisher() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState('PUBLIC_TO_EVERYONE');
  const [isAigc, setIsAigc] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');
  const [publishId, setPublishId] = useState('');

  const loadCreator = async () => {
    const response = await fetch('/api/tiktok/creator', { cache: 'no-store' });
    if (!response.ok) return setStatus('TikTok is not connected. Connect your account first.');
    const data = await response.json();
    setCreator(data.data);
    if (data.data?.privacy_level_options?.length && !data.data.privacy_level_options.includes(privacy)) {
      setPrivacy(data.data.privacy_level_options[0]);
    }
  };

  useEffect(() => { void loadCreator(); }, []);

  const publish = async () => {
    setStatus('Publishing…');
    const response = await fetch('/api/tiktok/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoUrl, title, privacy_level: privacy, is_aigc: isAigc, consent }),
    });
    const data = await response.json();
    if (!response.ok) return setStatus(data.error || 'Publish failed');
    setPublishId(data.publish_id);
    setStatus(`Submitted to @${data.creator.username}. Publish ID: ${data.publish_id}`);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">TikTok</p>
          <h3 className="mt-1 text-lg font-bold">Direct publishing</h3>
        </div>
        <a href="/api/tiktok/connect" className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15">
          {creator ? `Connected @${creator.creator_username}` : 'Connect TikTok'}
        </a>
      </div>

      <div className="mt-5 grid gap-3">
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Rendered MP4 HTTPS URL" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={2200} placeholder="TikTok caption" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none" />
        {creator && (
          <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            {creator.privacy_level_options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={isAigc} onChange={(e) => setIsAigc(e.target.checked)} /> This video is AI-generated</label>
        <label className="flex items-start gap-2 text-xs text-white/60"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I explicitly authorize ShortForge to send this video and caption to my connected TikTok account.</label>
        <button disabled={!creator || !videoUrl || !title || !consent} onClick={() => void publish()} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">Publish to TikTok</button>
        {status && <p className="text-xs text-white/50">{status}</p>}
        {publishId && <button type="button" onClick={async () => { const r = await fetch('/api/tiktok/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish_id: publishId }) }); const d = await r.json(); setStatus(d.data?.status || d.error || 'Status unavailable'); }} className="text-left text-xs text-white/60 underline">Refresh publish status</button>}
      </div>
    </section>
  );
}
