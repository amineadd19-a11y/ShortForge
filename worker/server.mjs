import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, stat, unlink, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { transcribeWithWhisper } from './transcribe.mjs';
import { analyzeVerticalCrop } from './reframe.mjs';
import { detectFaces } from './face-track.mjs';
import { buildDynamicCropFilter } from './dynamic-crop.mjs';
import { writeAssCaptions } from './captions.mjs';
import { transitionJob } from './lifecycle.mjs';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.BIND_HOST || '0.0.0.0';
const WORK_DIR = process.env.WORK_DIR || '/tmp/shortforge';
const MAX_BODY = 64 * 1024;
const MAX_DURATION = 180;
const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 2));
const JOB_TIMEOUT_MS = Math.max(60_000, Number(process.env.JOB_TIMEOUT_MS || 600_000));
const WORKER_TOKEN = process.env.RENDER_WORKER_TOKEN?.trim() || '';
const bucket = process.env.S3_BUCKET?.trim();
const jobs = new Map();
const jobControllers = new Map();
const idempotencyJobs = new Map();
let activeJobs = 0;
const JOB_RETENTION_MS = Math.max(10 * 60_000, Number(process.env.JOB_RETENTION_MS || 3_600_000));

const s3 = bucket
  ? new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          }
        : undefined,
    })
  : null;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!WORKER_TOKEN) return false;
  const value = req.headers.authorization || '';
  const expected = `Bearer ${WORKER_TOKEN}`;
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function assertNotAborted(signal) {
  if (signal?.aborted) throw new Error('Job cancelled.');
}

async function readBody(req) {
  let size = 0;
  let text = '';
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error('Request body too large.');
    text += c;
  }
  return JSON.parse(text || '{}');
}

function youtubeVideoId(v) {
  try {
    if (typeof v !== 'string' || v.length > 2048) return null;
    const u = new URL(v);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean);
      return id.length === 1 && /^[A-Za-z0-9_-]{11}$/.test(id[0]) ? id[0] : null;
    }
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    let id = null;
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (['shorts', 'embed', 'live'].includes(parts[0]) && parts[1]) id = parts[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    if (u.searchParams.has('list') && !u.searchParams.has('v') && u.pathname !== '/watch') return null;
    return id;
  } catch {
    return null;
  }
}

function youtubeUrl(v) {
  return Boolean(youtubeVideoId(v));
}

function run(cmd, args, timeoutMs = 300_000, signal) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let out = '';
    let err = '';
    let settled = false;

    const killTree = () => {
      try { process.kill(-p.pid, 'SIGKILL'); }
      catch { try { p.kill('SIGKILL'); } catch {} }
    };
    const onAbort = () => {
      killTree();
      finish(reject, new Error(`${cmd} cancelled.`));
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };
    const timer = setTimeout(() => {
      killTree();
      finish(reject, new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });

    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => {
      err += c;
      if (err.length > 8000) err = err.slice(-8000);
    });
    p.on('error', (e) => finish(reject, e));
    p.on('close', (code) => {
      if (code === 0) finish(resolve, out);
      else finish(reject, new Error(`${cmd} failed (${code}): ${err.slice(-2500)}`));
    });
  });
}

async function downloadSource(url, template, signal) {
  // yt-dlp writes to template path; never pass user input as shell.
  await run(
    'yt-dlp',
    [
      '--no-playlist',
      '--no-warnings',
      '--format',
      'bv*[height<=1080]+ba/b[height<=1080]',
      '--merge-output-format',
      'mp4',
      '--output',
      template,
      '--',
      url,
    ],
    300_000,
    signal,
  );
}

async function probeVideo(input, signal) {
  const raw = await run(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', input],
    30_000,
    signal,
  );
  const stream = JSON.parse(raw).streams?.[0];
  if (!stream?.width || !stream?.height) throw new Error('Unable to read source video dimensions.');
  return { width: Number(stream.width), height: Number(stream.height) };
}

