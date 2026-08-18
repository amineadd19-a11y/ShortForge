import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, stat, unlink, writeFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { transcribeWithWhisper } from './transcribe.mjs';
import { analyzeVerticalCrop } from './reframe.mjs';
import { detectFaces } from './face-track.mjs';
import { buildDynamicCropFilter } from './dynamic-crop.mjs';
import { writeAssCaptions } from './captions.mjs';

const PORT = Number(process.env.PORT || 8787);
const WORK_DIR = process.env.WORK_DIR || '/tmp/shortforge';
const MAX_BODY = 64 * 1024;
const MAX_DURATION = 180;
const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 2));
const JOB_TIMEOUT_MS = Math.max(60_000, Number(process.env.JOB_TIMEOUT_MS || 600_000));
const WORKER_TOKEN = process.env.RENDER_WORKER_TOKEN?.trim() || '';
const bucket = process.env.S3_BUCKET?.trim();
const jobs = new Map();
let activeJobs = 0;

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
  return value === `Bearer ${WORKER_TOKEN}`;
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

function youtubeUrl(v) {
  try {
    const u = new URL(v);
    return (
      u.protocol === 'https:' &&
      ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(u.hostname)
    );
  } catch {
    return false;
  }
}

function run(cmd, args, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    p.stdout.on('data', (c) => {
      out += c;
    });
    p.stderr.on('data', (c) => {
      err += c;
      if (err.length > 8000) err = err.slice(-8000);
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} failed (${code}): ${err.slice(-2500)}`));
    });
  });
}

async function downloadSource(url, template) {
  // yt-dlp writes to template path; never pass user input as shell.
  await run(
    'yt-dlp',
    [
      '--no-playlist',
      '--no-warnings',
      '--format',
      'bv*[height<=1080]+ba/b[height<=1080]/
      '--merge-output-format',
      'mp4',
      '--output',
      template,
      '--',
      url,
    ],
    300_000,
  );
}

async function probeVideo(input) {
  const raw = await run(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', input],
    30_000,
  );
  const stream = JSON.parse(raw).streams?.[0];
  if (!stream?.width || !stream?.height) throw new Error('Unable to read source video dimensions.');
  return { width: Number(stream.width), height: Number(stream.height) };
}

async function render(job, input, output, captions, faces, dimensions) {
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
  job.status = 'processing';
  job.progress = 5;
  const template = path.join(WORK_DIR, `${job.id}-input.%(ext)s`);
  const input = path.join(WORK_DIR, `${job.id}-input.mp4`);
  const output = path.join(WORK_DIR, `${job.id}.mp4`);

  const watchdog = setTimeout(() => {
    if (job.status === 'processing') {
      job.status = 'failed';
      job.error = 'Job timed out.';
    }
  }, JOB_TIMEOUT_MS + 30_000);

  try {
    job.progress = 10;
    await downloadSource(job.sourceUrl, template);
    job.progress = 35;

    job.transcriptStatus = 'processing';
    const captions = await transcribeWithWhisper(input);
    job.transcriptStatus = 'ready';
    job.captions = captions;
    job.progress = 50;

    job.cropStatus = 'processing';
    const crop = await analyzeVerticalCrop(
      input,
      job.plan?.start || 0,
      Math.min(MAX_DURATION, (job.plan?.end || 0) - (job.plan?.start || 0)),
    );
    job.crop = crop;
    job.progress = 60;

    job.faceTrackingStatus = 'processing';
    const faces = await detectFaces(
      input,
      job.plan?.start || 0,
      Math.min(MAX_DURATION, (job.plan?.end || 0) - (job.plan?.start || 0)),
    );
    job.faceTrackingStatus = faces.enabled ? 'ready' : 'fallback';
    job.faces = faces;
    job.progress = 70;

    const dimensions = await probeVideo(input);
    job.cropStatus = 'ready';
    job.progress = 75;

    await render(job, input, output, captions, faces, dimensions);
    job.progress = 90;

    job.outputUrl = await upload(output, `shorts/${job.id}.mp4`);
    job.progress = 100;
    job.status = 'completed';
  } catch (e) {
    job.status = 'failed';
    job.error = e instanceof Error ? e.message : 'Render failed.';
  } finally {
    clearTimeout(watchdog);
    activeJobs = Math.max(0, activeJobs - 1);
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
      (req.method === 'POST' && u.pathname === '/jobs') ||
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
      void processJob(job);
      return json(res, 202, { jobId: id, status: 'queued' });
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
        error: j.error,
      });
    }

    json(res, 404, { error: 'Not found.' });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : 'Invalid request.' });
  }
});

await mkdir(WORK_DIR, { recursive: true });
server.listen(PORT, () => console.log(`ShortForge render worker listening on ${PORT}`));
