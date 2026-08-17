import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const WORK_DIR = process.env.WORK_DIR || '/tmp/shortforge';
const MAX_BODY = 64 * 1024;
const jobs = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let size = 0; let text = '';
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request body too large.');
    text += chunk;
  }
  return JSON.parse(text || '{}');
}

function validUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(u.hostname); }
  catch { return false; }
}

function runFfmpeg(job) {
  const input = job.sourceUrl;
  const output = path.join(WORK_DIR, `${job.id}.mp4`);
  const start = Math.max(0, Number(job.plan?.start ?? 0));
  const end = Number(job.plan?.end);
  if (!Number.isFinite(end) || end <= start || end - start > 180) throw new Error('Invalid render duration.');
  const duration = end - start;
  const args = ['-ss', String(start), '-i', input, '-t', String(duration), '-vf', 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1', '-map', '0:v:0', '-map', '0:a?', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', '-y', output];
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', c => { err += c.toString(); if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', reject); p.on('close', code => code === 0 ? resolve(output) : reject(new Error(`FFmpeg failed (${code}): ${err.slice(-2000)}`)));
  });
}

async function processJob(job) {
  job.status = 'processing';
  try {
    const output = await runFfmpeg(job);
    job.status = 'completed'; job.outputUrl = `/jobs/${job.id}/output`;
    job.outputPath = output;
  } catch (e) { job.status = 'failed'; job.error = e instanceof Error ? e.message : 'Render failed.'; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'POST' && url.pathname === '/jobs') {
      const input = await body(req);
      if (!validUrl(input.sourceUrl)) return json(res, 400, { error: 'A valid YouTube HTTPS URL is required.' });
      const id = randomUUID(); const job = { id, sourceUrl: input.sourceUrl, plan: input.plan, status: 'queued' };
      jobs.set(id, job); void processJob(job);
      return json(res, 202, { jobId: id, status: 'queued' });
    }
    const match = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && match) {
      const job = jobs.get(match[1]); if (!job) return json(res, 404, { error: 'Job not found.' });
      return json(res, 200, { jobId: job.id, status: job.status, outputUrl: job.outputUrl, error: job.error });
    }
    const outputMatch = url.pathname.match(/^\/jobs\/([^/]+)\/output$/);
    if (req.method === 'GET' && outputMatch) {
      const job = jobs.get(outputMatch[1]);
      if (!job || job.status !== 'completed') return json(res, 404, { error: 'Output not available.' });
      res.writeHead(501, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Configure object storage before exposing rendered files.' }));
    }
    json(res, 404, { error: 'Not found.' });
  } catch (e) { json(res, 400, { error: e instanceof Error ? e.message : 'Invalid request.' }); }
});

await mkdir(WORK_DIR, { recursive: true });
server.listen(PORT, () => console.log(`ShortForge render worker listening on ${PORT}`));
