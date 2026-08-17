import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PORT = Number(process.env.PORT || 8787);
const WORK_DIR = process.env.WORK_DIR || '/tmp/shortforge';
const MAX_BODY = 64 * 1024;
const MAX_DURATION = 180;
const jobs = new Map();
const bucket = process.env.S3_BUCKET?.trim();
const s3 = bucket ? new S3Client({ region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' } : undefined }) : null;

function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); }
async function readBody(req) { let size = 0, text = ''; for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new Error('Request body too large.'); text += c; } return JSON.parse(text || '{}'); }
function youtubeUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' && ['youtube.com','www.youtube.com','youtu.be','m.youtube.com'].includes(u.hostname); } catch { return false; } }
function run(cmd, args) { return new Promise((resolve, reject) => { const p = spawn(cmd, args, { stdio: ['ignore','pipe','pipe'] }); let err=''; p.stderr.on('data', c => { err += c; if (err.length > 6000) err = err.slice(-6000); }); p.on('error', reject); p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} failed (${code}): ${err.slice(-2500)}`))); }); }
async function downloadSource(url, fileTemplate) { await run('yt-dlp', ['--no-playlist','--format','bv*[height<=1080]+ba/b[height<=1080]','--merge-output-format','mp4','--output',fileTemplate,url]); }
async function render(job, input, output) { const start=Math.max(0,Number(job.plan?.start??0)); const end=Number(job.plan?.end); if(!Number.isFinite(end)||end<=start||end-start>MAX_DURATION) throw new Error('Invalid render duration.'); const args=['-ss',String(start),'-i',input,'-t',String(end-start),'-vf','crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1','-map','0:v:0','-map','0:a?','-r','30','-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-movflags','+faststart','-y',output]; await run('ffmpeg',args); }
async function upload(file,key) { if(!s3||!bucket) throw new Error('Object storage is not configured.'); const size=(await stat(file)).size; await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:createReadStream(file),ContentType:'video/mp4',ContentLength:size,CacheControl:'private, max-age=3600'})); return getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:3600}); }
async function processJob(job) { job.status='processing'; const template=path.join(WORK_DIR,`${job.id}-input.%(ext)s`); const input=path.join(WORK_DIR,`${job.id}-input.mp4`); const output=path.join(WORK_DIR,`${job.id}.mp4`); try { await downloadSource(job.sourceUrl,template); await render(job,input,output); job.outputUrl=await upload(output,`shorts/${job.id}.mp4`); job.status='completed'; } catch(e) { job.status='failed'; job.error=e instanceof Error?e.message:'Render failed.'; } finally { await unlink(input).catch(()=>{}); await unlink(output).catch(()=>{}); } }

const server=http.createServer(async(req,res)=>{ try { const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`); if(req.method==='POST'&&u.pathname==='/jobs'){const x=await readBody(req);if(!youtubeUrl(x.sourceUrl))return json(res,400,{error:'A valid YouTube HTTPS URL is required.'});const id=randomUUID();const job={id,sourceUrl:x.sourceUrl,plan:x.plan,status:'queued'};jobs.set(id,job);void processJob(job);return json(res,202,{jobId:id,status:'queued'});} const m=u.pathname.match(/^\/jobs\/([^/]+)$/);if(req.method==='GET'&&m){const j=jobs.get(m[1]);if(!j)return json(res,404,{error:'Job not found.'});return json(res,200,{jobId:j.id,status:j.status,outputUrl:j.outputUrl,error:j.error});}json(res,404,{error:'Not found.'}); } catch(e){json(res,400,{error:e instanceof Error?e.message:'Invalid request.'});} });
await mkdir(WORK_DIR,{recursive:true});server.listen(PORT,()=>console.log(`ShortForge render worker listening on ${PORT}`));
