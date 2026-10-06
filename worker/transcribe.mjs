import { spawn } from 'node:child_process';

function runPython(inputPath, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', ['transcribe.py', inputPath], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };
    const killTree = () => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
    };
    const onAbort = () => { killTree(); finish(reject, new Error('Transcription cancelled.')); };
    let out = ''; let err = '';
    child.stdout.on('data', chunk => {
      out += chunk;
      if (out.length > 2_000_000) {
        killTree();
        finish(reject, new Error('Transcription output exceeded the safety limit.'));
      }
    });
    child.stderr.on('data', chunk => {
      err += chunk;
      if (err.length > 8_000) err = err.slice(-8_000);
    });
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      killTree();
      finish(reject, new Error('Transcription timed out.'));
    }, 300_000);
    const originalFinish = finish;
    child.on('error', e => originalFinish(reject, e));
    child.on('close', code => code === 0
      ? originalFinish(resolve, out)
      : originalFinish(reject, new Error(`faster-whisper failed (${code}): ${err.slice(-3000)}`)));
    const clear = () => clearTimeout(timer);
    child.once('close', clear);
    child.once('error', clear);
  });
}

export async function transcribeWithWhisper(inputPath, signal) {
  const raw = await runPython(inputPath, signal);
  const data = JSON.parse(raw);
  return {
    language: data.language || null,
    words: Array.isArray(data.words)
      ? data.words.filter(w => w && typeof w.text === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end))
      : [],
  };
}
