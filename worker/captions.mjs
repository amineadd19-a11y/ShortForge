import { writeFile } from 'node:fs/promises';

/**
 * Configurable ASS captions for 9:16 vertical video.
 * Never invents transcript text — only formats provided timed words/segments.
 */

const DEFAULT_STYLE = {
  fontName: 'Arial',
  fontSize: 58,
  primaryColour: '&H00FFFFFF',
  outlineColour: '&H00000000',
  backColour: '&H99000000',
  outline: 4,
  shadow: 1,
  alignment: 2, // bottom center
  marginL: 80,
  marginR: 80,
  marginV: 300,
  maxCharsPerLine: 28,
};

function assTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAss(text) {
  return String(text ?? '')
    .replace(/[{}\\]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function wrapLine(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).join('\\N');
}

export function buildAssDocument(words = [], offset = 0, duration = 180, styleInput = {}) {
  const style = { ...DEFAULT_STYLE, ...styleInput };
  const valid = Array.isArray(words)
    ? words.filter(
        (w) =>
          Number.isFinite(Number(w.start)) &&
          Number.isFinite(Number(w.end)) &&
          Number(w.end) > Number(w.start) &&
          String(w.text ?? '').trim(),
      )
    : [];

  if (!valid.length) return null;

  const events = [];
  for (const w of valid) {
    const start = Number(w.start) - offset;
    const end = Number(w.end) - offset;
    if (end <= 0 || start >= duration) continue;
    const text = wrapLine(escapeAss(w.text), style.maxCharsPerLine);
    if (!text) continue;
    events.push(
      `Dialogue: 0,${assTime(Math.max(0, start))},${assTime(Math.min(duration, end))},Default,,0,0,0,,${text}`,
    );
  }

  if (!events.length) return null;

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColour},${style.primaryColour},${style.outlineColour},${style.backColour},-1,0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},${style.marginL},${style.marginR},${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

export async function writeAssCaptions(file, words = [], offset = 0, duration = 180, style = {}) {
  const ass = buildAssDocument(words, offset, duration, style);
  if (!ass) return false;
  await writeFile(file, ass, 'utf8');
  return true;
}
