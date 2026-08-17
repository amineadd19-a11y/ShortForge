import { writeFile } from 'node:fs/promises';

function assTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
}

function escapeAss(text) {
  return String(text ?? '').replace(/[{}]/g, '').replace(/\\/g, '\\\\').replace(/\r?\n/g, ' ');
}

export async function writeAssCaptions(file, words = [], offset = 0) {
  const valid = Array.isArray(words)
    ? words.filter((w) => Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)) && Number(w.end) > Number(w.start) && String(w.text ?? '').trim())
    : [];
  if (!valid.length) return false;
  const events = valid.map((w) => `Dialogue: 0,${assTime(Number(w.start) - offset)},${assTime(Number(w.end) - offset)},Default,,0,0,0,,${escapeAss(w.text)}`);
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,4,1,2,80,80,420,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`;
  await writeFile(file, ass, 'utf8');
  return true;
}