async function render(job, input, output, captions, faces, dimensions, signal) {
  const start = Math.max(0, Number(job.plan?.start ?? 0));
  const end = Number(job.plan?.end);
  if (!Number.isFinite(end) || end <= start || end - start > MAX_DURATION) {
    throw new Error('Invalid render duration.');
  }
  const duration = end - start;
  const dynamic =
    faces?.enabled && faces.tracks?.length
      ? buildDynamicCropFilter(faces.tracks, dimensions.width, dimensions.height)
      : null;
  const filters = [
    dynamic || 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0',
    'scale=1080:1920:force_original_aspect_ratio=decrease',
    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
    'setsar=1',
  ];

  let assFile = null;
  const words = captions?.words || captions?.segments || [];
  if (Array.isArray(words) && words.length) {
    assFile = path.join(WORK_DIR, `${job.id}.ass`);
    const written = await writeAssCaptions(assFile, words, start, duration, {
      fontSize: 56,
      marginV: Number(job.plan?.captions?.safeZone?.bottom) || 300,
      marginL: Number(job.plan?.captions?.safeZone?.left) || 80,
      marginR: Number(job.plan?.captions?.safeZone?.right) || 80,
      maxCharsPerLine: 28,
    });
    if (written) {
      // Escape path for ffmpeg filter only (no shell).
      const safe = assFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/,/g, '\\,');
      filters.push(`subtitles=${safe}`);
    } else {
      assFile = null;
    }
  }

  try {
    await run(
      'ffmpeg',
      [
        '-ss',
        String(start),
        '-i',
        input,
        '-t',
        String(duration),
        '-vf',
        filters.join(','),
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-r',
        '30',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-y',
        output,
      ],
      JOB_TIMEOUT_MS,
      signal,
    );
  } finally {
    if (assFile) await unlink(assFile).catch(() => {});
  }
}

async function upload(file, key) {
  if (!s3 || !bucket) throw new Error('Object storage is not configured.');
  const size = (await stat(file)).size;
  if (size <= 0) throw new Error('Rendered file is empty.');
  if (size > 500 * 1024 * 1024) throw new Error('Rendered file exceeds size limit.');
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(file),
      ContentType: 'video/mp4',
      ContentLength: size,
      CacheControl: 'private, max-age=3600',
    }),
  );
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}

async function cleanupJobFiles(jobId) {
  try {
    const files = await readdir(WORK_DIR);
    await Promise.all(
      files
        .filter((name) => name.startsWith(jobId))
        .map((name) => unlink(path.join(WORK_DIR, name)).catch(() => {})),
    );
  } catch {
    // ignore
  }
}

