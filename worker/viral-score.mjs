const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));

export function scoreTranscript(words,duration){
  const valid=(Array.isArray(words)?words:[]).filter(w=>Number.isFinite(Number(w.start))&&Number.isFinite(Number(w.end))&&String(w.text||'').trim());
  const text=valid.map(w=>String(w.text).trim()).join(' ');
  const tokens=text.split(/\s+/).filter(Boolean);
  const question=(text.match(/[?؟]/g)||[]).length;
  const exclaim=(text.match(/[!！]/g)||[]).length;
  const wordsPerMinute=duration>0?tokens.length/(duration/60):0;
  const density=clamp(wordsPerMinute/180);
  const punctuation=clamp((question+exclaim)/Math.max(1,tokens.length/30));
  const hook=clamp((question*0.18+exclaim*0.12)+(tokens.slice(0,14).some(t=>/^(how|why|what|secret|truth|never|best|mistake|كيف|علاش|شنو|الحقيقة|سر)$/i.test(t.replace(/[^\p{L}\p{N}]/gu,'')))?0.55:0));
  return {score:Math.round(100*clamp(0.42*density+0.28*hook+0.18*punctuation+0.12*clamp(valid.length/40))),hook:Math.round(hook*100),speechDensity:Math.round(density*100),punctuation:Math.round(punctuation*100),wordCount:tokens.length};
}

export function rankClips(words, duration, clipLength=45, step=10){
  const total=Number(duration)||0; if(total<=0)return [];
  const out=[];
  for(let start=0;start<total;start+=step){
    const end=Math.min(total,start+clipLength); if(end-start<8)break;
    const local=(Array.isArray(words)?words:[]).filter(w=>Number(w.end)>start&&Number(w.start)<end).map(w=>({...w,start:Math.max(start,Number(w.start))-start,end:Math.min(end,Number(w.end))-start}));
    const score=scoreTranscript(local,end-start);
    out.push({start:Number(start.toFixed(2)),end:Number(end.toFixed(2)),duration:Number((end-start).toFixed(2)),...score});
  }
  return out.sort((a,b)=>b.score-a.score).map((x,i)=>({...x,rank:i+1}));
}
