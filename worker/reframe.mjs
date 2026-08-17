import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', c => { out += c; });
    p.stderr.on('data', c => { err += c; });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${command} failed (${code}): ${err.slice(-1500)}`)));
  });
}

// Lightweight motion/saliency proxy. It intentionally avoids claiming face identity.
// The worker can use these normalized x positions to keep the active subject centered.
export async function analyzeVerticalCrop(input, start, duration) {
  const sample = await run('ffmpeg', ['-ss', String(start), '-i', input, '-t', String(Math.min(duration, 30)), '-vf', 'fps=2,scale=320:-2,signalstats,metadata=print:file=-', '-f', 'null', '-']);
  const values = [...sample.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map(m => Number(m[1])).filter(Number.isFinite);
  const mean = values.length ? values.reduce((a,b) => a+b, 0) / values.length : 128;
  return { mode: 'center', confidence: values.length ? Math.min(1, values.length / 20) : 0, luminanceMean: mean };
}
