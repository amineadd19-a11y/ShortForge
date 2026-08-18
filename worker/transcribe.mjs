import { spawn } from 'node:child_process';

function runPython(inputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', ['transcribe.py', inputPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`faster-whisper failed (${code}): ${err.slice(-3000)}`)));
  });
}

export async function transcribeWithWhisper(inputPath) {
  const raw = await runPython(inputPath);
  const data = JSON.parse(raw);
  return {
    language: data.language || null,
    words: Array.isArray(data.words)
      ? data.words.filter(w => w && typeof w.text === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end))
      : [],
  };
}
