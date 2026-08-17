import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAnalysis } from '@/lib/analysis/engine';
import { getTranscript } from '@/lib/transcript/provider';
import { getYouTubeMetadata } from '@/lib/video/metadata';
import { getYouTubeVideoId } from '@/lib/video/url';

const schema=z.object({url:z.string().url(),platform:z.enum(['youtube','tiktok','reels']).default('youtube')});
const workerUrl=process.env.RENDER_WORKER_URL?.replace(/\/$/,'');

export async function POST(request:Request){
  try{
    if(!workerUrl)return NextResponse.json({error:'Render worker is not configured.'},{status:503});
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:'A valid YouTube URL is required.'},{status:400});
    const videoId=getYouTubeVideoId(parsed.data.url);
    if(!videoId)return NextResponse.json({error:'Invalid YouTube URL.'},{status:400});
    const source=await getYouTubeMetadata(videoId,parsed.data.url);
    const transcript=await getTranscript(videoId);
    const analysis=buildAnalysis(source,transcript.segments,parsed.data.platform);
    const best=analysis.clips[0];
    if(!best)return NextResponse.json({status:'needs_transcript'},{status:422});
    const plan={start:best.start,end:best.end,platform:parsed.data.platform,aspectRatio:'9:16',resolution:'1080x1920',captions:'word-synced',reframe:'speaker-aware',safeZone:parsed.data.platform==='youtube'?'youtube-shorts':parsed.data.platform==='tiktok'?'tiktok':'instagram-reels'};
    const worker=await fetch(`${workerUrl}/jobs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceUrl:parsed.data.url,plan})});
    const body=await worker.json().catch(()=>({}));
    if(!worker.ok)return NextResponse.json({error:body.error||'Render worker rejected the job.'},{status:worker.status});
    return NextResponse.json({status:'rendering',platform:parsed.data.platform,selection:best,plan,job:body},{status:202});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to start automatic rendering.'},{status:500});}
}