async function processJob(job) {
  activeJobs += 1;
  const controller = new AbortController();
  jobControllers.set(job.id, controller);
  transitionJob(job, 'running');
  job.progress = 5;
  const template = path.join(WORK_DIR, `${job.id}-input.%(ext)s`);
  const input = path.join(WORK_DIR, `${job.id}-input.mp4`);
  const output = path.join(WORK_DIR, `${job.id}.mp4`);

  const watchdog = setTimeout(() => {
    if (job.status === 'processing') {
      job.error = 'Job timed out.';
      controller.abort();
    }
  }, JOB_TIMEOUT_MS);

  try {
    job.progress = 10;
    await downloadSource(job.sourceUrl, template, controller.signal);
    assertNotAborted(controller.signal);
    job.progress = 35;

    job.transcriptStatus = 'processing';
    const captions = await transcribeWithWhisper(input, controller.signal);
    assertNotAborted(controller.signal);
    job.transcriptStatus = 'ready';
    job.captions = captions;
    job.progress = 50;

    job.cropStatus = 'processing';
    const crop = await analyzeVerticalCrop(
      input,
      job.plan?.start || 0,
      Math.min(MAX_DURATION, (job.plan?.end || 0) - (job.plan?.start || 0)),
    );
    assertNotAborted(controller.signal);
    job.crop = crop;
    job.progress = 60;

    job.faceTrackingStatus = 'processing';
    const faces = await detectFaces(
      input,
      job.plan?.start || 0,
      Math.min(MAX_DURATION, (job.plan?.end || 0) - (job.plan?.start || 0)),
    );
    assertNotAborted(controller.signal);
    job.faceTrackingStatus = faces.enabled ? 'ready' : 'fallback';
    job.faces = faces;
    job.progress = 70;

    const dimensions = await probeVideo(input, controller.signal);
    assertNotAborted(controller.signal);
    job.cropStatus = 'ready';
    job.progress = 75;

    await render(job, input, output, captions, faces, dimensions, controller.signal);
    assertNotAborted(controller.signal);
    job.progress = 90;

    job.outputUrl = await upload(output, `shorts/${job.id}.mp4`);
    assertNotAborted(controller.signal);
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    transitionJob(job, 'completed');
  } catch (e) {
    if (controller.signal.aborted && job.status === 'cancelling') transitionJob(job, 'cancelled');
    else if (job.status === 'running') transitionJob(job, 'failed');
    if (job.status === 'cancelled') {
      job.cancelledAt = new Date().toISOString();
      job.error = 'Job cancelled.';
    } else {
      job.error = e instanceof Error ? e.message : 'Render failed.';
    }
  } finally {
    clearTimeout(watchdog);
    jobControllers.delete(job.id);
    activeJobs = Math.max(0, activeJobs - 1);
    setTimeout(() => {
      jobs.delete(job.id);
      if (job.idempotencyKey && idempotencyJobs.get(job.idempotencyKey) === job.id) {
        idempotencyJobs.delete(job.idempotencyKey);
      }
    }, JOB_RETENTION_MS).unref();
    await cleanupJobFiles(job.id);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && u.pathname === '/healthz') {
      return json(res, 200, {
        ok: true,
        service: 'shortforge-render-worker',
        version: '0.6.0',
        activeJobs,
      });
    }

    if (req.method === 'GET' && u.pathname === '/readyz') {
      const ready = Boolean(s3 && bucket && WORKER_TOKEN);
      return json(res, ready ? 200 : 503, {
        ready,
        storage: Boolean(s3 && bucket),
        authentication: Boolean(WORKER_TOKEN),
        transcription: true,
        render: true,
        activeJobs,
        maxConcurrent: MAX_CONCURRENT,
      });
    }

    if (
      (req.method === 'POST' && (u.pathname === '/jobs' || /^\/jobs\/[^/]+\/cancel$/.test(u.pathname))) ||
      (req.method === 'GET' && /^\/jobs\//.test(u.pathname))
    ) {
      if (!authorized(req)) return json(res, 401, { error: 'Unauthorized.' });
    }

    if (req.method === 'POST' && u.pathname === '/jobs') {
      if (!s3 || !bucket) return json(res, 503, { error: 'Worker object storage is not configured.' });
      if (!WORKER_TOKEN) return json(res, 503, { error: 'Worker authentication is not configured.' });
      if (activeJobs >= MAX_CONCURRENT) {
        return json(res, 429, { error: 'Worker is at capacity. Retry shortly.' });
      }

      const x = await readBody(req);
      const idempotencyKey = String(x.idempotencyKey || req.headers['idempotency-key'] || '').trim();
      if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
        return json(res, 400, { error: 'Invalid idempotency key.' });
      }
      if (idempotencyKey) {
        const existingId = idempotencyJobs.get(idempotencyKey);
        const existing = existingId ? jobs.get(existingId) : null;
        if (existing) {
          return json(res, 200, { jobId: existing.id, status: existing.status, idempotent: true });
        }
        if (existingId) idempotencyJobs.delete(idempotencyKey);
      }
      if (!youtubeUrl(x.sourceUrl)) {
        return json(res, 400, { error: 'A valid YouTube HTTPS URL is required.' });
      }

      const start = Number(x.plan?.start);
      const end = Number(x.plan?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_DURATION) {
        return json(res, 400, { error: 'Invalid plan range (max 180s).' });
      }

      const id = randomUUID();
      const job = {
        id,
        idempotencyKey: idempotencyKey || null,
        sourceUrl: x.sourceUrl,
        plan: x.plan,
        status: 'queued',
        progress: 0,
        transcriptStatus: 'queued',
        cropStatus: 'queued',
        faceTrackingStatus: 'queued',
        createdAt: new Date().toISOString(),
      };
      jobs.set(id, job);
      if (idempotencyKey) idempotencyJobs.set(idempotencyKey, id);
      void processJob(job);
      return json(res, 202, { jobId: id, status: 'queued', idempotent: Boolean(idempotencyKey) });
    }

    const cancelMatch = u.pathname.match(/^\/jobs\/([^/]+)\/cancel$/);
    if (req.method === 'POST' && cancelMatch) {
      const j = jobs.get(cancelMatch[1]);
      if (!j) return json(res, 404, { error: 'Job not found.' });
      if (['completed', 'failed'].includes(j.status)) {
        return json(res, 409, { error: 'Job is already finished.', status: j.status });
      }
      if (j.status === 'cancelled' || j.status === 'cancelling') {
        return json(res, 200, { jobId: j.id, status: j.status, idempotent: true });
      }
      const controller = jobControllers.get(j.id);
      if (!controller) return json(res, 409, { error: 'Job is not currently cancellable.' });
      transitionJob(j, 'cancelling');
      j.error = 'Cancellation requested.';
      controller.abort();
      return json(res, 202, { jobId: j.id, status: 'cancelling' });
    }

    const m = u.pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      const j = jobs.get(m[1]);
      if (!j) return json(res, 404, { error: 'Job not found.' });
      return json(res, 200, {
        jobId: j.id,
        status: j.status,
        progress: j.progress ?? 0,
        transcriptStatus: j.transcriptStatus,
        cropStatus: j.cropStatus,
        faceTrackingStatus: j.faceTrackingStatus,
        outputUrl: j.outputUrl,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        cancelledAt: j.cancelledAt,
        error: j.error,
      });
    }

    json(res, 404, { error: 'Not found.' });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : 'Invalid request.' });
  }
});

await mkdir(WORK_DIR, { recursive: true });
server.listen(PORT, HOST, () => console.log(`ShortForge render worker listening on ${HOST}:${PORT}`));
