import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`Transcription failed (${code}): ${err.slice(-2000)}`)));
  });
}

export async function transcribeWithWhisper(inputPath) {
  const model = process.env.WHISPER_MODEL || 'small';
  const outputPrefix = `${inputPath}.transcript`;
  await run('whisper', [inputPath, '--model', model, '--output_format', 'json', '--output_dir', outputPrefix]);
  const fs = await import('node:fs/promises');
  const raw = await fs.readFile(`${outputPrefix}/${inputPath.split('/').pop()}.json`, 'utf8');
  const data = JSON.parse(raw);
  const words = [];
  for (const segment of data.segments || []) {
    if (Array.isArray(segment.words)) {
      for (const word of segment.words) {
        words.push({ text: String(word.word || '').trim(), start: Number(word.start), end: Number(word.end) });
      }
    } else if (segment.text) {
      words.push({ text: String(segment.text).trim(), start: Number(segment.start), end: Number(segment.end) });
    }
  }
  return { language: data.language || null, words: words.filter(w => w.text && Number.isFinite(w.start) && Number.isFinite(w.end)) };
}
